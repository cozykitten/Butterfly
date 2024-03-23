import { env } from "custom-env";
env();
import { db, eventList, sync } from './dbManager.js';
import ESWebsocket from "./ESWebsocket.js";
import ESAuth from "./ESAuth.js";

const wsEndpoint = 'ws://127.0.0.1:8080/ws'; //wss://eventsub.wss.twitch.tv/ws
const subEndpoint = 'http://127.0.0.1:8080/eventsub/subscriptions'; //https://api.twitch.tv/helix/eventsub/subscriptions
const auth = new ESAuth(process.env.TWITCH_ID, process.env.TWITCH_SECRET, db.eventSub.accessToken, db.eventSub.refreshToken, db.eventSub.broadcasterId);
const websocket = new ESWebsocket(wsEndpoint, subEndpoint, auth);
let shiftEventListTimer;

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
        if (!websocket.active) return;
        await websocket.terminate();
    }
}

/**
 * Get array of embeds, containing the usernames of contributors organised by event and sorted by amount / tier.
 * 
 * @param {Object} events Object of eventlists.
 * @param {number} streamLive=0 Optional timestamp until which data should be collected, starting from now.
 * @returns {Array} Array of embeds ready to be sent to discord.
 */
export function eventSummaryMessage(events, streamLive = 0) {

    let data = {};
    Object.keys(events).forEach(key => {
        const sortedEventList = eventSummaryData(events[key], streamLive);
        if (sortedEventList) data[key] = sortedEventList;
    });

    const descriptionArray = [];
    if (data.hasOwnProperty('bits')) descriptionArray.push('<a:thankBits:1220768172819484844> **Bit Cheerers**:\n*' + data.bits.join(', ') + '*');
    if (data.hasOwnProperty('giftsub')) descriptionArray.push('<a:thankGiftsub:1220768289605816541> **Sub Gifters**:\n*' + data.giftsub.join(', ') + '*');
    if (data.hasOwnProperty('subscribe')) descriptionArray.push('<a:thankSubs:1220768306659594278> **Subscribers**:\n*' + data.subscribe.join(', ') + '*');
    if (descriptionArray.length === 0) return [{ description: 'No data', color: 16672622 }];

    let description = descriptionArray.join('\n\n');
    const chunks = splitDescription(description);
    const embeds = [];
    for (const chunk of chunks) {
        const embed = {
            description: chunk,
            color: 16672622
        };
        embeds.push(embed);
    }
    return embeds;
}

/**
 * Get a list of usernames for this event, sorted by amount / tier.
 * 
 * @param {Array} event List of given event.
 * @param {number} streamLive Optional timestamp until which data should be collected, starting from now.
 * @returns {Array} Sorted list of usernames from high to low.
 */
export function eventSummaryData(event, streamLive = 0) {

    // 1. Filter out elements where timestamp < stream online time
    let filteredEvents = [];
    if (streamLive !== 0) {
        for (let i = event.length - 1; i >= 0; i--) {
            if (event[i].timestamp < streamLive) {
                break;
            }
            filteredEvents.push(event[i]);
        }
    }
    else filteredEvents = event;

    if (filteredEvents.length === 0) return false;

    let attr;
    if (filteredEvents[0].hasOwnProperty('amount')) {
        if (!filteredEvents[0].hasOwnProperty('tier')) attr = 1;
        else attr = 3;
    }
    else if (filteredEvents[0].hasOwnProperty('tier')) attr = 2;
    else attr = false;

    // 2. Sum amounts for the same user
    let userAmountMap = new Map();
    for (let i = 0; i < filteredEvents.length; i++) {
        const e = filteredEvents[i];
        if (attr === 1) {
            if (userAmountMap.has(e.user)) userAmountMap.set(e.user, userAmountMap.get(e.user) + e.amount);
            else userAmountMap.set(e.user, e.amount);
        }
        else if (attr === 2) {
            if (!userAmountMap.has(e.user)) userAmountMap.set(e.user, e.tier);
        }
        else if (attr === 3) {
            const amountToAdd = e.amount * (e.tier / 1000);
            if (userAmountMap.has(e.user)) userAmountMap.set(e.user, userAmountMap.get(e.user) + amountToAdd);
            else userAmountMap.set(e.user, amountToAdd);
        }
    }

    // 3. Sort the map by it's values
    let sortedEvents = Array.from(userAmountMap.entries()).sort((a, b) => b[1] - a[1]);

    // 4. Save the sorted usernames array
    console.log('sorted events: ', sortedEvents);
    return sortedEvents.map(([user]) => user);
}

/**
 * Retrieves clips from Twitch API within a specified time range.
 * 
 * @param {number} endTime - The end time for the clips.
 * @returns {Promise<string[]>} A promise that resolves to an array of clip URLs.
 * @throws {Error} If the fetch operation fails or if the access token refresh fails after a 401 Unauthorized status.
 * @example
 * getClips(1710538298301)
 */
