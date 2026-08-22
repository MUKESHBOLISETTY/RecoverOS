import { BullQueueService } from './bull-queue.service.js';

export class WebhookEventQueue extends BullQueueService {
    constructor() {
        super('webhook-events', undefined, {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false // Dead letter queue
        });
    }

    /**
     * @param {string} source - ex: "RAZORPAY"
     * @param {string} idempotencyKey - unique key
     * @param {string} eventType - The type of event (ex: payment.captured)
     * @param {string} eventCategory - The broad category of the event (ex: payment)
     * @param {object} payload
     */
    async addEvent(source, idempotencyKey, eventType, eventCategory, payload) {
        const jobId = `${source}-${idempotencyKey}`.replace(/:/g, '-');
        return await this.addJob('process-webhook', {
            source,
            idempotencyKey,
            eventType,
            eventCategory,
            payload
        }, { jobId });
    }
}
