/**
 * @typedef {import('../../../domain/recovery/recovery-case.service.js').RecoveryCaseService} RecoveryCaseService
 * @typedef {import('../../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} PrismaPaymentRepository
 * @typedef {import('../../../infrastructure/db/correlation/prisma-payment-failure-correlation.repository.js').PrismaPaymentFailureCorrelationRepository} PrismaPaymentFailureCorrelationRepository
 * @typedef {import('../../../infrastructure/db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} PrismaRecoveryActionRepository
 */

export class TriggerContextResolver {
    /**
     * @param {PrismaPaymentRepository} paymentRepository
     * @param {PrismaPaymentFailureCorrelationRepository} paymentFailureCorrelationRepository
     * @param {PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {RecoveryCaseService} recoveryCaseService
     * @param {Function} contextBuilderFactory
     */
    /**
     * @param {import('../../recovery/recovery-case.service.js').RecoveryCaseService} recoveryCaseService
     * @param {Function} subjectContextRegistryFactory
     * @param {import('../skills/skill-selector.js').default} skillSelector
     * @param {import('../skills/skill-registry.interface.js').default} skillRegistry
     */
    constructor(
        recoveryCaseService,
        subjectContextRegistryFactory,
        skillSelector,
        skillRegistry
    ) {
        this.recoveryCaseService = recoveryCaseService;
        this.subjectContextRegistryFactory = subjectContextRegistryFactory;
        this.skillSelector = skillSelector;
        this.skillRegistry = skillRegistry;
    }

    /**
     * @param {Object} execution - The AgentExecution record
     * @param {Object} agentConfig - The agent configuration
     * @param {Array<string>} availableCapabilities - List of capabilities
     * @param {Object} credentials - Optional credentials map
     * @returns {Promise<Object>} fullContext
     */
    async resolveContext(execution, agentConfig, availableCapabilities, credentials) {
        const { triggerType, triggerId, inputContext } = execution;
        const executionId = execution.id;

        let recoveryCase;

        if (triggerType === 'recovery.schedule') {
            const recoveryCaseId = execution.recoveryCaseId || inputContext?.recoveryCaseId;
            if (!recoveryCaseId) {
                throw new Error(`[TriggerContextResolver] recoveryCaseId missing for scheduled execution ${executionId}`);
            }
            recoveryCase = await this.recoveryCaseService.getCaseById(recoveryCaseId);
            if (!recoveryCase) {
                throw new Error(`[TriggerContextResolver] RecoveryCase ${recoveryCaseId} not found`);
            }
        } else if (triggerType.startsWith('payment.')) {
            const paymentId = inputContext?.paymentId || inputContext?.subject?.id;
            if (!paymentId) {
                throw new Error(`[TriggerContextResolver] paymentId missing from inputContext for event ${triggerType}`);
            }

            const skillId = this.skillSelector.selectForTrigger({ eventType: triggerType, agentData: agentConfig });
            let activeSkillId = null;
            let activeSkillVersion = null;

            if (skillId) {
                const skill = await this.skillRegistry.getSkill(skillId);
                if (skill) {
                    activeSkillId = skill.id;
                    activeSkillVersion = skill.version;
                }
            }

            recoveryCase = await this.recoveryCaseService.getOrCreateCase({
                type: 'PAYMENT_FAILURE',
                identity: { paymentId },
                subjectType: 'PAYMENT',
                subjectId: paymentId,
                activeSkillId,
                activeSkillVersion
            });
        } else {
            throw new Error(`[TriggerContextResolver] Unsupported triggerType: ${triggerType}`);
        }

        await this.recoveryCaseService.markAnalyzing(recoveryCase.id);

        const registry = this.subjectContextRegistryFactory ? await this.subjectContextRegistryFactory(credentials) : null;
        if (!registry) throw new Error('subjectContextRegistryFactory is not provided');

        const contextProvider = registry.get(recoveryCase.subjectType);

        return await contextProvider.buildContext({
            subjectId: recoveryCase.subjectId,
            execution,
            recoveryCase,
            agentConfig,
            availableCapabilities,
            credentials
        });
    }
}

export default TriggerContextResolver;
