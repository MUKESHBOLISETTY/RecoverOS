import { saveConnectionSchema } from '../validators/connectors.validator.js';

class ConnectorsController {
  /**
   * @param {import('../domain/connectors/connector.manager.js').default} connectorManager 
   */
  constructor(connectorManager) {
    this.connectorManager = connectorManager;
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
}

export default ConnectorsController;
