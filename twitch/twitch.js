import 'dotenv/config';

async function getSubscribers(broadcasterId, clientId, accountAccessToken) {
    const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accountAccessToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Error getting subscribers: ${error}`);
    }
}


async function filterSubscribersLastWeek(broadcasterId, clientId, accountAccessToken) {
    const subscribers = await getSubscribers(broadcasterId, clientId, accountAccessToken);
    console.log(subscribers)

    const oneWeekAgo = Date.now() - (7 * 86400000);

    const recentSubscribers = subscribers.filter(subscriber => {
        const subscribeDate = new Date(subscriber.created_at).getTime();
        return subscribeDate > oneWeekAgo;
    });

    recentSubscribers.forEach(subscriber => console.log(subscriber.user_name));
}


async function getFollowers(broadcasterId, clientId, accessToken) {
    const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error getting followers: ${error}`);
    }
}

export async function twitch(accessToken, broadcasterId) {
    const clientId = process.env.TWITCH_ID;

    const followers = await getFollowers(broadcasterId, clientId, accessToken);
    console.log(followers);

    const subs = await getSubscribers(broadcasterId, clientId, accessToken);
    console.log(subs)
    //filterSubscribersLastWeek(broadcasterId, clientId, accessToken);



}