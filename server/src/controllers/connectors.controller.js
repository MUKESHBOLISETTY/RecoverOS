import { saveConnectionSchema } from '../validators/connectors.validator.js';

class ConnectorsController {
  /**
   * @param {import('../domain/connectors/connector.manager.js').default} connectorManager 
   * @param {import('../infrastructure/connectors/google-oauth.service.js').default} googleOAuthService
   */
  constructor(connectorManager, googleOAuthService) {
    this.connectorManager = connectorManager;
    this.googleOAuthService = googleOAuthService;
  }

  getAvailableConnectors = (req, res) => {
    try {
      const connectors = this.connectorManager.getAvailableConnectors();
      res.json({ success: true, data: connectors });
    } catch (error) {
      console.error('Error fetching available connectors:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch available connectors' });
    }
  };

  getUserConnections = async (req, res) => {
    try {
      const userId = req.user.id;
      const connections = await this.connectorManager.getUserConnections(userId);
      res.json({ success: true, data: connections });
    } catch (error) {
      console.error('Error fetching user connections:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch connections' });
    }
  };

  saveConnection = async (req, res) => {
    try {
      const userId = req.user.id;
      const parsed = saveConnectionSchema.parse(req.body);

      const connection = await this.connectorManager.saveConnection(
        userId,
        parsed.connectorId,
        parsed.name,
        parsed.credentials
      );

      res.status(201).json({ success: true, data: connection });
    } catch (error) {
      console.error('Error saving connection:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  };

  deleteConnection = async (req, res) => {
    try {
      const userId = req.user.id;
      const connectionId = req.params.id;

      await this.connectorManager.removeConnection(connectionId, userId);
      res.json({ success: true, message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Error deleting connection:', error);
      res.status(500).json({ success: false, error: 'Failed to delete connection' });
    }
  };

  syncConnection = async (req, res) => {
    try {
      const userId = req.user.id;
      const connectionId = req.params.id;

      const connections = await this.connectorManager.getUserConnections(userId);
      const ownsConnection = connections.some(c => c.id === connectionId);
      if (!ownsConnection) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      const capabilities = await this.connectorManager.syncConnectorCapabilities(connectionId);
      res.json({ success: true, data: capabilities, message: 'Capabilities synced successfully' });
    } catch (error) {
      console.error('Error syncing connection capabilities:', error);
      res.status(500).json({ success: false, error: 'Failed to sync connection capabilities' });
    }
  };

  initGoogleOAuth = async (req, res) => {
    try {
      const userId = req.user.id;
      const { clientId, clientSecret, redirectUri } = req.body;
      
      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({ success: false, error: 'clientId, clientSecret, and redirectUri are required' });
      }

      const authUrl = await this.googleOAuthService.generateAuthUrl(userId, clientId, clientSecret, redirectUri);
      res.json({ success: true, url: authUrl });
    } catch (error) {
      console.error('Error initializing Google OAuth:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  handleGoogleCallback = async (req, res) => {
    try {
      const { state, code } = req.query;

      if (!state || !code) {
        return res.status(400).json({ success: false, error: 'Missing state or code' });
      }

      const result = await this.googleOAuthService.handleCallback(state, code);
      res.json({ success: true, message: result.message });
    } catch (error) {
      console.error('Error handling Google callback:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

export default ConnectorsController;
