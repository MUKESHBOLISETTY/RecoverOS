import { BaseWorkerService } from './base-worker.service.js';

export class EmailWorkerService extends BaseWorkerService {
    constructor(workerOptions = {}) {
        super('emailQueue', {
            limiter: {
                max: 1,
                duration: 500
            },
            concurrency: 1,
            ...workerOptions
        });
    }

    async process(job) {
        const { to, subject, template, data } = job.data || {};
        console.log(`[EmailWorker] Processing email to: ${to || 'unspecified'}, Subject: ${subject || 'N/A'}`);

        return {
            sent: true,
            recipient: to,
            timestamp: new Date().toISOString()
        };
    }
}
