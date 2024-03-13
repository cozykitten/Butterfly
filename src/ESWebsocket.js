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
    #connections = [];
    #keepaliveTimer;
    #wsEndpoint;
    #subEndpoint;
    #auth;
    subscriptions;
    emitter;

    /**
     * Creates a new ESWebsocket instance to interact with Twitch's EventSub system.
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
     * Initializes the Webocket connection to Twitch's EventSub system.
     * This method is asynchronous and returns an EventEmitter instance that can be used to listen for events.
     * 
     * @throws {Error} If an error occurs during the WebSocket connection or event subscription process.
     */
    async createWebsocket() {
        this.emitter = new EventEmitter();
        this.subscriptions = await this.#readEvents();
        this.#connect();
    }

    /**
     * Closes the Websocket connection, unregisters from all events and removes all eventlisteners on this instance.
     */
    async close() {
        for (const connection of this.#connections) {
            connection.close(1000);
        }
        this.#connections = [];
    }

    async #readEvents() {
        const twitchEventFiles = await fs.promises.readdir('./events/twitch/');
        const eventFiles = twitchEventFiles.filter(file => file.endsWith('.js'));
        const subscriptions = {};
        for (const file of eventFiles) {
            const event = await import(`../events/twitch/${file}`);
            const eventName = event.default.data.type;
            subscriptions[eventName] = event.default;
        }
        return subscriptions;
    }

    async #resetKeepaliveTimer(ws) {
        clearTimeout(this.#keepaliveTimer);
        this.#keepaliveTimer = setTimeout(() => {
            console.log('\n\x1b[33mTwitch websocket: timeout\x1b[0m');
            this.#isReconnecting;
            ws.close(4005);
            const i = this.#connections.indexOf(ws);
            this.#connections.splice(i, 1);
            console.log('reconnecting...');
            this.#connect(); //TODO: what if connection is down for a few minutes?
        }, 15000);
    }

    async #connect() {
        const ws = new WebSocket(this.#wsEndpoint, {
            perMessageDeflate: false,
            headers: {
                'Client-ID': this.#auth.clientId,
                'Authorization': `Bearer ${this.#auth.clientSecret}`
            }
        });

        ws.once('open', () => {
            console.log('\n\x1b[34mTwitch websocket: connected\x1b[0m');
            this.#resetKeepaliveTimer(ws);
            this.#connections.push(ws);
        });

        ws.once('close', async (code) => {
            if (!this.#isReconnecting) {
                clearTimeout(this.#keepaliveTimer);
                for (const eventName in this.subscriptions) {
                    const cleared = await this.#unsubscribe(this.subscriptions[eventName].data.id);
                    if (cleared) console.log(`Deleted subscription to event: ${eventName}`);
                }
            }
            this.#isReconnecting = false;
            ws.removeAllListeners();
            console.log(`\x1b[33mTwitch websocket ${ws.sessionId}: disconnected (${code})\x1b[0m`);
            //TODO: send notification to discord channel with code if code is >= 4000, aka emit new event
            if (code >= 4000) this.emitter.emit('disconnect', code);
        });

        /**
         * possibly lost connection or other error that the ws should be closed.
         * if connection still persists, remove all events automatically by not setting this.#isReconnecting true.
         * also removes timeout timer since we don't want a reconnection attempt.
         * lastly removes reference from this.#connections
         */
        ws.on('error', (error) => {
            console.error('\x1b[31mTwitch websocket error:\x1b[0m', error);
            ws.close(4006);
            const i = this.#connections.indexOf(ws);
            this.#connections.splice(i, 1);

            //TODO: test this later, retry interval and time to wait for connection, etc
            setTimeout(this.#connect, 900000);
        });

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

                if (this.#connections.length > 1) {
                    this.#connections.shift().close(1000);
                    return;
                }

                await this.#removeExistingSubscriptions();
                await this.#registerSubscriptions(ws.sessionId);
            }
            else if (message.metadata.message_type === 'revocation') {
                const reason = message.payload.subscription.status;
                const type = message.payload.subscription.type;
                console.warn(`\n\x1b[31mTwitch websocket: subscription ${type} revoked for reason ${reason}\x1b[0m`);

                const cleared = await this.#unsubscribe(this.subscriptions[type].data.id);
                if (cleared) console.log(`Deleted subscription to event: ${type}`);
            }
        });
    }

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

    async #removeExistingSubscriptions() {
        const subList = await this.#getSubscriptions();
        if (subList.length > 0) {
            for (const sub of subList) {
                const cleared = await this.#unsubscribe(sub.id);
                if (cleared) console.log(`\x1b[33mRemoved existing subscription: ${sub.type}\x1b[0m`);
                else console.warn(`\x1b[31mFailed removing existing subscription: ${sub.type}\x1b[0m`);
            }
        }
    }

    /**
     * Gets a list of all registered subscriptions.
     * 
     * @returns {Promise<Array<Object>|boolean} A promise that resolves to a list of registered subscription objects if successful, or false if an error occurs.
     * @throws {Error} If the request was denied for some reason.
     */
    async #getSubscriptions() {
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
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#getSubscriptions();
            }
            throw new Error(`Failed to get existing subscriptions: ${response.statusText}`);
        } catch (e) {
            console.error(`Error getting existing subscriptions: ${e}`);
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
    async #subscribe(websocketID, type, version, condition) {
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
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#subscribe(websocketID, type, version, condition);
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
     * @throws {Error} If an error occurs during the unsubscription process.
     */
    async #unsubscribe(idString) {
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
                console.warn(`\x1b[31mTwitch websocket: 401 Unauthorized \x1b[0m`);
                const token = await this.#auth.refreshUserAccessToken();
                if (token) return await this.#unsubscribe(idString);
            }
            throw new Error(`Failed to unsubscribe from event: ${JSON.stringify(response)}`);
        } catch (e) {
            console.error(`Error unsubscribing from event: ${e}`);
            return false;
        }
    }
}