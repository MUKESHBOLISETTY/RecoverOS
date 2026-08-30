import { SubjectContextProviderInterface } from './subject-context-provider.interface.js';
import { MoneyFormatter } from '../../payment/money-formatter.js';

export class PaymentContextProvider extends SubjectContextProviderInterface {
    /**
     * @param {import('../../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} paymentRepository
     * @param {import('../../../infrastructure/db/correlation/prisma-payment-failure-correlation.repository.js').PrismaPaymentFailureCorrelationRepository} correlationRepository
     * @param {import('../../../infrastructure/db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {import('../failure-diagnosis.service.js').FailureDiagnosisService} failureDiagnosisService
     * @param {import('../order-context.service.js').OrderContextService} orderContextService
     */
    constructor(
        paymentRepository,
        correlationRepository,
        recoveryActionRepository,
        failureDiagnosisService,
        orderContextService
    ) {
        super();
        this.paymentRepository = paymentRepository;
        this.correlationRepository = correlationRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.failureDiagnosisService = failureDiagnosisService;
        this.orderContextService = orderContextService;
    }

    async buildContext(params) {
        const { subjectId, execution, recoveryCase, agentConfig, availableCapabilities } = params;

        const payment = await this.paymentRepository.findByRazorpayId(subjectId) || await this.paymentRepository.findById(subjectId);
        if (!payment) throw new Error(`[PaymentContextProvider] Payment ${subjectId} not found`);

        const downtimeCorrelation = await this.correlationRepository.findFirstByPaymentId(payment.id);
        const previousRecoveryActions = await this.recoveryActionRepository.findByCase(recoveryCase.id);

        let failure = null;
        if (execution.triggerType === 'payment.failed') {
            failure = this.failureDiagnosisService.analyze({ payment, provider: execution.provider, downtimeCorrelation });
        }

        let order = null;
        if (payment.orderId) {
            order = await this.orderContextService.getOrderContext(payment.orderId);
        }

        let agentPolicy = null;
        if (agentConfig) {
            agentPolicy = {
                rules: agentConfig.rules || [],
                actions: agentConfig.actions || [],
                stopConditions: agentConfig.stopConditions || [],
                purpose: agentConfig.purpose || ''
            };
        }

        const paymentData = payment ? {
            ...payment,
            displayAmount: MoneyFormatter.format(payment.amount, payment.currency || 'INR')
        } : null;

        return {
            event: {
                id: execution.triggerId || execution.id,
                type: execution.triggerType,
                occurredAt: execution.queuedAt?.toISOString() || new Date().toISOString()
            },
            payment: paymentData,
            order,
            failure,
            downtimeCorrelation: downtimeCorrelation || null,
            recoveryCase: {
                id: recoveryCase.id,
                status: recoveryCase.status,
                subjectType: recoveryCase.subjectType || 'UNKNOWN',
                subjectId: recoveryCase.subjectId || 'UNKNOWN',
                strategyApplied: recoveryCase.strategyApplied || null,
                activeSkillId: recoveryCase.activeSkillId || null,
                activeSkillVersion: recoveryCase.activeSkillVersion || null
            },
            recoveryHistory: {
                contactAttempts: previousRecoveryActions.filter(a => {
                    return !['INTERNAL_SYSTEM_ACTION', 'IN_APP'].includes(a.type);
                }).length,
                automatedRecoveryActions: previousRecoveryActions.filter(a => a.type === 'INTERNAL_SYSTEM_ACTION').length,
                actions: previousRecoveryActions.map(a => ({
                    action: a.type,
                    status: a.status,
                    payload: a.payload || null,
                    occurredAt: a.createdAt
                }))
            },
            customerHistory: {},
            agentPolicy,
            availableCapabilities: availableCapabilities || []
        };
    }
}
