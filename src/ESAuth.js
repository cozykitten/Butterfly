import { db, sync } from './dbManager.js';
const authEndpoint = 'https://id.twitch.tv/oauth2/token';

/**
 * Represents an authentication object for interacting with Twitch's EventSub API.
 */
export default class ESAuth {
    clientId;
    clientSecret;
    accessToken;
    #refreshToken;
    broadcasterId;

    /**
     * Creates a new ESAuth instance.
     * 
     * @param {string} clientId Your apps client ID.
     * @param {string} clientSecret Your apps client secret.
     * @param {string} accessToken The current User Access Token to authenticate with.
     * @param {string} broadcasterId The broadcasterId of the user your access token is for.
     */
    constructor(clientId, clientSecret, accessToken, refreshToken, broadcasterId) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.accessToken = accessToken;
        this.#refreshToken = refreshToken;
        this.broadcasterId = broadcasterId;
    }

    /**
     * Refreshes a User Access Token after it expired.
     * @returns {Promise<string|boolean>} A promise that resolves to the new User Access Token on success or to false on failure.
     */
    async refreshUserAccessToken() {
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', this.#refreshToken);

        try {
            const response = await fetch(authEndpoint, {
                method: 'POST',
                body: params
            });
            const data = await response.json();
            this.accessToken = data.access_token;
            this.#refreshToken = data.refresh_token;
            db.eventSub.accessToken = data.access_token;
            db.eventSub.refreshToken = data.refresh_token;
            sync(db);
            return data.access_token;
        } catch (error) {
            console.error(`Error refreshing User Access Token: ${error}`);
            return false;
        }
    }
}