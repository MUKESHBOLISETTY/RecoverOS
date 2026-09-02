import { RecoveryVerifierInterface } from './recovery-verifier.interface.js';

export class ShopifyCommerceVerifier extends RecoveryVerifierInterface {
    /**
     * @param {import('../../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} paymentRepository
     * @param {import('../../../infrastructure/connectors/shopify-connector.js').ShopifyConnector} shopifyConnector
     * @param {import('../../connectors/connector.manager.js').default} connectorManager
     * @param {import('../../events/webhook-event.repository.js').WebhookEventRepository} webhookEventRepository
     */
    constructor(paymentRepository, shopifyConnector, connectorManager, webhookEventRepository) {
        super();
        this.paymentRepository = paymentRepository;
        this.shopifyConnector = shopifyConnector;
        this.connectorManager = connectorManager;
        this.webhookEventRepository = webhookEventRepository;
    }

    canVerify(recoveryCase) {
        const context = recoveryCase.contextSnapshot || {};
        return !!(context.checkout_token || context.cart_token);
    }

    async verify(recoveryCase) {
        try {
            const context = recoveryCase.contextSnapshot || {};
            const token = context.checkout_token || context.cart_token;

            if (!token) {
                return { state: 'UNKNOWN', evidence: { reason: 'missing_token_at_verify' } };
            }

            const credentials = await this._getExactCredentialsForPayment(recoveryCase.paymentId);
            if (!credentials) {
                return { state: 'UNKNOWN', evidence: { reason: 'missing_exact_shopify_credentials' } };
            }

            const { shopDomain } = credentials;

            if (context.checkout_token) {
                const localCheckoutOrder = await this.webhookEventRepository.findShopifyOrderCreateByCheckoutToken(shopDomain, context.checkout_token);
                if (localCheckoutOrder) {
                    return { state: 'RECOVERED', evidence: { token: context.checkout_token, source: 'local_webhook', eventId: localCheckoutOrder.id } };
                }
            }

            if (context.cart_token) {
                const localCartOrder = await this.webhookEventRepository.findShopifyOrderCreateByCartToken(shopDomain, context.cart_token);
                if (localCartOrder) {
                    return { state: 'RECOVERED', evidence: { token: context.cart_token, source: 'local_webhook', eventId: localCartOrder.id } };
                }
            }

            try {
                const order = await this.shopifyConnector.findOrderByToken(token, credentials);
                if (order && order.confirmed !== false) { // verified success
                    return { state: 'RECOVERED', evidence: { orderId: order.id, token, source: 'shopify_api' } };
                }

                return { state: 'UNKNOWN', evidence: { reason: 'no_completed_order_found' } };
            } catch (apiError) {
                console.warn(`[ShopifyCommerceVerifier] API Error for token ${token} on domain ${shopDomain}:`, apiError.message);
                return { state: 'UNKNOWN', evidence: { reason: 'api_failure', error: apiError.message } };
            }

        } catch (error) {
            console.error(`[ShopifyCommerceVerifier] Verification failed:`, error);
            return { state: 'UNKNOWN', evidence: { error: error.message } };
        }
    }

    async _getExactCredentialsForPayment(paymentId) {
        if (!paymentId) return null;
        const payment = await this.paymentRepository.findById(paymentId);
        if (!payment || !payment.connectionId) {
            return null;
        }

        return this.connectorManager.getDecryptedCredentialsById(payment.connectionId);
    }
}
