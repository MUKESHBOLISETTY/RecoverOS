import Razorpay from 'razorpay';
import { OrderRepository } from '../../domain/recovery/order.repository.js';

export class RazorpayOrderRepository extends OrderRepository {
    /**
     * @param {object} [credentials]
     * @param {string} [credentials.keyId]
     * @param {string} [credentials.keySecret]
     */
    constructor(credentials = {}) {
        super();
        const keyId = credentials.keyId;
        const keySecret = credentials.keySecret;

        if (!keyId || !keySecret) {
            throw new Error(
                'RazorpayOrderRepository: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be provided either via credentials or environment variables.'
            );
        }

        this.razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }

    /**
     * @param {string} orderId 
     * @returns {Promise<Object>}
     */
    async findById(orderId) {
        try {
            return await this.razorpay.orders.fetch(orderId);
        } catch (error) {
            throw new Error(`RazorpayOrderRepository: Failed to fetch order ${orderId}: ${error.message}`);
        }
    }
}
