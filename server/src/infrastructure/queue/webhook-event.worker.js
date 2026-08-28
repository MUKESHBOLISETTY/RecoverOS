import { BaseWorkerService } from './base-worker.service.js';

export class WebhookEventWorker extends BaseWorkerService {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     * @param {import('../db/webhook/prisma-webhook-event.repository.js').PrismaWebhookEventRepository} webhookEventRepository
     * @param {import('../webhooks/webhook.service.js').WebhookService} webhookService 
     */
    constructor(prisma, webhookEventRepository, webhookService) {
        super('webhook-events');
        this.prisma = prisma;
        this.webhookEventRepository = webhookEventRepository;
        this.webhookService = webhookService;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        const { connectionId, source, idempotencyKey, eventType, eventCategory, payload } = job.data;
        console.log(`[WebhookEventWorker] Processing job ${job.id} for source ${source} (connection: ${connectionId}) and key ${idempotencyKey}`);

        try {
            const postCommitHooks = [];
            await this.prisma.$transaction(async (tx) => {
                let eventRecord = await this.webhookEventRepository.findByIdempotencyKey(source, idempotencyKey, tx);

                if (eventRecord) {
                    if (eventRecord.status === 'COMPLETED') {
                        console.log(`[WebhookEventWorker] Event ${source}:${idempotencyKey} is already COMPLETED in DB. Skipping processing.`);
                        return;
                    }
                    eventRecord = await this.webhookEventRepository.update(eventRecord.id, { status: 'PENDING', errorReason: null }, tx);
                } else {
                    eventRecord = await this.webhookEventRepository.create({
                        source,
                        idempotencyKey,
                        eventType,
                        payload,
                        status: 'PENDING'
                    }, tx);
                }

                const handler = this.webhookService.handlers.get(eventCategory || 'unknown');
                if (!handler) {
                    throw new Error(`No webhook handler found for category: ${eventCategory}`);
                }

                await handler.handle({
                    connectionId,
                    body: payload,
                    eventType,
                    eventId: eventRecord.id,
                    externalEventId: eventRecord.idempotencyKey,
                    provider: source,
                    _tx: tx,
                    postCommitHooks
                });

                await this.webhookEventRepository.update(eventRecord.id, { status: 'COMPLETED' }, tx);
            }, {
                timeout: 15000
            });

            for (const hook of postCommitHooks) {
                try {
                    await hook();
                } catch (hookError) {
                    console.error(`[WebhookEventWorker] Failed to execute post-commit hook for job ${job.id}:`, hookError);
                }
            }

            console.log(`[WebhookEventWorker] Successfully processed job ${job.id}`);
        } catch (error) {
            console.error(`[WebhookEventWorker] Failed to process job ${job.id}:`, error);

            try {
                await this.webhookEventRepository.markFailed(source, idempotencyKey, error.message || 'Unknown error');
            } catch (dbError) {
                console.error(`[WebhookEventWorker] Failed to update error status for ${job.id}:`, dbError);
            }

            throw error;
        }
    }
}
