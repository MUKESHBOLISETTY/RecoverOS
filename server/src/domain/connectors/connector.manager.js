class ConnectorManager {
  /**
   * @param {Object} deps 
   * @param {import('../../infrastructure/connectors/connector.factory.js').default} deps.connectorFactory
   * @param {import('./credential-encryption.service.js').default} deps.encryptionService
   * @param {import('./connector-credential.repository.js').default} deps.credentialRepository
   */
  constructor({ connectorFactory, encryptionService, credentialRepository }) {
    this.connectorFactory = connectorFactory;
    this.encryptionService = encryptionService;
    this.credentialRepository = credentialRepository;
  }

  /**
   * @param {string} userId
   * @param {string} connectorId
   * @param {string} name
   * @param {Object} rawCredentials 
   */
  async saveConnection(userId, connectorId, name, rawCredentials) {
    const connector = this.connectorFactory.getConnector(connectorId);

    const isValid = await connector.validateCredentials(rawCredentials);
    if (!isValid) {
      throw new Error(`Invalid credentials for ${connectorId}`);
    }

    const { encryptedData, iv, authTag } = this.encryptionService.encrypt(rawCredentials);
    const metadata = connector.getMetadata();

    const result = await this.credentialRepository.create({
      userId,
      connectorId,
      category: metadata.category,
      name,
      encryptedData,
      iv,
      authTag
    });

    return { id: result.id, connectorId, name, category: metadata.category };
  }

  /**
   * @param {string} userId 
   */
  async getUserConnections(userId) {
    const list = await this.credentialRepository.listByUser(userId);
    return list.map(item => ({
      id: item.id,
      connectorId: item.connectorId,
      category: item.category,
      name: item.name,
      createdAt: item.createdAt
    }));
  }

  /**
   * @param {string} connectionId 
   * @param {string} userId 
   */
  async removeConnection(connectionId, userId) {
    return this.credentialRepository.delete(connectionId, userId);
  }

  getAvailableConnectors() {
    return this.connectorFactory.getAllConnectorsMetadata();
  }
}

export default ConnectorManager;
