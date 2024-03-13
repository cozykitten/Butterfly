import { env } from "custom-env";
env();
import { db, eventList, sync } from './dbManager.js';
import ESWebsocket from "./ESWebsocket.js";
import ESAuth from "./ESAuth.js";

/** @type {ESWebsocket} */
let websocket;

export default {
    /**
     * Initialize the connection and handling of Twitch EventSub API.
     * @param {Client} client Discord client instance.
     */
    async initialize(client) {
        websocket = await initializeEventSub(client);
    },
    /**
     * Cleanup all related connections, subscriptions, eventListeners and references.
     */
    async terminate() {
        if (!websocket) return;
        websocket.emitter.removeAllListeners();
        await websocket.close();
        websocket = undefined;
    }
}

async function initializeEventSub(client) {

    const wsEndpoint = 'ws://127.0.0.1:8080/ws';
    const subEndpoint = 'http://127.0.0.1:8080/eventsub/subscriptions';

    const monthNumber = new Date().getMonth();

    /**
     * If the current month is ahead of the latest month list, remove the older month list (first item) and create structure for the current month.
     */
    if (monthNumber > eventList[1].month) {
        eventList.shift();
        eventList.push({
            month: monthNumber,
            events: []
        });
    }

    const auth = new ESAuth(process.env.TWITCH_ID, process.env.TWITCH_SECRET, db.eventSub.accessToken, db.eventSub.refreshToken, db.eventSub.broadcasterId);
    const websocket = new ESWebsocket(wsEndpoint, subEndpoint, auth);
    await websocket.createWebsocket();

    /**
     * Handles every subscribed event on trigger, saves it and sends a notification.
     * 
     * Cheer event isn't processed if anonymous.
     * Subscribe event isn't processed if the sub was gifted.
     * Resubscribe event isn't triggered when user doesn't send a message.
     * Giftsub event isn't processed if anonymous.
     * 
     * Redeem events are both saved under the same eventName that's different from their actual type.
     */
    websocket.emitter.on('notification', async (payload) => {
        const e = await websocket.subscriptions[payload.subscription.type].execute(payload.event);
        if (e) {
            eventList[1].events.push(e[0]);
            sync(eventList, 'events');
            sendDiscordMessage(e[1], client);
        }
    });

    websocket.emitter.on('disconnect', async (code) => {
        const home = client.guilds.cache.get(db.HOME);
        const log = home.channels.cache.get(db.LOG);
        log.send(`Twitch websocket: connection was closed  ${code}`);
    });
    return websocket;
}

async function sendDiscordMessage(embed, client) {
    try {
        const guild = client.guilds.cache.get(JSON.parse(process.env.GUILD_ID)[0]); //change on production
        const channel = guild.channels.cache.get(db[guild.id].eventSub);
        await channel.send({ embeds: [embed], flags: 4096 });
    } catch (err) {
        console.error(`Error sending eventSub event to ${channel.name}:`, err);
        const home = await client.guilds.cache.get(db.HOME);
        const log = await home.channels.cache.get(db.LOG);
        log.send(`Error sending eventSub event to ${channel.name}: ${err.message}`);
    }
}