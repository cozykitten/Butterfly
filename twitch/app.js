import { twitch } from './twitch.js';

async function getSubscribers() {
    const clientId = process.env.TWITCH_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const accessToken = await getTwitchAccessToken(clientId, clientSecret);
    const broadcasterId = await getTwitchBroadcasterId(clientId, accessToken);

    const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
              }
        });
        const data = await response.json();
        console.log(data);
    }
    catch (err) {
        console.error(err);
        return false;
    }
}

async function getChannelAccessToken(clientId, clientSecret, authCode) {
    const url = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('code', authCode);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', 'https://cozykitten.github.io/theme-modifications/oauthCallback.html');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params
        });
    
        const data = await response.json();
        console.log(data)
        return data.access_token;
    } catch (error) {
        console.error(`Error fetching Channel access token: ${error}`);
        return false;
    }
}

async function getTwitchAccessToken(clientId, clientSecret) {
    const url = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params
        });
    
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error(`Error fetching Twitch access token: ${error}`);
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
        console.error(`Error fetching Twitch broadcaster id: ${error}`);
        return false;
    }
}



const accessToken = await getTwitchAccessToken(process.env.TWITCH_ID, process.env.CLIENT_SECRET);
console.log('Access Token: ' + accessToken);

const broadcasterId = await getTwitchBroadcasterId(process.env.TWITCH_ID, accessToken, 'kekikitten');
console.log('Broadcaster Id: ' + broadcasterId)

const authCode = 'tiq08upcnyrolu13ttwk6zo4kz61m6';
const stateSet = 'ayy6cb4dyft89gpk';
const stateReturn = 'ayy6cb4dyft89gpk';

if (stateSet === stateReturn) {
    const channelAccessToken = await getChannelAccessToken(process.env.TWITCH_ID, process.env.CLIENT_SECRET, authCode);
    await twitch(accessToken, broadcasterId);
} else {
    console.warn("State parameter don't match!");
}
