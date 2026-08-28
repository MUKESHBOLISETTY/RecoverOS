/**
 * @typedef {import('./tool-executor.interface.js').ToolExecutorInterface} ToolExecutorInterface
 * @typedef {import('../agent-execution.repository.js').AgentExecutionRepository} AgentExecutionRepository
 */

export class ToolExecutionService {
    /**
     * @param {Object} factory
     * @param {AgentExecutionRepository} agentExecutionRepository
     * @param {Object} cacheService
     */
    constructor(toolExecutorFactory, agentExecutionRepository, cacheService) {
        this.toolExecutorFactory = toolExecutorFactory;
        this.agentExecutionRepository = agentExecutionRepository;
        this.cacheService = cacheService;
    }

    /**
     * @param {Object} params
     * @param {string} params.executionId The DB ID of the AgentExecution
     * @param {Object} params.decision
     * @param {Object} params.recoveryContext
     * @param {Object} params.activeConnection
     * @returns {Promise<Object>}
     */
    async executeDecision({ executionId, decision, recoveryContext, activeConnection }) {
        if (!decision || !decision.action || decision.action === 'none') {
            console.warn(`[ToolExecutionService] No action to execute for ${executionId}`);
            return null;
        }

        const action = decision.action;

        const lockKey = `agent-exec-${executionId}-${action}`;
        const acquired = await this.cacheService.setNx(lockKey, 'locked', 60);
        if (!acquired) {
            throw new Error(`[ToolExecutionService] Execution ${executionId} for action ${action} is currently locked or already processing.`);
        }

        try {
            const executor = this.toolExecutorFactory.getExecutor(action);
            if (!executor) {
                throw new Error(`[ToolExecutionService] No executor registered for action ${action}`);
            }

            console.log(`[ToolExecutionService] Executing ${action} for ${executionId}...`);
            const result = await executor.execute({
                parameters: decision.parameters,
                recoveryContext,
                activeConnection,
                executionId
            });

            return result;
        } catch (error) {
            console.error(`[ToolExecutionService] Error executing ${action}:`, error.message);
            throw error;
        }
    }
}

export default ToolExecutionService;
