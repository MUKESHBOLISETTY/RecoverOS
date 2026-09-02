import { SubjectContextProviderInterface } from './subject-context-provider.interface.js';
import { MoneyFormatter } from '../../payment/money-formatter.js';

export class PaymentContextProvider extends SubjectContextProviderInterface {
    /**
     * @param {import('../../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} paymentRepository
     * @param {import('../../../infrastructure/db/correlation/prisma-payment-failure-correlation.repository.js').PrismaPaymentFailureCorrelationRepository} correlationRepository
     * @param {import('../recovery-history.builder.js').RecoveryHistoryBuilder} recoveryHistoryBuilder
     * @param {import('../failure-diagnosis.service.js').FailureDiagnosisService} failureDiagnosisService
     * @param {import('../order-context.service.js').OrderContextService} orderContextService
     * @param {import('../../connectors/connector.manager.js').default} connectorManager
     */
    constructor(
        paymentRepository,
        correlationRepository,
        recoveryHistoryBuilder,
        failureDiagnosisService,
        orderContextService,
        connectorManager
    ) {
        super();
        this.paymentRepository = paymentRepository;
        this.correlationRepository = correlationRepository;
        this.recoveryHistoryBuilder = recoveryHistoryBuilder;
        this.failureDiagnosisService = failureDiagnosisService;
        this.orderContextService = orderContextService;
        this.connectorManager = connectorManager;
    }

    async buildContext(params) {
        const { subjectId, execution, recoveryCase, agentConfig, availableCapabilities } = params;

        const payment = await this.paymentRepository.findByRazorpayId(subjectId) || await this.paymentRepository.findById(subjectId);
        if (!payment) throw new Error(`[PaymentContextProvider] Payment ${subjectId} not found`);

        const downtimeCorrelation = await this.correlationRepository.findFirstByPaymentId(payment.id);
        const recoveryHistory = await this.recoveryHistoryBuilder.buildHistory(recoveryCase.id);

        let provider = execution.provider;
        if (!provider && payment.connectionId && this.connectorManager) {
            try {
                const credentials = await this.connectorManager.getDecryptedCredentialsById(payment.connectionId);
                if (credentials) {
                    const record = await this.connectorManager.credentialRepository.findById(payment.connectionId);
                    provider = record?.connectorId;
                }
            } catch (err) {
                console.warn(`[PaymentContextProvider] Failed to resolve provider for connection ${payment.connectionId}: ${err.message}`);
            }
        }

        let failure = null;
        if (execution.triggerType === 'payment.failed') {
            failure = this.failureDiagnosisService.analyze({ payment, provider, downtimeCorrelation });
        }

        let order = null;
        if (payment.orderId) {
            order = await this.orderContextService.getOrderContext(payment.orderId);
        }

        let agentPolicy = null;

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
            recoveryHistory,
            customerHistory: {},
            agentPolicy,
            availableCapabilities: availableCapabilities || []
        };
    }
}
