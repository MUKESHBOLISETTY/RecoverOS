import { google } from 'googleapis';
import crypto from 'crypto';

class GoogleOAuthService {
    /**
     * @param {Object} deps
     * @param {import('../../domain/connectors/connector.manager.js').default} deps.connectorManager
     * @param {import('../cache/base-cache.service.js').BaseCacheService} deps.cacheService
     */
    constructor({ connectorManager, cacheService }) {
        if (!connectorManager) throw new Error('GoogleOAuthService: connectorManager is required');
        if (!cacheService) throw new Error('GoogleOAuthService: cacheService is required');
        this.connectorManager = connectorManager;
        this.cacheService = cacheService;
    }

    /**
     * @param {string} userId
     * @param {string} clientId 
     * @param {string} clientSecret 
     * @param {string} redirectUri 
     * @returns {Promise<string>} Google Auth URL
     */
    async generateAuthUrl(userId, clientId, clientSecret, redirectUri) {
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Missing required OAuth parameters');
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const state = crypto.randomBytes(32).toString('hex');

        const tempKey = `oauth:google:state:${state}`;
        await this.cacheService.setJson(tempKey, {
            userId,
            clientId,
            clientSecret,
            redirectUri
        }, 900);

        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
            state: state
        });

        return url;
    }

    /**
     * @param {string} state 
     * @param {string} code 
     */
    async handleCallback(state, code) {
        if (!state || !code) {
            throw new Error('Missing state or code in callback');
        }

        const tempKey = `oauth:google:state:${state}`;
        const tempData = await this.cacheService.getJson(tempKey);

        if (!tempData) {
            throw new Error('Invalid or expired OAuth state');
        }

        const { userId, clientId, clientSecret, redirectUri } = tempData;

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token returned by Google. You must force consent.');
        }

        const rawCredentials = {
            clientId,
            clientSecret,
            refreshToken: tokens.refresh_token
        };

        const connectionName = `Gmail (${new Date().toISOString().split('T')[0]})`;

        await this.connectorManager.saveConnection(
            userId,
            'gmail',
            connectionName,
            rawCredentials
        );

        await this.cacheService.del(tempKey);

        return { success: true, message: 'Gmail connected successfully.' };
    }
}

export default GoogleOAuthService;
