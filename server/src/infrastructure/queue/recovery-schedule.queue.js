import { BullQueueService } from './bull-queue.service.js';

export class RecoveryScheduleQueue extends BullQueueService {
    constructor() {
        super('recovery-schedule');
    }

    /**
     * @param {string} scheduleId 
     * @param {number} delayMs 
     * @param {string} eventId
     * @returns {Promise<import('bullmq').Job>}
     */
    async addScheduleJob(scheduleId, delayMs, eventId) {
        return await this.addJob(
            'fire-recovery-schedule',
            { scheduleId },
            {
                jobId: `outbox:${eventId}`,
                delay: delayMs,
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
            }
        );
    }
}

export default RecoveryScheduleQueue;
