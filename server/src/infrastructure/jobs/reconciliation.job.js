export class ReconciliationJob {
    /**
     * @param {import('../../services/queue/reconciliation-queue.js').ReconciliationQueue} reconciliationQueue
     * @param {object}  [options]
     * @param {string}  [options.cron='0 0 * * *']
     * @param {number}  [options.windowHours=24]
     * @param {string}  [options.tz='UTC']
     */
    constructor(reconciliationQueue, options = {}) {
        if (!reconciliationQueue) {
            throw new Error('ReconciliationJob: reconciliationQueue is required');
        }
        this.reconciliationQueue = reconciliationQueue;
        this.cron = options.cron ?? '0 0 * * *';
        this.windowHours = options.windowHours ?? 24;
        this.tz = options.tz ?? 'UTC';
        this.jobKey = 'payment-reconciliation-nightly';
    }

    async start() {
        const queue = this.reconciliationQueue.getUnderlyingQueue();
        await queue.add(
            'reconcile',
            { windowHours: this.windowHours },
            {
                repeat: {
                    pattern: this.cron,
                    tz: this.tz,
                },
                jobId: this.jobKey,
            }
        );

        console.log(
            `[ReconciliationJob] Scheduled nightly reconciliation: ` +
            `cron="${this.cron}" tz="${this.tz}" window=${this.windowHours}h`
        );

        await this._triggerImmediateRun();
    }

    async stop() {
        const queue = this.reconciliationQueue.getUnderlyingQueue();

        const repeatableJobs = await queue.getRepeatableJobs();
        const job = repeatableJobs.find(j => j.key && j.key.includes(this.jobKey));

        if (job) {
            await queue.removeRepeatableByKey(job.key);
            console.log(`[ReconciliationJob] Removed repeatable job "${this.jobKey}".`);
        }
    }

    async _triggerImmediateRun() {
        const immediateJobId = `${this.jobKey}-startup-${Date.now()}`;
        await this.reconciliationQueue.addReconcileJob(this.windowHours, immediateJobId);
        console.log(`[ReconciliationJob] Triggered immediate startup reconciliation (${immediateJobId}).`);
    }
}
