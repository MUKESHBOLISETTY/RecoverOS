import { DuplicateExecutionError } from './errors/duplicate-execution.error.js';

/**
 * @typedef {import('./agent-execution.repository.js').AgentExecutionRepository} AgentExecutionRepository
 * @typedef {import('../../infrastructure/queue/agent-execution.queue.js').AgentExecutionQueue} AgentExecutionQueue
 */

export class AgentExecutionService {
    /**
     * @param {AgentExecutionRepository} executionRepository 
     * @param {AgentExecutionQueue} executionQueue 
     */
    constructor(executionRepository, executionQueue) {
        this.executionRepository = executionRepository;
        this.executionQueue = executionQueue;
    }

    /**
     * @param {Object} input 
     * @param {Object} input.agent
     * @param {string} input.agent.id
     * @param {number} input.agent.version
     * @param {string} input.userId
     * @param {string} [input.eventId]
     * @param {string} input.eventType
     * @param {string} [input.provider]
     * @param {string} [input.externalEventId]
     * @param {Object} [input.inputContext]
     * @returns {Promise<import('./agent-execution.repository.js').AgentExecution>}
     */
    async createExecution(input) {
        try {
            const data = {
                agentId: input.agent.id,
                agentVersion: input.agent.version,
                userId: input.userId,
                triggerType: input.triggerType,
                triggerId: input.triggerId || null,
                externalTriggerId: input.externalTriggerId || null,
                provider: input.provider || null,
                inputContext: input.inputContext || null,
                recoveryCaseId: input.recoveryCaseId || (input.inputContext && input.inputContext.recoveryCaseId) || null,
                status: 'QUEUED'
            };

            return await this.executionRepository.create(data);
        } catch (error) {
            if (error instanceof DuplicateExecutionError && input.triggerId) {
                console.log(`[AgentExecutionService] ${error.message}`);
                const existing = await this.executionRepository.findByAgentAndEvent(input.agent.id, input.triggerType, input.triggerId);
                if (!existing) {
                    throw new Error(`Unique constraint violation but record not found: ${error.message}`);
                }
                return existing;
            }
            throw error;
        }
    }

    /**
     * @param {import('./agent-execution.repository.js').AgentExecution} execution 
     */
    async enqueueExecution(execution) {
        if (execution.status !== 'QUEUED') {
            console.log(`[AgentExecutionService] Execution ${execution.id} is already in status ${execution.status}, skipping enqueue.`);
            return execution;
        }

        if (execution.jobId) {
            console.log(`[AgentExecutionService] Execution ${execution.id} already has a jobId, skipping enqueue.`);
            return execution;
        }

        const job = await this.executionQueue.addExecutionJob(execution.id);

        const updatedExecution = await this.executionRepository.update(execution.id, {
            jobId: job.id,
            status: 'QUEUED',
        });

        console.log(`[AgentExecutionService] Enqueued execution ${execution.id} with job ID ${job.id}`);
        return updatedExecution;
    }
}

export default AgentExecutionService;
