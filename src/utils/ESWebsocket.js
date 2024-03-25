import WebSocket from 'ws';
import fs from 'fs';
import { EventEmitter } from 'events';

/**
 * Represents a websocket connection for interacting with Twitch's EventSub API.
 */
export default class ESWebsocket {
    #isReconnecting = false;
    #messageIDs = new Array(10);
    #messageIDsIndex = 0;
    #connections = new Set();
    #keepaliveTimer;
    #exitCode;
    #wsEndpoint;
    #subEndpoint;
    #auth;
    subscriptions;
    emitter;

    /**
     * Creates a new ESWebsocket instance to interact with Twitch's EventSub API.
     * 
     * @param {string} wsEndpoint - The WebSocket server endpoint URL.
     * @param {string} subEndpoint - The event subscription endpoint URL.
     * @param {ESAuth} auth - Your authentication data.
     */
    constructor(wsEndpoint, subEndpoint, auth) {
        this.#wsEndpoint = wsEndpoint;
        this.#subEndpoint = subEndpoint;
        this.#auth = auth;
    }

    /**
     * Initializes the WebSocket connection to Twitch's EventSub API.
     */
    async createWebsocket() {
        this.emitter = new EventEmitter();
        this.subscriptions = await this.#readEvents();
        await this.#connect();
    }

    /**
     * Closes all WebSocket connections, unregisters from all ws events, and removes all event listeners on this instance.
     * Clears emitter and subscriptions references too.
     */
    async destroy() {
        const connections = new Set(this.#connections);
        const cleanupPromise = new Promise(resolve => {
            let cleanupCounter = 0;
            this.emitter.on('cleanupComplete', () => {
                cleanupCounter++;
                if (cleanupCounter === connections.size) {
                    resolve();
                }
            });
        });

        for (const connection of connections) {
            await this.#close(connection);
        }
        await cleanupPromise;
        this.emitter.removeAllListeners();
        this.emitter = this.subscriptions = null;
    }

    /**
     * Closes the specified connection and removes eventlisteners.
     * Clears the keepalive timer (and unsubscribes from events) if not reconnecting.
     * 
     * @param {WebSocket} connection - The WebSocket connection to close.
     * @param {number} - The status code indicating why the connection is being closed. Defaults to 1000 (normal closure).
     * @returns {Promise<void>} 
     */
    async #close(connection, code = 1000) {
        if (!this.#isReconnecting && connection.sessionId) {
            clearTimeout(this.#keepaliveTimer);
            /*for (const eventName in this.subscriptions) {
                const cleared = await this.#unsubscribe(this.subscriptions[eventName].data.id);
                if (cleared) console.log(`Deleted subscription to event: ${eventName}`);
            }*/ //no need to cleanup past subscriptions, twitch automatically disables those
        }
        connection.close(code);
    }

    /**
     * Imports event subscription files and populates the subscriptions object with their corresponding event data.
     */
    async #readEvents() {
        const twitchEventFiles = await fs.promises.readdir('./events/twitch/');
        const eventFiles = twitchEventFiles.filter(file => file.endsWith('.js'));
        const subscriptions = {};
        for (const file of eventFiles) {
            const event = await import(`../../events/twitch/${file}`);
            const eventName = event.default.data.type;
            subscriptions[eventName] = event.default;
        }
        return subscriptions;
    }

