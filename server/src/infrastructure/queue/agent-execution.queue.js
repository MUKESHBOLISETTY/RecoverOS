import { BullQueueService } from './bull-queue.service.js';

export class AgentExecutionQueue extends BullQueueService {
    constructor() {
        super('agent-execution');
    }

    /**
     * @param {string} executionId 
     * @returns {Promise<import('bullmq').Job>}
     */
    async addExecutionJob(executionId) {
        return await this.addJob(
            'execute-agent',
            { executionId },
            {
                jobId: `agent-execution-${executionId}`,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            }
        );
    }
}

export default AgentExecutionQueue;
