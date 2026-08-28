export class RecoveryContextBuilder {
    /**
     * @param {import('./failure-diagnosis.service.js').FailureDiagnosisService} failureDiagnosisService
     * @param {import('./order-context.service.js').OrderContextService} orderContextService
     */
    constructor(failureDiagnosisService, orderContextService) {
        this.failureDiagnosisService = failureDiagnosisService;
        this.orderContextService = orderContextService;
    }

    /**
     * @param {Object} params
     * @param {Object} params.event
     * @param {string} params.event.id
     * @param {string} params.event.type
     * @param {string} [params.event.occurredAt]
     * @param {Object} params.payment
     * @param {string} [params.provider]
     * @param {Object} [params.downtimeCorrelation]
     * @param {Object} [params.agent]
     * @param {Object} [params.recoveryCase] - pre-created RecoveryCase
     * @param {Array}  [params.previousRecoveryActions]
     * @param {Object} [params.customerHistory]
     * @param {Array<string>} [params.availableCapabilities]
     * @returns {Promise<Object>} RecoveryContext
     */
    async buildContext(params) {
        const {
            event,
            payment,
            provider,
            downtimeCorrelation,
            agent,
            recoveryCase = null,
            previousRecoveryActions = [],
            customerHistory = {},
            availableCapabilities = []
        } = params;

        const failure = this.failureDiagnosisService.analyze({ payment, provider, downtimeCorrelation });

        let order = null;
        if (payment.orderId) {
            order = await this.orderContextService.getOrderContext(payment.orderId);
        }

        let agentPolicy = null;
        if (agent) {
            agentPolicy = {
                rules: agent.rules || [],
                actions: agent.actions || [],
                stopConditions: agent.stopConditions || [],
                purpose: agent.purpose || ''
            };

            if (agent.spec && typeof agent.spec === 'object' && agent.spec.policy) {
                agentPolicy = { ...agentPolicy, ...agent.spec.policy };
            }
        }

        const previousRecoveryAttempts = previousRecoveryActions.map(a => ({
            action: a.type,
            status: a.status,
            payload: a.payload || null,
            occurredAt: a.createdAt
        }));

        return {
            event: {
                id: event.id,
                type: event.type,
                occurredAt: event.occurredAt || new Date().toISOString()
            },
            payment,
            order,
            failure,
            downtimeCorrelation: downtimeCorrelation || null,
            recoveryCase: recoveryCase ? {
                id: recoveryCase.id,
                status: recoveryCase.status,
                strategyApplied: recoveryCase.strategyApplied || null
            } : null,
            previousRecoveryAttempts,
            customerHistory,
            agentPolicy,
            availableCapabilities
        };
    }
}
