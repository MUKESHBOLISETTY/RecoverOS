import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';

export class EscalateRecoveryExecutor extends ToolExecutorInterface {
    /**
     * @param {import('../../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {import('../../cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(recoveryCaseRepository, recoveryActionRepository, cacheService) {
        super();
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.cacheService = cacheService;
    }

    /**
     * @param {Object} args
     * @param {Object} args.parameters
     * @param {string} args.parameters.reason
     * @param {Object} args.recoveryContext
     * @param {string} args.executionId
     * @returns {Promise<Object>}
     */
    async execute({ parameters, recoveryContext, executionId }) {
        const { reason } = parameters;
        const caseId = recoveryContext?.recoveryCase?.id;

        if (!caseId) {
            throw new Error('EscalateRecoveryExecutor: recoveryCase.id is missing from context. Case must be created before agent execution.');
        }

        const idempotencyKey = `escalate:${caseId}:${executionId}`;

        const result = await this.recoveryCaseRepository.escalateCase(caseId, executionId, reason);

        if (this.cacheService) {
            await this.cacheService.del(`recovery_case_status:${caseId}`);
        }

        return {
            status: 'ESCALATED',
            caseId: result.id,
            message: `Recovery case escalated for manual review. Reason: ${reason}`
        };
    }
}

export default EscalateRecoveryExecutor;
