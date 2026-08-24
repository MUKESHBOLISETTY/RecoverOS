import ConnectorInterface from '../../domain/connectors/connector.interface.js';
import Razorpay from 'razorpay';

class RazorpayConnector extends ConnectorInterface {
  getMetadata() {
    return {
      id: 'razorpay',
      name: 'Razorpay',
      category: 'DATA_SOURCE',
      fields: [
        { name: 'keyId', type: 'string', required: true, label: 'Key ID' },
        { name: 'keySecret', type: 'password', required: true, label: 'Key Secret' }
      ]
    };
  }

  async validateCredentials(credentials) {
    if (!credentials.keyId || !credentials.keySecret) {
      throw new Error('Razorpay requires keyId and keySecret');
    }

    try {
      const rzp = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret
      });

      await rzp.payments.all({ count: 1 });
      return true;
    } catch (error) {
      console.error('Razorpay credentials validation failed:', error);
      return false;
    }
  }
}

export default RazorpayConnector;
