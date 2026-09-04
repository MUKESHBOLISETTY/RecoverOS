import { saveConnectionSchema } from '../validators/connectors.validator.js';

class ConnectorsController {
  /**
   * @param {import('../domain/connectors/connector.manager.js').default} connectorManager 
   * @param {import('../infrastructure/connectors/google-oauth.service.js').default} googleOAuthService
   * @param {import('../domain/agent/agent.repository.js').AgentRepository} agentRepository
   * @param {import('../infrastructure/connectors/shopify-oauth.service.js').default} shopifyOAuthService
   */
  constructor(connectorManager, googleOAuthService, agentRepository, shopifyOAuthService) {
    this.connectorManager = connectorManager;
    this.googleOAuthService = googleOAuthService;
    this.agentRepository = agentRepository;
    this.shopifyOAuthService = shopifyOAuthService;
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

      if (this.agentRepository) {
        await this.agentRepository.attachCredentialToActiveAgents(userId, connection.id);
      }

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
      const { clientId, clientSecret, redirectUri, connectorId = 'gmail' } = req.body;

      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({ success: false, error: 'clientId, clientSecret, and redirectUri are required' });
      }

      const authUrl = await this.googleOAuthService.generateAuthUrl(userId, clientId, clientSecret, redirectUri, connectorId);
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

      if (typeof state !== 'string' || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid query parameters: must be strings' });
      }

      const result = await this.googleOAuthService.handleCallback(state, code);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      if (result.success) {
        if (!result.requiresResourceSelection && this.agentRepository && result.connection) {
          await this.agentRepository.attachCredentialToActiveAgents(result.userId, result.connection.id);
        }
        if (result.requiresResourceSelection) {
          return res.redirect(`${frontendUrl}/onboarding?google=sheets&tempAuthId=${result.tempAuthId}`);
        }
        return res.redirect(`${frontendUrl}/onboarding?google=success`);
      } else {
        return res.redirect(`${frontendUrl}/onboarding?google=error`);
      }
    } catch (error) {
      console.error('Error handling Google callback:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getGoogleSpreadsheets = async (req, res) => {
    try {
      const { tempAuthId } = req.query;
      if (!tempAuthId) return res.status(400).json({ success: false, error: 'tempAuthId is required' });

      const spreadsheets = await this.googleOAuthService.getGoogleSpreadsheets(tempAuthId);
      res.json({ success: true, data: spreadsheets });
    } catch (error) {
      console.error('Error fetching spreadsheets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  finalizeSheetsConnection = async (req, res) => {
    try {
      const userId = req.user.id;
      const { tempAuthId, spreadsheetId, worksheetName, channel } = req.body;

      if (!tempAuthId || !spreadsheetId || !worksheetName) {
        return res.status(400).json({ success: false, error: 'tempAuthId, spreadsheetId, and worksheetName are required' });
      }

      const connection = await this.googleOAuthService.finalizeSheetsConnection(userId, tempAuthId, spreadsheetId, worksheetName, channel);

      if (this.agentRepository && connection) {
        await this.agentRepository.attachCredentialToActiveAgents(userId, connection.id);
      }

      res.status(201).json({ success: true, data: connection });
    } catch (error) {
      console.error('Error finalizing sheets connection:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  initShopifyOAuth = async (req, res) => {
    try {
      const userId = req.user.id;
      const { clientId, clientSecret, redirectUri, shopDomain } = req.body;

      if (!clientId || !clientSecret || !redirectUri || !shopDomain) {
        return res.status(400).json({ success: false, error: 'clientId, clientSecret, redirectUri, and shopDomain are required' });
      }

      const authUrl = await this.shopifyOAuthService.generateAuthUrl(userId, clientId, clientSecret, redirectUri, shopDomain);
      res.json({ success: true, url: authUrl });
    } catch (error) {
      console.error('Error initializing Shopify OAuth:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  handleShopifyCallback = async (req, res) => {
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    try {
      const { state, code, shop } = req.query;

      if (!state || !code || !shop) {
        return res.redirect(`${frontendUrl}/onboarding?shopify=error`);
      }

      if (typeof state !== 'string' || typeof code !== 'string' || typeof shop !== 'string') {
        return res.redirect(`${frontendUrl}/onboarding?shopify=error`);
      }

      const result = await this.shopifyOAuthService.handleCallback(state, code, shop);

      if (result.success && this.agentRepository && result.connection && !result.isReconnect) {
        await this.agentRepository.attachCredentialToActiveAgents(result.userId, result.connection.id);
      }

      if (result.success) {
        return res.redirect(`${frontendUrl}/onboarding?shopify=success`);
      } else {
        return res.redirect(`${frontendUrl}/onboarding?shopify=error`);
      }
    } catch (error) {
      console.error('Error handling Shopify callback:', error);
      return res.redirect(`${frontendUrl}/onboarding?shopify=error`);
    }
  };
}

export default ConnectorsController;
