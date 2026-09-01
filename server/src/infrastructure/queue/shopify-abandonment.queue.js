import { BullQueueService } from './bull-queue.service.js';

export class ShopifyAbandonmentQueue extends BullQueueService {
    constructor() {
        super('shopifyAbandonmentQueue');
    }

    async scheduleVerification({ shopDomain, checkoutToken, webhookEventId, checkoutUpdatedAt }) {
        if (!shopDomain || !checkoutToken || !checkoutUpdatedAt) {
            throw new Error('Missing required fields for Shopify abandonment verification scheduling');
        }

        const safeTimestamp = new Date(checkoutUpdatedAt).getTime();
        const jobId = `shopify_abandonment_${shopDomain}_${checkoutToken}_${safeTimestamp}`;

        const delayMs = parseInt(process.env.SHOPIFY_CHECKOUT_ABANDONMENT_DELAY_MS || '60000', 10);

        return await this.addJob(
            'verify-abandonment',
            {
                shopDomain,
                checkoutToken,
                webhookEventId,
                checkoutUpdatedAt
            },
            {
                jobId,
                delay: delayMs,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        );
    }
}
