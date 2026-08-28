import ConnectorInterface from '../../domain/connectors/connector.interface.js';
import Razorpay from 'razorpay';

class RazorpayConnector extends ConnectorInterface {
  getMetadata() {
    return {
      id: 'razorpay',
      name: 'Razorpay',
      category: 'DATA_SOURCE',
      capabilities: [
        'payment.read',
        'order.read',
        'payment_link.create',
        'payment.read_status'
      ],
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

  async getDynamicCapabilities(credentials) {
    if (!credentials.keyId || !credentials.keySecret) {
      return [];
    }

    try {
      const rzp = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret
      });

      const webhooksResponse = await rzp.webhooks.all();
      const webhooks = webhooksResponse?.items || [];

      const events = new Set();
      for (const wh of webhooks) {
        if (wh.events && Array.isArray(wh.events)) {
          for (const ev of wh.events) {
            // Some events in razorpay might be boolean maps, but according to SDK it's array or object map. 
            // In Razorpay v1 API, events can be boolean mapped objects or arrays depending on response.
            if (typeof ev === 'string') {
              events.add(ev);
            } else if (typeof ev === 'object' && ev !== null) {
              for (const [eventName, isActive] of Object.entries(ev)) {
                if (isActive) {
                  events.add(eventName);
                }
              }
            }
          }
        } else if (wh.events && typeof wh.events === 'object') {
          for (const [eventName, isActive] of Object.entries(wh.events)) {
            if (isActive) {
              events.add(eventName);
            }
          }
        }
      }

      return Array.from(events);
    } catch (error) {
      console.error('Failed to fetch Razorpay dynamic capabilities:', error);
      return [];
    }
  }
}

export default RazorpayConnector;
