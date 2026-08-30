import ConnectorInterface from '../../domain/connectors/connector.interface.js';
import { google } from 'googleapis';

class GoogleSheetsConnector extends ConnectorInterface {
  getMetadata() {
    return {
      id: 'google_sheets',
      name: 'Google Sheets',
      category: 'COMMUNICATION_SOURCE',
      capabilities: [],
      fields: [
        { name: 'clientId', type: 'string', required: true, label: 'Client ID' },
        { name: 'clientSecret', type: 'password', required: true, label: 'Client Secret' },
        { name: 'refreshToken', type: 'password', required: true, label: 'Refresh Token' },
        { name: 'channels', type: 'object', required: false, label: 'Channels Config' }
      ]
    };
  }

  async validateCredentials(credentials) {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      throw new Error('Missing required Google OAuth credentials');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret
      );

      oauth2Client.setCredentials({
        refresh_token: credentials.refreshToken
      });

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      //verification
      await drive.files.list({ pageSize: 1 });

      return true;
    } catch (error) {
      console.error('Google Sheets credentials validation failed:', error);
      return false;
    }
  }

  async getDynamicCapabilities(credentials) {
    const caps = [];
    if (credentials?.channels && typeof credentials.channels === 'object') {
      for (const channel of Object.keys(credentials.channels)) {
        caps.push(`communication.${channel}`);
      }
    }
    return caps;
  }
}

export default GoogleSheetsConnector;
