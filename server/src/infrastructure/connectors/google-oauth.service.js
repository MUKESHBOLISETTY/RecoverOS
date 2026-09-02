import { google } from 'googleapis';
import crypto from 'crypto';

const GOOGLE_OAUTH_CONFIG = {
    gmail: {
        scopes: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly'
        ]
    },
    google_sheets: {
        scopes: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    }
};

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
     * @param {string} [connectorId='gmail']
     * @returns {Promise<string>} Google Auth URL
     */
    async generateAuthUrl(userId, clientId, clientSecret, redirectUri, connectorId = 'gmail') {
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Missing required OAuth parameters');
        }

        const config = GOOGLE_OAUTH_CONFIG[connectorId];
        if (!config) {
            throw new Error(`Unsupported connectorId for Google OAuth: ${connectorId}`);
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const state = crypto.randomBytes(32).toString('hex');

        const tempKey = `oauth:google:state:${state}`;
        const saved = await this.cacheService.setJson(tempKey, {
            userId,
            clientId,
            clientSecret,
            redirectUri,
            connectorId
        }, 900);

        if (!saved) {
            throw new Error('Failed to securely store OAuth state. Cache service is unavailable.');
        }

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: config.scopes,
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

        const { userId, clientId, clientSecret, redirectUri, connectorId = 'gmail' } = tempData;

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token returned by Google. You must force consent.');
        }


        if (connectorId === 'google_sheets') {
            const tempAuthId = crypto.randomBytes(16).toString('hex');
            const sheetsKey = `temp_sheets_auth:${tempAuthId}`;
            const saved = await this.cacheService.setJson(sheetsKey, {
                userId,
                clientId,
                clientSecret,
                refreshToken: tokens.refresh_token,
                connectorId
            }, 1800);

            if (!saved) {
                throw new Error('Failed to securely store Google Sheets auth state. Cache service is unavailable.');
            }

            await this.cacheService.del(tempKey);
            return {
                success: true,
                requiresResourceSelection: true,
                tempAuthId,
                message: 'Google Sheets authorized. Please select a spreadsheet.'
            };
        }

        const rawCredentials = {
            clientId,
            clientSecret,
            refreshToken: tokens.refresh_token
        };

        const connectionName = `Gmail (${new Date().toISOString().split('T')[0]})`;

        const connection = await this.connectorManager.saveConnection(
            userId,
            'gmail',
            connectionName,
            rawCredentials
        );

        await this.cacheService.del(tempKey);

        return { success: true, requiresResourceSelection: false, message: 'Gmail connected successfully.', connection, userId };
    }

    async getGoogleSpreadsheets(tempAuthId) {
        if (!tempAuthId) throw new Error('Missing tempAuthId');
        const sheetsKey = `temp_sheets_auth:${tempAuthId}`;
        const tempData = await this.cacheService.getJson(sheetsKey);

        if (!tempData) throw new Error('Invalid or expired temp auth state');

        const oauth2Client = new google.auth.OAuth2(tempData.clientId, tempData.clientSecret);
        oauth2Client.setCredentials({ refresh_token: tempData.refreshToken });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        try {
            const res = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.spreadsheet'",
                fields: 'files(id, name)'
            });
            return res.data.files;
        } catch (error) {
            console.error('Error fetching spreadsheets:', error);
            throw new Error('Failed to fetch spreadsheets from Google Drive');
        }
    }

    async finalizeSheetsConnection(userId, tempAuthId, spreadsheetId, worksheetName, channel = 'sms') {
        const sheetsKey = `temp_sheets_auth:${tempAuthId}`;
        const tempData = await this.cacheService.getJson(sheetsKey);

        if (!tempData) throw new Error('Invalid or expired temp auth state');

        const { clientId, clientSecret, refreshToken } = tempData;

        const connections = await this.connectorManager.getUserConnections(userId);
        const existingConnection = connections.find(c => c.connectorId === 'google_sheets');

        let rawCredentials;

        if (existingConnection) {
            const existingDecrypted = await this.connectorManager.getDecryptedCredentialsById(existingConnection.id);
            if (!existingDecrypted) throw new Error('Failed to decrypt existing Google Sheets connection');

            rawCredentials = {
                ...existingDecrypted,
                clientId,
                clientSecret,
                refreshToken,
                channels: {
                    ...(existingDecrypted.channels || {}),
                    [channel]: {
                        spreadsheetId,
                        worksheetName
                    }
                }
            };

            await this.connectorManager.removeConnection(existingConnection.id, userId);

        } else {
            rawCredentials = {
                clientId,
                clientSecret,
                refreshToken,
                channels: {
                    [channel]: {
                        spreadsheetId,
                        worksheetName
                    }
                }
            };
        }

        const connectorId = `google_sheets`;
        const connectionName = `Google Sheets (${new Date().toISOString().split('T')[0]})`;

        const connection = await this.connectorManager.saveConnection(
            userId,
            connectorId,
            connectionName,
            rawCredentials
        );

        await this.cacheService.del(sheetsKey);
        return connection;
    }
}

export default GoogleOAuthService;
