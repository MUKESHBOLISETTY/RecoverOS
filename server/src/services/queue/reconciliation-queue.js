import { BullQueueService } from './bull-queue.service.js';

export class ReconciliationQueue extends BullQueueService {
    static QUEUE_NAME = 'payment-reconciliation';

    constructor() {
        super(ReconciliationQueue.QUEUE_NAME, undefined, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5_000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        });
    }

    /**
     * @param {number}  [windowHours=24]
     * @param {string}  [jobId]
     * @returns {Promise<import('bullmq').Job>}
     */
    async addReconcileJob(windowHours = 24, jobId = undefined) {
        return await this.addJob(
            'reconcile',
            { windowHours },
            { jobId }
        );
    }
}
