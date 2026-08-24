class ConnectorManager {
  /**
   * @param {Object} deps 
   * @param {import('../../infrastructure/connectors/connector.factory.js').default} deps.connectorFactory
   * @param {import('./credential-encryption.service.js').default} deps.encryptionService
   * @param {import('./connector-credential.repository.js').default} deps.credentialRepository
   */
  constructor({ connectorFactory, encryptionService, credentialRepository, cacheService }) {
    this.connectorFactory = connectorFactory;
    this.encryptionService = encryptionService;
    this.credentialRepository = credentialRepository;
    this.cacheService = cacheService;
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
    if (this.cacheService) {
      await this.cacheService.del(`connector_credential:${connectionId}`);
    }
    return this.credentialRepository.delete(connectionId, userId);
  }

  getAvailableConnectors() {
    return this.connectorFactory.getAllConnectorsMetadata();
  }

  /**
   * @param {string} connectorId
   */
  async getGlobalDecryptedCredentials(connectorId) {
    const record = await this.credentialRepository.findFirstByConnectorId(connectorId);
    if (!record) return null;
    return this.encryptionService.decrypt(record.encryptedData, record.iv, record.authTag);
  }

  /**
   * @param {string} id
   */
  async getDecryptedCredentialsById(id) {
    if (!id) return null;
    let record = null;
    const cacheKey = `connector_credential:${id}`;

    if (this.cacheService) {
      record = await this.cacheService.get(cacheKey);
    }

    if (!record) {
      record = await this.credentialRepository.findById(id);
      if (record && this.cacheService) {
        await this.cacheService.set(cacheKey, record, 3600);
      }
    }

    if (!record) return null;
    return this.encryptionService.decrypt(record.encryptedData, record.iv, record.authTag);
  }
}

export default ConnectorManager;
