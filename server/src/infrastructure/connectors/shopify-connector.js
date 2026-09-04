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
    const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

    // Attempt checkout_token first
    let query = `
      query {
        orders(first: 1, query: "checkout_token:${token}") {
          edges {
            node {
              id
              fullyPaid
              displayFinancialStatus
              displayFulfillmentStatus
            }
          }
        }
      }
    `;

    let order = await this._executeGraphQL(url, accessToken, query, 'checkout_token');
    if (order) return { ...order, tokenType: 'checkout_token', checkoutToken: token };

    // Fallback to cart_token
    query = `
      query {
        orders(first: 1, query: "cart_token:${token}") {
          edges {
            node {
              id
              fullyPaid
              displayFinancialStatus
              displayFulfillmentStatus
            }
          }
        }
      }
    `;

    order = await this._executeGraphQL(url, accessToken, query, 'cart_token');
    if (order) return { ...order, tokenType: 'cart_token', cartToken: token };

    return null;
  }

  async _executeGraphQL(url, accessToken, query, type) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
    } catch (err) {
      throw new Error(`Shopify API network error (${type}): ${err.message}`);
    }

    if (!response.ok) {
      throw new Error(`Shopify API error (${type}): HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Shopify GraphQL error (${type}): ${JSON.stringify(data.errors)}`);
    }

    const edges = data.data?.orders?.edges;
    if (edges && edges.length > 0) {
      return edges[0].node;
    }

    return null;
  }
}

export default ShopifyConnector;
