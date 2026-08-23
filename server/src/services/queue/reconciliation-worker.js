import { BaseWorkerService } from './base-worker.service.js';

export class ReconciliationWorker extends BaseWorkerService {
    /**
     * @param {import('../../domain/payment/reconciliation.service.js').ReconciliationService} reconciliationService
     */
    constructor(reconciliationService) {
        super('payment-reconciliation', { concurrency: 1 });

        if (!reconciliationService) {
            throw new Error('ReconciliationWorker: reconciliationService is required');
        }
        this.reconciliationService = reconciliationService;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        const { windowHours = 24 } = job.data;

        console.log(`[ReconciliationWorker] Processing job ${job.id} — window: ${windowHours}h`);

        const result = await this.reconciliationService.reconcile(windowHours);

        if (result.skipped) {
            console.log(`[ReconciliationWorker] Job ${job.id} skipped — lock held by another instance.`);
        } else {
            console.log(
                `[ReconciliationWorker] Job ${job.id} done — ` +
                `missing: ${result.missing}, upserted: ${result.upserted}`
            );
        }

        return result;
    }

    onCompleted(job, result) {
        console.log(
            `[ReconciliationWorker] Job ${job.id} completed. ` +
            `Upserted: ${result?.upserted ?? 0}, Missing: ${result?.missing ?? 0}`
        );
    }

    onFailed(job, error) {
        console.error(
            `[ReconciliationWorker] Job ${job?.id} FAILED (attempt ${job?.attemptsMade}): ` +
            error.message
        );
    }
}
