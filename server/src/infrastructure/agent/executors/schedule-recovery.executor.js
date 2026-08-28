import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';

export class ScheduleRecoveryExecutor extends ToolExecutorInterface {
    /**
     * @param {import('../../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../db/schedule/prisma-recovery-schedule.repository.js').PrismaRecoveryScheduleRepository} recoveryScheduleRepository
     * @param {import('../../db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {import('../../db/outbox/prisma-outbox-event.repository.js').PrismaOutboxEventRepository} outboxEventRepository
     * @param {import('../../cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(
        recoveryCaseRepository,
        recoveryScheduleRepository,
        recoveryActionRepository,
        outboxEventRepository,
        cacheService
    ) {
        super();
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.recoveryScheduleRepository = recoveryScheduleRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.cacheService = cacheService;
    }

    /**
     * @param {Object} args
     * @param {Object} args.parameters
     * @param {number} args.parameters.delayMinutes
     * @param {string} args.parameters.reason
     * @param {Object} args.recoveryContext
     * @param {string} args.executionId
     * @returns {Promise<Object>}
     */
    async execute({ parameters, recoveryContext, executionId }) {
        const { delayMinutes, reason } = parameters;
        const caseId = recoveryContext?.recoveryCase?.id;

        if (!caseId) {
            throw new Error('ScheduleRecoveryExecutor: recoveryCase.id is missing from context. Case must be created before agent execution.');
        }
        if (!executionId) {
            throw new Error('ScheduleRecoveryExecutor: executionId is required.');
        }
        if (!delayMinutes || delayMinutes <= 0) {
            throw new Error('ScheduleRecoveryExecutor: delayMinutes must be a positive number.');
        }

        const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        const result = await this.recoveryCaseRepository.scheduleRecovery(
            caseId,
            executionId,
            reason,
            delayMinutes,
            executeAt
        );

        if (this.cacheService) {
            await this.cacheService.set(
                `recovery_case_status:${caseId}`,
                'WAITING',
                delayMinutes * 60
            );
        }

        return {
            status: 'SCHEDULED',
            caseId: result.updatedCase.id,
            scheduleId: result.schedule.id,
            outboxEventId: result.outboxEvent.id,
            delayMinutes,
            executeAt: executeAt.toISOString(),
            message: `Follow-up scheduled in ${delayMinutes} minutes. Reason: ${reason}`
        };
    }
}

export default ScheduleRecoveryExecutor;
