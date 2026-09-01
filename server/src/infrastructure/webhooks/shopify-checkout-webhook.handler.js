import { BaseWebhookHandler } from './base-webhook.handler.js';

export class ShopifyCheckoutWebhookHandler extends BaseWebhookHandler {
    /**
     * @param {import('../queue/shopify-abandonment.queue.js').ShopifyAbandonmentQueue} shopifyAbandonmentQueueService
     */
    constructor(shopifyAbandonmentQueueService) {
        super('checkouts');
        this.shopifyAbandonmentQueueService = shopifyAbandonmentQueueService;
    }

    async handle({ body, eventType, eventId, provider, _tx, postCommitHooks }) {
        if (provider !== 'SHOPIFY') {
            throw new Error(`ShopifyCheckoutWebhookHandler received event from unknown provider: ${provider}`);
        }

        if (eventType !== 'checkouts/update') {
            console.log(`[ShopifyCheckoutWebhookHandler] Ignoring unhandled eventType: ${eventType}`);
            return;
        }

        const token = body.token;
        if (!token) {
            const err = new Error(`[ShopifyCheckoutWebhookHandler] Missing token in payload for event ${eventId}`);
            err.statusCode = 400;
            throw err;
        }

        const shopDomain = body._shopifyHeaders?.shopDomain;
        if (!shopDomain) {
            const err = new Error(`[ShopifyCheckoutWebhookHandler] Missing shopDomain in _shopifyHeaders for event ${eventId}`);
            err.statusCode = 400;
            throw err;
        }

        const checkoutUpdatedAt = body.updated_at;

        console.log(`[ShopifyCheckoutWebhookHandler] Received checkouts/update for shop: ${shopDomain}, token: ${token}`);

        postCommitHooks.push(async () => {
            const job = await this.shopifyAbandonmentQueueService.scheduleVerification({
                shopDomain,
                checkoutToken: token,
                webhookEventId: eventId,
                checkoutUpdatedAt
            });
            console.log(`[ShopifyCheckoutWebhookHandler] Scheduled verification job ${job.id} for token ${token}`);
        });
    }
}
