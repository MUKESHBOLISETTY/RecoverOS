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

  async findOrderByToken(token, credentials) {
    if (!await this.validateCredentials(credentials)) {
      throw new Error('Invalid Shopify credentials');
    }

    const { shopDomain, accessToken } = credentials;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

    let url = `https://${shopDomain}/admin/api/${apiVersion}/orders.json?checkout_token=${token}&status=any`;
    let response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error (checkout_token): ${response.status} ${response.statusText}`);
    }

    let data = await response.json();
    if (data.orders && data.orders.length > 0) {
      return data.orders[0];
    }

    url = `https://${shopDomain}/admin/api/${apiVersion}/orders.json?cart_token=${token}&status=any`;
    response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error (cart_token): ${response.status} ${response.statusText}`);
    }

    data = await response.json();
    if (data.orders && data.orders.length > 0) {
      return data.orders[0];
    }

    return null;
  }
}

export default ShopifyConnector;
