import { env } from "custom-env";
env();
import { db, eventList, sync } from './dbManager.js';
import ESWebsocket from "./ESWebsocket.js";
import ESAuth from "./ESAuth.js";

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
const websocketEvent = await websocket.createWebsocket();

websocketEvent.on('notification', async (payload) => {
    eventList[1].events.push(await websocket.subscriptions[payload.subscription.type].execute(payload.event));
    sync(eventList, 'events');
});

export async function terminateWebsocket() {
    await websocket.terminate();
}