class ConnectorInterface {
  /**
   * @returns {{ id: string, name: string, category: string, fields: Array<{name: string, type: string, required: boolean}> }}
   */
  getMetadata() {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {Object} credentials
   * @returns {Promise<boolean>}
   */
  async validateCredentials(credentials) {
    throw new Error('Method not implemented.');
  }

  /**
   * @param {Object} credentials 
   * @returns {Promise<Array<string>>}
   */
  async getDynamicCapabilities(credentials) {
    return [];
  }
}

export default ConnectorInterface;
