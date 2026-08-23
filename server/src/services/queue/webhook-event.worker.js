import { BaseWorkerService } from './base-worker.service.js';

export class WebhookEventWorker extends BaseWorkerService {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma 
     * @param {import('../webhook.service.js').WebhookService} webhookService 
     */
    constructor(prisma, webhookService) {
        super('webhook-events');
        this.prisma = prisma;
        this.webhookService = webhookService;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        const { source, idempotencyKey, eventType, eventCategory, payload } = job.data;
        console.log(`[WebhookEventWorker] Processing job ${job.id} for source ${source} and key ${idempotencyKey}`);

        try {
            await this.prisma.$transaction(async (tx) => {
                let eventRecord = await tx.webhookEvent.findUnique({
                    where: { source_idempotencyKey: { source, idempotencyKey } }
                });

                if (eventRecord) {
                    if (eventRecord.status === 'COMPLETED') {
                        console.log(`[WebhookEventWorker] Event ${source}:${idempotencyKey} is already COMPLETED in DB. Skipping processing.`);
                        return;
                    }
                    eventRecord = await tx.webhookEvent.update({
                        where: { id: eventRecord.id },
                        data: { status: 'PENDING', errorReason: null }
                    });
                } else {
                    eventRecord = await tx.webhookEvent.create({
                        data: {
                            source,
                            idempotencyKey,
                            eventType,
                            payload,
                            status: 'PENDING'
                        }
                    });
                }

                const handler = this.webhookService.handlers.get(eventCategory || 'unknown');
                if (!handler) {
                    throw new Error(`No webhook handler found for category: ${eventCategory}`);
                }

                await handler.handle({ body: payload, eventType, _tx: tx });

                await tx.webhookEvent.update({
                    where: { id: eventRecord.id },
                    data: { status: 'COMPLETED' }
                });
            }, {
                timeout: 15000
            });

            console.log(`[WebhookEventWorker] Successfully processed job ${job.id}`);
        } catch (error) {
            console.error(`[WebhookEventWorker] Failed to process job ${job.id}:`, error);

            try {
                await this.prisma.webhookEvent.update({
                    where: { source_idempotencyKey: { source, idempotencyKey } },
                    data: {
                        status: 'FAILED',
                        errorReason: error.message || 'Unknown error'
                    }
                });
            } catch (dbError) {
                console.error(`[WebhookEventWorker] Failed to update error status for ${job.id}:`, dbError);
            }

            throw error;
        }
    }
}