    /**
     * Resets the keepalive timer for the specified WebSocket connection.
     * Should be called on every 'session_keepalive' and 'notification' event.
     * 'on close' event will set the code to 1006 to indicte that it received no code, regardless of what code is sent.
     * Code 1006 signals 'on close' event to attempt reconnection.
     * 
     * @param {WebSocket} ws - The currently active primary WebSocket connection.
     */
    async #resetKeepaliveTimer(ws) {
        clearTimeout(this.#keepaliveTimer);
        this.#keepaliveTimer = setTimeout(() => {
            console.log('\n\x1b[33mTwitch websocket: timeout\x1b[0m');
            this.#isReconnecting = true;
            this.#close(ws, 4009);
        }, 15000);
    }

    /**
     * Establishes a WebSocket connection to Twitch's EventSub API.
     * Handles subscriptions, all connection events, reconnection logic.
     */
    async #connect() {
        const ws = new WebSocket(this.#wsEndpoint, {
            perMessageDeflate: false,
            headers: {
                'Client-ID': this.#auth.clientId,
                'Authorization': `Bearer ${this.#auth.clientSecret}`
            }
        });

        /**
         * On established connection, initiates the keepalive timeout, and adds the connection to the set of active connections.
         * If exitCode 1006 is set, that means that a previous connection timed out or couldn't be established.
         * In this case, emit a 'disconnect' event for logging, on a 45s timeout to make sure discord's heartbeat was received.
         */
        ws.once('open', () => {
            console.log('\n\x1b[34mTwitch websocket: connected\x1b[0m');
            this.#resetKeepaliveTimer(ws);
            this.#connections.add(ws);
            if (this.#exitCode === 1006) {
                setTimeout(() => this.emitter?.emit('connection', {connect: false, code: this.#exitCode}), 45000);
                this.#exitCode = null;
            }
        });

        /**
         * Removes all event listeners.
         * Reconnection should only attempted on connection loss, indicated by code '1006'.
         * On timeout reconnects are first attempts and are scheduled after 30 seconds.
         * Other reconnects are scheduled after 5 minutes.
         * If no reconnection attemt should be made, clear the keepalive timeout.
         * @param {number} code - The status code indicating why the connection was closed.
         */
        ws.once('close', async (code) => {
            ws.removeAllListeners();
            if (code >= 4000) { //-> connection error that should be checked (no network loss), should not reconnect
                clearTimeout(this.#keepaliveTimer);
                this.emitter.emit('connection', {connect: false, code: code, id: ws.sessionId});
                console.warn(`\x1b[31mTwitch websocket ${ws.sessionId}: connection closed (${code})\x1b[0m`);
            }
            else if (code === 1006) { //-> lost connection or connection attempt error, send warning on reconnect, should reconnect
                this.#exitCode = 1006;
                console.log(`\x1b[33mTwitch websocket ${ws.sessionId}: connection lost (${code})\x1b[0m`);
                if (this.#isReconnecting) {
                    setTimeout(() => this.#connect(), 30000);
                    console.log('reconnecting...');
                }
                else {
                    setTimeout(() => this.#connect(), 300000);
                    console.log('retrying in 5 minutes');
                }
            }
            else {
                this.emitter.emit('connection', {connect: false, code: code, id: ws.sessionId});
                console.log(`Twitch websocket ${ws.sessionId}: disconnected (${code})`);
            }
            this.#isReconnecting = false;
            this.#connections.delete(ws);
        });

        /**
         * Closes the WebSocket connection and removes it from the set of active connections.
         * Fires usually when no WebSocket connection can be established due to a lost network connection.
         * 
         * If connection still persists, code '4008' will be received by the 'on close' event.
         * This also removes the keepalive timeout since we don't want a reconnection attempt.
         * (removes all events automatically by not setting this.#isReconnecting = true)
         * If connection doesn't exist, 'on close' event will receive code '1006' and schedule a reconnection attempt.
         * @param {Error} error - The error that occurred.
         */
        ws.on('error', (error) => {
            console.error('\x1b[31mTwitch websocket error:\x1b[0m', error);
            this.#close(ws, 4008);
        });

        /**
         * Handles the 'message' event for the WebSocket connection.
         * Processes event data incoming from subscriptions as well as session connection and subscription related events.
         * @param {string} data - The data received from the WebSocket.
         */
        ws.on('message', async (data) => {
            const message = JSON.parse(data);
            const messageTimestamp = Date.parse(message.metadata.message_timestamp);
            if (this.#messageIDs.includes(message.metadata.message_id) || messageTimestamp < (Date.now() - 600000)) return;

            this.#messageIDs[this.#messageIDsIndex] = message.metadata.message_id;
            this.#messageIDsIndex = (this.#messageIDsIndex + 1) % 10;

            if (message.metadata.message_type === 'session_keepalive') {
                this.#resetKeepaliveTimer(ws);
            }
            else if (message.metadata.message_type === 'notification') {
                this.#resetKeepaliveTimer(ws);
                message.payload.event.timestamp = messageTimestamp;
                this.emitter.emit('notification', message.payload);
            }
            else if (message.metadata.message_type === 'session_reconnect') {
                this.#isReconnecting = true;
                this.#wsEndpoint = message.payload.session.reconnect_url;
                this.#connect();
            }
            else if (message.metadata.message_type === 'session_welcome') {
                ws.sessionId = message.payload.session.id;
                console.log(`Websocket ID: ${ws.sessionId}\n`);

                if (this.#connections.size > 1) {
                    const ws = this.#connections.values().next().value;
                    this.#close(ws);
                    return;
                }

                //await this.#removeExistingSubscriptions(); //no need to cleanup past subscriptions, twitch automatically disables those
                await this.#registerSubscriptions(ws.sessionId);

                //send connected log with current count of (active and inactive) subscriptions.
                const subList = await this.#getSubscriptions();
                setTimeout(() => this.emitter?.emit('connection', {connect: true, id: ws.sessionId, subCount: subList?.length}), 45000);
            }
            else if (message.metadata.message_type === 'revocation') {
                const reason = message.payload.subscription.status;
                const type = message.payload.subscription.type;
                console.warn(`\n\x1b[31mTwitch websocket: subscription ${type} revoked for reason ${reason}\x1b[0m`);

                /*const cleared = await this.#unsubscribe(this.subscriptions[type].data.id);
                if (cleared) console.log(`Deleted subscription to event: ${type}`);*/ //no need to cleanup past subscriptions, twitch automatically disables those
            }
        });
    }

    /**
     * Creates subscriptions for every event in the subscriptions object for the given WebSocket connection.
     * @param {string} websocketID The ID of the WebSocket connection to register events on.
     */
    async #registerSubscriptions(websocketID) {
        for (const eventName in this.subscriptions) {
            const { type, version, condition } = this.subscriptions[eventName].data;
            for (const element in condition) {
                condition[element] = this.#auth.broadcasterId;
            }
            const successSub = await this.#subscribe(websocketID, type, version, condition);
            if (successSub) {
                this.subscriptions[eventName].data.id = successSub;
                console.log(`Created subscription to event: ${eventName}`);
            }
        }
    }

    /**
     * Unregisters all subscriptions that may still be registered on the EventSub Endpoint.
     * Frst gets a list of all existing subscriptions, then calls the #unsubscribe method on each subscription.
     */
    async #removeExistingSubscriptions() {
        const subList = await this.#getSubscriptions();
        if (subList && subList.length > 0) {
            for (const sub of subList) {
                const cleared = await this.#unsubscribe(sub.id);
                if (cleared) console.log(`\x1b[33mRemoved existing subscription: ${sub.type}\x1b[0m`);
                else console.warn(`\x1b[31mFailed removing existing subscription: ${sub.type}\x1b[0m`);
            }
        }
    }

    /**
     * Gets a list of all registered subscriptions.
     * @returns {Promise<Array<Object>|boolean>} A promise that resolves to a list of registered subscription objects if successful, or false if an error occurs.
     */
    async #getSubscriptions(retry = false) {
        try {
            const response = await fetch(this.#subEndpoint, {
                method: 'GET',
                headers: {
                    'Client-Id': this.#auth.clientId,
                    'Authorization': `Bearer ${this.#auth.accessToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data;
            }
            if (response.status === 401) {
                if (retry) throw new Error('401 Unauthorized');
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#getSubscriptions(true);
            }
            throw new Error(`Failed to get existing subscriptions: ${response.statusText}`);
        } catch (e) {
            console.error('Error getting existing subscriptions:', e);
            return false;
        }
    }

    /**
     * Subscribes to a Twitch EventSub event using the provided parameters.
     *
     * @param {string} websocketID - The WebSocket session ID for the subscription.
     * @param {string} type - The type of the event to subscribe to.
     * @param {string} version - The version of the event to subscribe to.
     * @param {Object} condition - Usually contains the target channel id and the id of the authorising channel.
     * @returns {Promise<string|boolean>} A promise that resolves to the subscription ID if successful, or false if an error occurs.
     *
     * @example
     * const channelOnlineID = await subscribe('12345', 'channel.online', '1', {broadcaster_user_id:"123456789"});
     */
    async #subscribe(websocketID, type, version, condition, retry = false) {
        const body = {
            type: type,
            version: version,
            condition: condition,
            transport: { method: 'websocket', session_id: websocketID }
        }

        try {
            const response = await fetch(this.#subEndpoint, {
                method: 'POST',
                headers: {
                    'Client-Id': this.#auth.clientId,
                    'Authorization': `Bearer ${this.#auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.status === 202) {
                const data = await response.json();
                return data.data[0].id;
            }
            if (response.status === 401) {
                if (retry) throw new Error('401 Unauthorized');
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#subscribe(websocketID, type, version, condition, true);
            }
            const errorData = await response.json();
            console.error('Error creating subscription:', errorData);
            return false;
        } catch (e) {
            console.error(`Error subscribing to event: ${type}`, e);
            return false;
        }
    }

    /**
     * Unsubscribes from a Twitch EventSub event using the provided subscription ID.
     *
     * @param {string} idString - The ID of the subscription to unsubscribe from.
     * @returns {Promise<boolean>} A promise that resolves to true if the unsubscription is successful, or false if an error occurs.
     */
    async #unsubscribe(idString, retry = false) {
        try {
            const response = await fetch(`${this.#subEndpoint}?id=${idString}`, {
                method: 'DELETE',
                headers: {
                    'Client-Id': this.#auth.clientId,
                    'Authorization': `Bearer ${this.#auth.accessToken}`
                }
            });

            if (response.ok) {
                return true;
            }
            if (response.status === 401) {
                if (retry) throw new Error('401 Unauthorized');
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#unsubscribe(idString, true);
            }
            const errorData = await response.json();
            console.error('Failed to unsubscribe from event:', errorData);
            return false;
        } catch (e) {
            console.error('Error unsubscribing from event:', e);
            return false;
        }
    }
}