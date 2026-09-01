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

    if (this.cacheService) {
      await this.cacheService.del(`connector_credentials:ids:${connectorId}`);
    }

    return { id: result.id, connectorId, name, category: metadata.category };
  }

  /**
   * @param {string} id
   * @param {Object} rawCredentials
   */
  async updateConnection(id, rawCredentials) {
    const { encryptedData, iv, authTag } = this.encryptionService.encrypt(rawCredentials);
    await this.credentialRepository.update(id, { encryptedData, iv, authTag });
    
    if (this.cacheService) {
      await this.cacheService.del(`connector_credential:${id}`);
    }
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
      const record = await this.credentialRepository.findById(connectionId);
      if (record) {
        await this.cacheService.del(`connector_credential:${connectionId}`);
        await this.cacheService.del(`connector_credentials:ids:${record.connectorId}`);
      }
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
   * @param {string} connectorId
   */
  async getDecryptedCredentialsById(id) {
    if (!id) return null;
    let record = null;
    const cacheKey = `connector_credential:${id}`;

    if (this.cacheService) {
      record = await this.cacheService.getJson(cacheKey);
    }

    if (!record) {
      record = await this.credentialRepository.findById(id);
      if (record && this.cacheService) {
        await this.cacheService.setJson(cacheKey, record, 3600);
      }
    }

    if (!record) return null;
    return this.encryptionService.decrypt(record.encryptedData, record.iv, record.authTag);
  }

  /**
   * @param {string} connectorId
   * @returns {Promise<Array<{id: string, userId: string, connectorId: string}>>}
   */
  async getAllConnectionIds(connectorId) {
    const cacheKey = `connector_credentials:ids:${connectorId}`;
    let ids = null;

    if (this.cacheService) {
      ids = await this.cacheService.getJson(cacheKey);
    }

    if (!ids) {
      ids = await this.credentialRepository.findIdsByConnectorId(connectorId);
      if (this.cacheService && ids) {
        await this.cacheService.setJson(cacheKey, ids, 3600);
      }
    }

    return ids || [];
  }

  /**
   * @param {string} connectorId
   * @returns {Promise<Array<{id: string, userId: string, credentials: Object}>>}
   */
  async getAllDecryptedCredentialsByConnectorId(connectorId) {
    const connections = await this.getAllConnectionIds(connectorId);
    
    const results = [];
    for (const conn of connections) {
      const credentials = await this.getDecryptedCredentialsById(conn.id);
      if (credentials) {
        results.push({
          id: conn.id,
          userId: conn.userId,
          credentials
        });
      }
    }
    
    return results;
  }

  /**
   * @param {string} connectionId 
   * @returns {Promise<Array<string>>}
   */
  async getConnectorCapabilities(connectionId) {
    if (!connectionId) return [];

    const cacheKey = `connector_capabilities:${connectionId}`;
    if (this.cacheService) {
      const cached = await this.cacheService.getJson(cacheKey);
      if (cached) return cached;
    }

    return this.syncConnectorCapabilities(connectionId);
  }

  /**
   * @param {string} connectionId 
   * @returns {Promise<Array<string>>}
   */
  async syncConnectorCapabilities(connectionId) {
    if (!connectionId) return [];

    const credentials = await this.getDecryptedCredentialsById(connectionId);
    if (!credentials) return [];

    const record = await this.credentialRepository.findById(connectionId);
    if (!record || !record.connectorId) return [];

    const connector = this.connectorFactory.getConnector(record.connectorId);
    if (!connector) return [];

    const metadata = connector.getMetadata();
    const staticCaps = metadata.capabilities || [];
    
    const dynamicCaps = await connector.getDynamicCapabilities(credentials);

    const capabilities = [...new Set([...staticCaps, ...dynamicCaps])];

    if (this.cacheService) {
      const cacheKey = `connector_capabilities:${connectionId}`;
      await this.cacheService.setJson(cacheKey, capabilities, 3600); // 1 hour
    }

    return capabilities;
  }
}

export default ConnectorManager;