export async function getClips(endTime) {
    const url = new URL('https://api.twitch.tv/helix/clips');
    url.searchParams.append('broadcaster_id', auth.broadcasterId);
    url.searchParams.append('started_at', new Date(endTime).toISOString());
    url.searchParams.append('ended_at', new Date(Date.now()).toISOString());
    url.searchParams.append('first', '100');

    let clips = [];
    let cursor = null;

    do {
        if (cursor) url.searchParams.append('after', cursor);
        try {
            const data = await fetchTwitch(url);
            clips.push(...data.data.map(clip => clip.url));
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
        const data = await response.json();
        if (response.ok) return data;
        if (response.status === 401) {
            if (retry) throw new Error(`401 Unauthorized: ${data.message}`);
            console.warn(`\x1b[31mTwitch API: 401 Unauthorized \x1b[0m`);
            const token = await auth.refreshUserAccessToken();
            if (token) retry = true;
        } else throw new Error(`Failed to fetch from twitch API: ${response.statusText}`);
    } while (retry);
}

async function initializeEventSub(client) {

    await eventListTimeout(client);
    await websocket.createWebsocket();

    /**
     * Handles every subscribed event on trigger, saves it and sends a notification.
     * Events are saved under their custom name, not  their type.
     * 
     * Cheer event isn't processed if anonymous or if amount is < 100.
     * Subscribe event isn't processed if the sub was gifted.
     * Resubscribe event isn't triggered when user doesn't send a message.
     * Giftsub event isn't processed if anonymous.
     */
    websocket.emitter.on('notification', async (payload) => {
        console.log(payload.subscription.type)
        if (payload.subscription.type === 'stream.online') {
            eventList[1].streamLive = payload.event.timestamp;
            sync(eventList, 'events');
            return;
        }
        else if (payload.subscription.type === 'stream.offline') {
            if (eventList[1].streamLive) summary(client, eventList[1].events, eventList[1].streamLive);
            eventList[1].streamLive = 0;
            sync(eventList, 'events');
            return;
        }

        const eventFile = websocket.subscriptions[payload.subscription.type];
        const e = await eventFile.execute(payload.event);
        if (e) {
            if (!eventList[1].events.hasOwnProperty(eventFile.data.name)) eventList[1].events[eventFile.data.name] = [];
            eventList[1].events[eventFile.data.name].push(e);
            sync(eventList, 'events');
        }
    });

    websocket.emitter.on('disconnect', async (code) => {
        const home = client.guilds.cache.get(db.HOME);
        const log = home.channels.cache.get(db.LOG);
        log.send(`Twitch websocket: connection was closed  ${code}`);
    });
    websocket.active = true;
}

async function summary(client, events, streamLive) {
    
    const embeds = eventSummaryMessage(events, streamLive);
    embeds[0].title = 'Stream Summary';
    embeds[embeds.length - 1].footer = { text: "Stream from" };
    embeds[embeds.length - 1].timestamp = new Date(streamLive).toISOString();

    try {
        const guild = client.guilds.cache.get(JSON.parse(process.env.GUILD_ID)[0]); //TODO change on production
        const channel = guild.channels.cache.get(db[guild.id].eventSub);
        await channel.send({ embeds: embeds, flags: 4096 });
    } catch (err) {
        console.error(`Error sending eventSub event to ${channel.name}:`, err);
        const home = await client.guilds.cache.get(db.HOME);
        const log = await home.channels.cache.get(db.LOG);
        log.send(`Error sending eventSub event to ${channel.name}: ${err.message}`);
    }
}

function splitDescription(description, maxLength = 4096) {
    const chunks = [];
    while (description.length > maxLength) {
        const chunk = description.slice(0, maxLength);
        const lastSplitIndex = chunk.lastIndexOf(', ');
        if (lastSplitIndex !== -1) {
            chunks.push(chunk.slice(0, lastSplitIndex + 1));
            description = description.slice(lastSplitIndex + 1);
        } else {
            chunks.push(chunk);
            description = description.slice(maxLength);
        }
    }
    chunks.push(description);
    return chunks;
}

/**
 * If the current month is ahead of the latest month list, remove the older month list (first item) and create structure for the current month.
 */
async function shiftEventList(client) {

    const monthNumber = new Date().getMonth();
    if (monthNumber > eventList[1].month) {
        eventList.shift();
        eventList.push({
            month: monthNumber,
            events: {}
        });

        const home = await client.guilds.fetch(db.HOME);
        const log = await home.channels.fetch(db.LOG);
        const embed = {
            title: 'warn',
            description: 'Eventlist has been shifted.',
            color: 0xe4cf99
        }
        log.send({ embeds: [embed] });
    }
    eventListTimeout(client);

}

async function eventListTimeout(client) {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = date.getTime() - now.getTime();

    clearTimeout(shiftEventListTimer);
    if (diff > 2147483646) shiftEventListTimer = setTimeout(() => eventListTimeout(client), 2147400000);
    else shiftEventListTimer = setTimeout(() => shiftEventList(client), diff);
}