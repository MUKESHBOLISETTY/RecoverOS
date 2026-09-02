import { PolicyViolationError } from '../errors/policy-violation.error.js';
import { RecoveryPolicyValidator } from '../policy/recovery-policy.validator.js';

export class ToolExecutionService {
    /**
     * @param {Object} toolExecutorFactory
     * @param {import('../agent-execution.repository.js').AgentExecutionRepository} agentExecutionRepository
     * @param {import('../../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {import('../../cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(
        toolExecutorFactory,
        agentExecutionRepository,
        recoveryCaseRepository,
        recoveryActionRepository,
        cacheService
    ) {
        this.toolExecutorFactory = toolExecutorFactory;
        this.agentExecutionRepository = agentExecutionRepository;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.cacheService = cacheService;
    }

    /**
     * @param {Object} params
     * @param {string} params.executionId The DB ID of the AgentExecution
     * @param {Object} params.decision
     * @param {Object} params.recoveryContext
     * @param {Object} params.policyContext
     * @param {Object} params.activeConnection
     * @returns {Promise<Object>}
     */
    async executeDecision({ executionId, decision, recoveryContext, policyContext, activeConnection, activeConnections }) {
        if (!decision || !decision.action || decision.action === 'none') {
            console.warn(`[ToolExecutionService] No action to execute for ${executionId}`);
            return null;
        }

        const action = decision.action;
        const caseId = recoveryContext?.recoveryCase?.id;

        if (!caseId) {
            throw new Error(`[ToolExecutionService] Execution ${executionId} lacks recoveryCase id.`);
        }

        const executor = this.toolExecutorFactory.getExecutor(action);
        if (!executor) {
            throw new Error(`[ToolExecutionService] No executor registered for action ${action}`);
        }

        const idempotencyKey = `${action}:${caseId}:${executionId}`;
        let reservedActionId = null;

        const lockKey = `lock:recovery-case-${caseId}:reservation`;
        const acquired = await this.cacheService.setNx(lockKey, 'locked', 10); // 10s TTL

        if (!acquired) {
            throw new Error(`[ToolExecutionService] Case ${caseId} is currently locked by another reservation.`);
        }

        try {
            const existingAction = await this.recoveryActionRepository.findByIdempotencyKey(idempotencyKey);
            if (existingAction) {
                if (existingAction.status === 'COMPLETED') {
                    console.log(`[ToolExecutionService] Action ${idempotencyKey} is already COMPLETED. Returning cached result to prevent duplicate side-effect.`);
                    return existingAction.payload;
                } else if (existingAction.status === 'FAILED') {
                    reservedActionId = existingAction.id;
                } else if (existingAction.status === 'RESERVED') {
                    reservedActionId = existingAction.id;
                }
            } else {
                const latestCase = await this.recoveryCaseRepository.findById(caseId);
                if (!latestCase) throw new Error('RecoveryCase not found');

                const allActions = await this.recoveryActionRepository.findByCase(caseId);
                const verificationResult = latestCase.contextSnapshot?.verificationResult || null;

                const validation = RecoveryPolicyValidator.validate({
                    action,
                    parameters: decision.parameters,
                    policy: policyContext,
                    recoveryCase: latestCase,
                    recoveryActions: allActions,
                    verificationResult
                });

                if (!validation.allowed) {
                    throw new PolicyViolationError(validation);
                }

                const actionType = RecoveryPolicyValidator.ACTION_TYPE_MAP[action];
                const isTrackedAction = actionType && RecoveryPolicyValidator.TRACKED_ACTION_TYPES.includes(actionType);
                if (isTrackedAction) {
                    const newAction = await this.recoveryActionRepository.create({
                        recoveryCaseId: caseId,
                        type: actionType,
                        status: 'RESERVED',
                        idempotencyKey,
                        payload: { parameters: decision.parameters }
                    });
                    reservedActionId = newAction.id;
                }
            }
        } finally {
            await this.cacheService.del(lockKey);
        }

        console.log(`[ToolExecutionService] Executing ${action} for ${executionId}...`);

        let result;
        try {
            result = await executor.execute({
                parameters: decision.parameters,
                recoveryContext,
                activeConnection,
                activeConnections,
                executionId,
                reservedActionId, //ID for contact actions to update
                idempotencyKey
            });

            if (reservedActionId) {
                await this.recoveryActionRepository.update(reservedActionId, {
                    status: 'COMPLETED',
                    payload: result
                });
            }

            return result;
        } catch (error) {
            console.error(`[ToolExecutionService] Error executing ${action}:`, error.message);

            if (reservedActionId) {
                await this.recoveryActionRepository.update(reservedActionId, {
                    status: 'FAILED',
                    payload: { error: error.message, code: error.code }
                });
            }

            throw error;
        }
    }
}

export default ToolExecutionService;
