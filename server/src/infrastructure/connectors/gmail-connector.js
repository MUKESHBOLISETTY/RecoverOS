import ConnectorInterface from '../../domain/connectors/connector.interface.js';
import { google } from 'googleapis';

class GmailConnector extends ConnectorInterface {
  getMetadata() {
    return {
      id: 'gmail',
      name: 'Google Gmail',
      category: 'COMMUNICATION_SOURCE',
      capabilities: [
        'communication.email'
      ],
      fields: [
        { name: 'clientId', type: 'string', required: true, label: 'Client ID' },
        { name: 'clientSecret', type: 'password', required: true, label: 'Client Secret' },
        { name: 'refreshToken', type: 'password', required: true, label: 'Refresh Token' }
      ]
    };
  }

  async validateCredentials(credentials) {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      throw new Error('Gmail requires clientId, clientSecret, and refreshToken');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret
      );

      oauth2Client.setCredentials({
        refresh_token: credentials.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const res = await gmail.users.getProfile({ userId: 'me' });

      if (res.data && res.data.emailAddress) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Gmail credentials validation failed:', error);
      return false;
    }
  }

  async getDynamicCapabilities(credentials) {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      return [];
    }

    try {
      return ['email_send'];
    } catch (error) {
      console.error('Failed to fetch Gmail dynamic capabilities:', error);
      return [];
    }
  }
}

export default GmailConnector;
