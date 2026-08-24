class ConnectorCredentialRepository {
  /**
   * @param {string} userId 
   * @param {string} connectorId 
   */
  async findByUserAndConnector(userId, connectorId) {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {string} connectorId 
   */
  async findFirstByConnectorId(connectorId) {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {Object} data 
   * @param {string} data.userId
   * @param {string} data.connectorId
   * @param {string} data.category
   * @param {string} data.name
   * @param {string} data.encryptedData
   * @param {string} data.iv
   * @param {string} data.authTag
   */
  async create(data) {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {string} userId 
   */
  async listByUser(userId) {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {string} id 
   * @param {string} userId 
   */
  async delete(id, userId) {
    throw new Error('Method not implemented.');
  }
}

export default ConnectorCredentialRepository;
