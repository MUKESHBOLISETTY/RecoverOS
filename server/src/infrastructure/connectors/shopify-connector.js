import ConnectorInterface from '../../domain/connectors/connector.interface.js';

class ShopifyConnector extends ConnectorInterface {
  getMetadata() {
    return {
      id: 'shopify',
      name: 'Shopify',
      category: 'DATA_SOURCE',
      fields: []
    };
  }

  async validateCredentials(credentials) {
    if (!credentials) return false;
    if (!credentials.shopDomain || !credentials.accessToken) {
      return false;
    }
    return true;
  }

  async getDynamicCapabilities(credentials) {
    const caps = [];
    if (credentials && credentials.scope && credentials.scope.includes('write_discounts')) {
      caps.push('commerce.discount.create');
    }
    return caps;
  }
}

export default ShopifyConnector;
