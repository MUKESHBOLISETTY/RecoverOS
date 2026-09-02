import { BullQueueService } from './bull-queue.service.js';

export class PaymentStabilizationQueue extends BullQueueService {
    constructor() {
        super('payment-stabilization');
    }

    /**
     * @param {string} recoveryCaseId
     * @param {string} paymentId
     * @param {number} delayMs
     */
    async enqueueStabilization(recoveryCaseId, paymentId, delayMs = 60000) { // Default 60 seconds stabilization
        const jobId = `stabilize-payment-${paymentId}`;

        await this.addJob(
            'stabilize-payment',
            { recoveryCaseId, paymentId },
            {
                jobId,
                delay: delayMs,
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 }
            }
        );
        console.log(`[PaymentStabilizationQueue] Enqueued stabilization for payment ${paymentId} with jobId ${jobId}`);
    }
}
