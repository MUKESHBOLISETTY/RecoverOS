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
    constructor(
        paymentRepository,
        paymentFailureCorrelationRepository,
        recoveryActionRepository,
        recoveryCaseService,
        contextBuilderFactory
    ) {
        this.paymentRepository = paymentRepository;
        this.paymentFailureCorrelationRepository = paymentFailureCorrelationRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.recoveryCaseService = recoveryCaseService;
        this.contextBuilderFactory = contextBuilderFactory;
    }

    /**
     * @param {Object} execution - The AgentExecution record
     * @param {Object} agentConfig - The agent configuration
     * @param {Array<string>} availableCapabilities - List of capabilities
     * @param {Object} credentials - Optional credentials map
     * @returns {Promise<Object>} fullContext
     */
    async resolveContext(execution, agentConfig, availableCapabilities, credentials) {
        const { triggerType, triggerId, inputContext, provider } = execution;
        const executionId = execution.id;

        // Determine if it's a payment-related event
        if (triggerType.startsWith('payment.') || triggerType === 'recovery.schedule') {
            console.log(`[TriggerContext] triggerType: ${triggerType}, subjectType: payment, subjectId: ${inputContext?.paymentId || inputContext?.subject?.id}`);
            const paymentId = inputContext?.paymentId || inputContext?.subject?.id;
            if (!paymentId) {
                throw new Error(`[TriggerContextResolver] paymentId missing from inputContext for event ${triggerType}`);
            }

            const payment = await this.paymentRepository.findByRazorpayId(paymentId) || await this.paymentRepository.findById(paymentId);
            if (!payment) throw new Error(`[TriggerContextResolver] Payment ${paymentId} not found`);

            const downtimeCorrelation = await this.paymentFailureCorrelationRepository.findFirstByPaymentId(payment.id);

            const recoveryCase = await this.recoveryCaseService.getOrCreateCase({
                type: 'PAYMENT_FAILURE',
                identity: { paymentId: payment.id },
                correlationId: downtimeCorrelation?.id || null,
                contextSnapshot: payment,
            });

            await this.recoveryCaseService.markAnalyzing(recoveryCase.id);

            const previousRecoveryActions = await this.recoveryActionRepository.findByCase(recoveryCase.id);

            const contextBuilder = this.contextBuilderFactory ? await this.contextBuilderFactory(credentials) : null;
            if (!contextBuilder) throw new Error('contextBuilderFactory is not provided');

            return await contextBuilder.buildContext({
                event: {
                    id: triggerId || executionId,
                    type: triggerType,
                    occurredAt: execution.queuedAt?.toISOString()
                },
                payment,
                provider,
                downtimeCorrelation,
                agent: agentConfig,
                recoveryCase,
                previousRecoveryActions,
                availableCapabilities
            });
        }

        throw new Error(`[TriggerContextResolver] Unsupported triggerType: ${triggerType}`);
    }
}

export default TriggerContextResolver;
