import { BaseWorkerService } from './base-worker.service.js';

export class AgentExecutionWorker extends BaseWorkerService {
    /**
     * @param {import('../db/agent/prisma-agent-execution.repository.js').PrismaAgentExecutionRepository} agentExecutionRepository
     * @param {import('../db/payment/prisma-payment.repository.js').PrismaPaymentRepository} paymentRepository
     * @param {import('../db/correlation/prisma-payment-failure-correlation.repository.js').PrismaPaymentFailureCorrelationRepository} paymentFailureCorrelationRepository
     * @param {import('../db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     * @param {import('../db/agent/prisma-agent.repository.js').PrismaAgentRepository} agentRepository
     * @param {import('../../domain/recovery/recovery-case.service.js').RecoveryCaseService} recoveryCaseService
     * @param {Function} contextBuilderFactory
     */
    constructor(
        agentExecutionRepository,
        paymentRepository,
        paymentFailureCorrelationRepository,
        recoveryActionRepository,
        agentRepository,
        recoveryCaseService,
        contextBuilderFactory
    ) {
        super('agent-execution');
        if (!agentExecutionRepository) throw new Error('AgentExecutionWorker: agentExecutionRepository is required');
        this.agentExecutionRepository = agentExecutionRepository;
        this.paymentRepository = paymentRepository;
        this.paymentFailureCorrelationRepository = paymentFailureCorrelationRepository;
        this.recoveryActionRepository = recoveryActionRepository;
        this.agentRepository = agentRepository;
        this.recoveryCaseService = recoveryCaseService;
        this.contextBuilderFactory = contextBuilderFactory;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        if (job.name === 'fire-recovery-schedule') return;

        const { executionId } = job.data;
        console.log(`[AgentExecutionWorker] Processing execution ${executionId}`);

        const { connectorManager } = await import('../../../config/connectors.config.js');

        try {
            const execution = await this.agentExecutionRepository.findById(executionId);

            if (!execution) {
                throw new Error(`Execution record ${executionId} not found`);
            }

            if (execution.status !== 'QUEUED') {
                console.log(`[AgentExecutionWorker] Execution ${executionId} already in status ${execution.status}. Skipping.`);
                return;
            }

            await this.agentExecutionRepository.update(executionId, {
                status: 'RUNNING', startedAt: new Date()
            });

            const { triggerType, inputContext, provider } = execution;

            let fullContext = null;
            let agentConfig = null;
            let activeConnections = [];

            if (triggerType === 'PROVIDER_EVENT' || triggerType === 'RECOVERY_SCHEDULE') {
                const paymentId = inputContext?.paymentId;

                if (paymentId) {
                    const {
                        RecoveryContextBuilder
                    } = await import('../../domain/recovery/recovery-context.builder.js');
                    const {
                        FailureDiagnosisService
                    } = await import('../../domain/recovery/failure-diagnosis.service.js');
                    const {
                        OrderContextService
                    } = await import('../../domain/recovery/order-context.service.js');
                    const {
                        RazorpayOrderRepository
                    } = await import('../../infrastructure/razorpay/razorpay-order.repository.js');
                    const { cacheService } = await import('../../../config/redis.config.js');

                    const payment = await this.paymentRepository.findByRazorpayId(paymentId) || await this.paymentRepository.findById(paymentId);
                    if (!payment) throw new Error(`Payment ${paymentId} not found`);

                    const downtimeCorrelation = await this.paymentFailureCorrelationRepository.findFirstByPaymentId(payment.id);

                    const recoveryCase = await this.recoveryCaseService.getOrCreateCase({
                        type: 'PAYMENT_FAILURE',
                        identity: { paymentId: payment.id },
                        correlationId: downtimeCorrelation?.id || null,
                        contextSnapshot: payment,
                    });

                    await this.recoveryCaseService.markAnalyzing(recoveryCase.id);

                    await this.agentExecutionRepository.update(executionId, {
                        recoveryCaseId: recoveryCase.id
                    });

                    const previousRecoveryActions = await this.recoveryActionRepository.findByCase(recoveryCase.id);

                    agentConfig = await this.agentRepository.findById(execution.agentId);

                    let credentials = {};
                    if (payment.connectionId) {
                        credentials = await connectorManager.getDecryptedCredentialsById(payment.connectionId) || {};
                    }

                    const allCapabilities = new Set();
                    if (agentConfig?.connections) {
                        for (const ac of agentConfig.connections) {
                            try {
                                const capabilities = await connectorManager.getConnectorCapabilities(ac.connectorId);
                                activeConnections.push({
                                    connectorId: ac.connectorId,
                                    provider: ac.connector.connectorId,
                                    capabilities,
                                });
                                for (const cap of capabilities) {
                                    allCapabilities.add(cap);
                                }
                            } catch (err) {
                                console.error(`[AgentExecutionWorker] Failed capabilities for connector ${ac.connectorId}:`, err.message);
                            }
                        }
                    }
                    const availableCapabilities = Array.from(allCapabilities);

                    const contextBuilder = this.contextBuilderFactory ? await this.contextBuilderFactory(credentials) : null;
                    if (!contextBuilder) throw new Error('contextBuilderFactory is not provided');

                    fullContext = await contextBuilder.buildContext({
                        event: {
                            id: execution.triggerId || executionId,
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

                    await this.agentExecutionRepository.update(executionId, {
                        inputContext: fullContext
                    });

                    console.log(`[AgentExecutionWorker] RecoveryCase ${recoveryCase.id} resolved (status: ${recoveryCase.status}). Context built.`);
                }
            } else {
                console.log(`[AgentExecutionWorker] Unhandled triggerType "${triggerType}". Skipping context build.`);
            }

            let agentResponse = null;
            if (fullContext) {
                const { agentService } = await import('../../../config/agent.config.js');

                const prompt = `An event of type '${triggerType}' was triggered. Analyze the context and execute the appropriate recovery tools according to your rules.\n\nContext:\n${JSON.stringify(fullContext, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}`;

                console.log(`[AgentExecutionWorker] Invoking LangGraph for execution ${executionId}...`);
                agentResponse = await agentService.processMessage(prompt, {
                    agentData: agentConfig,
                    executionId,
                    recoveryContext: fullContext,
                    activeConnections,
                });
                console.log(`[AgentExecutionWorker] LangGraph finished for execution ${executionId}.`);
            }

            await this.agentExecutionRepository.update(executionId, {
                status: 'SUCCEEDED',
                completedAt: new Date(),
                result: agentResponse
                    ? { output: agentResponse.output, summary: agentResponse.executionSummary }
                    : { note: 'No context built — agent not invoked' },
                decision: agentResponse?.decision || undefined,
            });

            console.log(`[AgentExecutionWorker] Execution ${executionId} SUCCEEDED.`);

        } catch (error) {
            console.error(`[AgentExecutionWorker] Execution ${executionId} FAILED:`, error);
            try {
                await this.agentExecutionRepository.update(executionId, {
                    status: 'FAILED',
                    completedAt: new Date(),
                    error: { message: error.message || 'Unknown error' }
                });
            } catch (dbErr) {
                console.error(`[AgentExecutionWorker] Failed to persist error for ${executionId}:`, dbErr);
            }
            throw error;
        }
    }
}

export default AgentExecutionWorker;
