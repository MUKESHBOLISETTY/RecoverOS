import { BaseWorkerService } from './base-worker.service.js';

export class ShopifyAbandonmentWorker extends BaseWorkerService {
    /**
     * @param {import('../../domain/recovery/shopify-abandonment.service.js').ShopifyAbandonmentService} shopifyAbandonmentService
     */
    constructor(shopifyAbandonmentService) {
        super('shopifyAbandonmentQueue');
        this.shopifyAbandonmentService = shopifyAbandonmentService;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        return this.shopifyAbandonmentService.processAbandonment({
            shopDomain: job.data.shopDomain,
            checkoutToken: job.data.checkoutToken,
            webhookEventId: job.data.webhookEventId,
            checkoutUpdatedAt: job.data.checkoutUpdatedAt,
            jobId: job.id
        });
    }
}
