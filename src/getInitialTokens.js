import { env } from "custom-env";
env('development');
import { db, sync } from './utils/dbManager.js';
const authEndpoint = 'https://id.twitch.tv/oauth2/token';

/**
 * Obtain a User Access Token for the first time from the authorization code and your app's registered redirect url.
 * The new User Access Token and User Refresh Token are stored in the database.
 * 
 * @param {string} clientId Your apps client ID.
 * @param {string} clientSecret Your apps client secret.
 * @param {string} authCode The auth code received when a user authorizes your app.
 * @param {string} redirectUrl The registered redirect url of your app.
 * @throws {Error} If an error occurs during the request.
 */
async function getUserAccessToken(clientId, clientSecret, authCode, redirectUrl) {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('code', authCode);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUrl);

    try {
        const response = await fetch(authEndpoint, {
            method: 'POST',
            body: params
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching User Access Token:', error);
        throw error;
    }
}

/*
    if needed in application after initially getting broadcaster id, put this in ESAuth and implement refresh logic every time AppAccessToken is used.
*/
async function getAppAccessToken(clientId, clientSecret) {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    try {
        const response = await fetch(authEndpoint, {
            method: 'POST',
            body: params
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error fetching App Access Token:', error);
        return false;
    }
}

async function getTwitchBroadcasterId(clientId, accessToken, username) {
    const url = `https://api.twitch.tv/helix/users?login=${username}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        return data.data[0].id;
    } catch (error) {
        console.error('Error fetching Twitch broadcaster id:', error);
        return false;
    }
}

const authCode = '';
const username = '';

if (authCode) {
    const data = await getUserAccessToken(process.env.TWITCH_ID, process.env.TWITCH_SECRET, authCode, process.env.TWITCH_REDIRECT);
    db.eventSub.accessToken = data.access_token;
    db.eventSub.refreshToken = data.refresh_token;
}

const appAccessToken = await getAppAccessToken(process.env.TWITCH_ID, process.env.TWITCH_SECRET);
if (username) {
    const broadcasterId = await getTwitchBroadcasterId(process.env.TWITCH_ID, appAccessToken, username);
    db.eventSub.broadcasterId = broadcasterId;
}

sync(db);
console.log('app access token: ' + appAccessToken);