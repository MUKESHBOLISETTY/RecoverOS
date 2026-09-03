export class RecoveryCompletionService {
    /**
     * @param {import('../../infrastructure/db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../infrastructure/cache/base-cache.service.js').BaseCacheService} cacheService
     * @param {import('./recovery-event-publisher.interface.js').RecoveryEventPublisherInterface} [recoveryEventPublisher]
     */
    constructor(recoveryCaseRepository, cacheService, recoveryEventPublisher = null) {
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.cacheService = cacheService;
        this.recoveryEventPublisher = recoveryEventPublisher;
    }

    /**
     * @param {Object} params
     * @param {string} [params.recoveryCaseId] - recovery workflow UUID
     * @param {string} [params.subjectType]
     * @param {string} [params.subjectId] - internal subject identifier
     * @param {Object} params.verifiedOutcome
     * @param {number} params.verifiedOutcome.amountRecovered
     * @param {string} params.verifiedOutcome.notes
     * @param {string} params.sourceEvent
     * @param {string} [params.sourceEventId] - Provider event ID
     * @param {string} [params.userId]
     * @returns {Promise<string[]>} array of recovered case IDs
     */
    async complete(params) {
        const { recoveryCaseId, subjectType, subjectId, verifiedOutcome, sourceEvent, sourceEventId, userId } = params;

        const recoveredCases = await this.recoveryCaseRepository.markRecovered({
            recoveryCaseId,
            subjectType,
            subjectId,
            verifiedOutcome,
            sourceEvent,
            sourceEventId
        });

        const postCommitOrchestration = async () => {
            for (const recoveryCase of recoveredCases) {
                try {
                    if (this.cacheService) {
                        await this.cacheService.del(`recovery_case_status:${recoveryCase.id}`);
                    }
                    console.log(`[RecoveryCompletionService] RecoveryCase ${recoveryCase.id} → RECOVERED`);
                    console.log(`  sourceEvent=${sourceEvent}`);
                    console.log(`  outcome=PAYMENT_RECOVERED`);
                    console.log(`  schedulesCancelled=${recoveryCase.schedulesCancelled || 0}`);

                    if (this.recoveryEventPublisher && userId) {
                        const provider = recoveryCase.type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
                        await this.recoveryEventPublisher.publishCaseRecovered(recoveryCase.id, recoveryCase.type, provider, userId);
                    }
                } catch (err) {
                    console.error(`[RecoveryCompletionService] Failed to clear cache or publish event for case ${recoveryCase.id}:`, err.message);
                }
            }
        };

        return {
            recoveredCaseIds: recoveredCases.map(c => c.id),
            postCommitOrchestration
        };
    }
}
