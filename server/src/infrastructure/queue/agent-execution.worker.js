import { BaseWorkerService } from './base-worker.service.js';

export class AgentExecutionWorker extends BaseWorkerService {
    /**
     * @param {import('../db/agent/prisma-agent-execution.repository.js').PrismaAgentExecutionRepository} agentExecutionRepository
     * @param {import('../db/agent/prisma-agent.repository.js').PrismaAgentRepository} agentRepository
     * @param {import('../../domain/agent/execution/trigger-context.resolver.js').TriggerContextResolver} triggerContextResolver
     * @param {import('../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../razorpay/razorpay-payment.repository.js').RazorpayPaymentRepository} paymentRepository
     */
    constructor(
        agentExecutionRepository,
        agentRepository,
        triggerContextResolver,
        recoveryCaseRepository,
        paymentRepository
    ) {
        super('agent-execution');
        if (!agentExecutionRepository) throw new Error('AgentExecutionWorker: agentExecutionRepository is required');
        this.agentExecutionRepository = agentExecutionRepository;
        this.agentRepository = agentRepository;
        this.triggerContextResolver = triggerContextResolver;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.paymentRepository = paymentRepository;
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

        agentConfig = await this.agentRepository.findById(execution.agentId);

        let credentials = {};
        const { connectorManager } = await import('../../../config/connectors.config.js');

        let connectionId = null;

        if (execution.triggerType === 'recovery.schedule' && (execution.recoveryCaseId || execution.inputContext?.recoveryCaseId)) {
            const caseId = execution.recoveryCaseId || execution.inputContext.recoveryCaseId;
            const recoveryCase = await this.recoveryCaseRepository.findById(caseId);
            if (recoveryCase && recoveryCase.subjectType === 'PAYMENT') {
                const payment = await this.paymentRepository.findById(recoveryCase.subjectId) || 
                                await this.paymentRepository.findByRazorpayId(recoveryCase.subjectId);
                if (payment?.connectionId) {
                    connectionId = payment.connectionId;
                }
            }
        } else if (execution.inputContext?.paymentId || execution.inputContext?.subject?.id) {
            const paymentId = execution.inputContext.paymentId || execution.inputContext.subject.id;
            const payment = await this.paymentRepository.findById(paymentId) || 
                            await this.paymentRepository.findByRazorpayId(paymentId);
            if (payment?.connectionId) {
                connectionId = payment.connectionId;
            }
        }

        if (connectionId) {
            credentials = await connectorManager.getDecryptedCredentialsById(connectionId) || {};
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

        try {
            fullContext = await this.triggerContextResolver.resolveContext(execution, agentConfig, availableCapabilities, credentials);

            await this.agentExecutionRepository.update(executionId, {
                inputContext: fullContext,
                recoveryCaseId: fullContext.recoveryCase?.id || null
            });
            console.log(`[AgentExecutionWorker] TriggerContext resolved for execution ${executionId}.`);
        } catch (error) {
            console.error(`[AgentExecutionWorker] Failed to resolve trigger context:`, error.message);
            // Optionally, handle failure to resolve context by halting or letting it fail down the line.
            throw error; // Re-throw to fail the job
        }

            let agentResponse = null;
            if (fullContext) {
                const { agentService, contextAssembler } = await import('../../../config/agent.config.js');

                const executionContext = await contextAssembler.assemble({
                    executionId,
                    eventId: execution.triggerId || executionId,
                    eventType: triggerType,
                    agentData: agentConfig,
                    recoveryContext: fullContext,
                    activeConnections
                });

                const prompt = `An event of type '${triggerType}' was triggered. Analyze the context and execute the appropriate recovery tools according to your rules.\n\nContext:\n${JSON.stringify(fullContext, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}`;

                console.log(`[AgentExecutionWorker] Invoking LangGraph for execution ${executionId}...`);
                agentResponse = await agentService.processMessage(prompt, {
                    agentData: agentConfig,
                    executionId,
                    recoveryContext: fullContext,
                    activeConnections,
                    executionContext
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
