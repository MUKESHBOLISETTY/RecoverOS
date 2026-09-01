import RazorpayConnector from './razorpay-connector.js';
import GmailConnector from './gmail-connector.js';
import GoogleSheetsConnector from './google-sheets.connector.js';
import ShopifyConnector from './shopify-connector.js';

class ConnectorFactory {
  constructor() {
    /** @type {Map<string, import('../../domain/connectors/connector.interface.js').default>} */
    this.connectors = new Map();

    const razorpay = new RazorpayConnector();
    this.connectors.set(razorpay.getMetadata().id, razorpay);

    const gmail = new GmailConnector();
    this.connectors.set(gmail.getMetadata().id, gmail);

    const sheets = new GoogleSheetsConnector();
    this.connectors.set(sheets.getMetadata().id, sheets);

    const shopify = new ShopifyConnector();
    this.connectors.set(shopify.getMetadata().id, shopify);
  }

  /**
   * @param {string} connectorId 
   * @returns {import('../../domain/connectors/connector.interface.js').default}
   */
  getConnector(connectorId) {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found or not supported.`);
    }
    return connector;
  }

  getAllConnectorsMetadata() {
    return Array.from(this.connectors.values()).map(connector => connector.getMetadata());
  }
}

export default ConnectorFactory;
