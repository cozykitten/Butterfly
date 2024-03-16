import { env } from "custom-env";
env();
import { db, eventList, sync } from './dbManager.js';
import ESWebsocket from "./ESWebsocket.js";
import ESAuth from "./ESAuth.js";

const wsEndpoint = 'ws://127.0.0.1:8080/ws';
const subEndpoint = 'http://127.0.0.1:8080/eventsub/subscriptions';
const auth = new ESAuth(process.env.TWITCH_ID, process.env.TWITCH_SECRET, db.eventSub.accessToken, db.eventSub.refreshToken, db.eventSub.broadcasterId);
const websocket = new ESWebsocket(wsEndpoint, subEndpoint, auth);
let active;

export default {
    /**
     * Initialize the connection and handling of Twitch EventSub API.
     * @param {Client} client Discord client instance.
     */
    async initialize(client) {
        await initializeEventSub(client);
    },
    /**
     * Cleanup all related connections, subscriptions, eventListeners and references.
     */
    async terminate() {
        if (!active) return;
        await websocket.terminate();
    }
}

/**
 * Retrieves follower data from the Twitch API up to a specified end date.
 *
 * @param {number} endTime - The end timestamp up to which follower data should be retrieved.
 * @returns {Promise<Array>} An array of follower objects.
 * @throws {Error} If the fetch operation fails or if the access token refresh fails after a 401 Unauthorized status.
 * @example
 * getFollowers(1710538298301)
 */
export async function getFollowers(endTime) {
    const url = new URL('https://api.twitch.tv/helix/channels/followers');
    url.searchParams.append('broadcaster_id', auth.broadcasterId);
    url.searchParams.append('first', '100');

    const followers = [];
    let cursor = null;

    do {
        if (cursor) url.searchParams.append('after', cursor);
        try {
            const data = await fetchTwitch(url, headers);
            if (data.data.length > 0 && new Date(data.data[data.data.length - 1].followed_at) < new Date(endTime)) {
                for (const follower of data.data) {
                    if (new Date(follower.followed_at) > new Date(endTime)) return followers;
                    followers.push(follower);
                }
            }
            else followers.push(...data.data);
            cursor = data.pagination?.cursor;
        } catch (error) {
            throw error;
        }
    } while (cursor);
    return followers;
}

/**
 * Retrieves clips from Twitch API within a specified time range.
 * 
 * @param {number} startTime - The start timestamp for the clips.
 * @param {number} endTime - The end time for the clips.
 * @returns {Promise<string[]>} A promise that resolves to an array of clip URLs.
 * @throws {Error} If the fetch operation fails or if the access token refresh fails after a 401 Unauthorized status.
 * @example
 * getClips(Date.now(), 1710538298301)
 */
export async function getClips(startTime, endTime) {
    const url = new URL('https://api.twitch.tv/helix/clips');
    url.searchParams.append('broadcaster_id', auth.broadcasterId);
    url.searchParams.append('started_at', new Date(startTime).toISOString);
    url.searchParams.append('ended_at', new Date(endTime).toISOString);
    url.searchParams.append('first', '100');

    let clips = [];
    let cursor = null;

    do {
        if (cursor) url.searchParams.append('after', cursor);
        try {
            const data = await fetchTwitch(url);
            clips.push(data.data.map(clip => clip.url));
            cursor = data.pagination?.cursor;
        }
        catch (error) {
            throw error;
        }
    } while (cursor);
    return clips;
}

/**
 * @param {string} url Endpoint with params.
 * @returns {Promise<any>} response in json format.
 * @throws {Error} If the fetch operation fails or if the access token refresh fails after a 401 Unauthorized status.
 */
async function fetchTwitch(url) {
    let retry = false;
    do {
        const headers = {
            'Client-Id': auth.clientId,
            'Authorization': `Bearer ${auth.accessToken}`
        };
        const response = await fetch(url, { headers });
        if (response.ok) return await response.json();
        if (response.status === 401) {
            if (retry) throw new Error('401 Unauthorized');
            console.warn(`\x1b[31mTwitch API: 401 Unauthorized \x1b[0m`);
            const token = await auth.refreshUserAccessToken();
            if (token) retry = true;
        } else throw new Error(`Failed to fetch from twitch API: ${response.statusText}`);
    } while(retry);
}


async function initializeEventSub(client) {

    await shiftEventList();
    await websocket.createWebsocket();

    /**
     * Handles every subscribed event on trigger, saves it and sends a notification.
     * Events are saved under their custom name, not  their type.
     * 
     * Cheer event isn't processed if anonymous.
     * Subscribe event isn't processed if the sub was gifted.
     * Resubscribe event isn't triggered when user doesn't send a message.
     * Giftsub event isn't processed if anonymous.
     */
    websocket.emitter.on('notification', async (payload) => {
        const eventFile = websocket.subscriptions[payload.subscription.type];
        const e = await eventFile.execute(payload.event);
        if (e) {
            if (!eventList[1].events.hasOwnProperty(eventFile.data.name)) eventList[1].events[eventFile.data.name] = [];
            eventList[1].events[eventFile.data.name].push(e[0]);
            sync(eventList, 'events');
            sendDiscordMessage(e[1], client);
        }
    });

    websocket.emitter.on('disconnect', async (code) => {
        const home = client.guilds.cache.get(db.HOME);
        const log = home.channels.cache.get(db.LOG);
        log.send(`Twitch websocket: connection was closed  ${code}`);
    });
    active = true;
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

/**
 * If the current month is ahead of the latest month list, remove the older month list (first item) and create structure for the current month.
 */
async function shiftEventList() {
    const monthNumber = new Date().getMonth();

    if (monthNumber > eventList[1].month) {
        eventList.shift();
        eventList.push({
            month: monthNumber,
            events: {}
        });
    }
    eventListTimeout();
}

async function eventListTimeout() {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = date.getTime() - now.getTime();

    if (diff > 2147483646) setTimeout(eventListTimeout, 2147400000);
    else setTimeout(shiftEventList, diff);
}