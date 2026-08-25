import { BaseWorkerService } from './base-worker.service.js';

export class AgentExecutionWorker extends BaseWorkerService {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma 
     */
    constructor(prisma) {
        super('agent-execution');
        this.prisma = prisma;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        const { executionId } = job.data;
        console.log(`[AgentExecutionWorker] Processing job ${job.id} for execution ${executionId}`);

        try {
            const execution = await this.prisma.agentExecution.findUnique({
                where: { id: executionId }
            });

            if (!execution) {
                throw new Error(`Execution record ${executionId} not found`);
            }

            if (execution.status !== 'QUEUED') {
                console.log(`[AgentExecutionWorker] Execution ${executionId} is already in status ${execution.status}. Skipping.`);
                return;
            }

            await this.prisma.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date()
                }
            });

            console.log(`[AgentExecutionWorker] Execution ${executionId} is now RUNNING.`);

            const { eventType, inputContext, provider } = execution;
            let fullContext = null;

            if (eventType && eventType.startsWith('payment.')) {
                console.log(`[AgentExecutionWorker] Detected payment event. Building RecoveryContext...`);

                const { RecoveryContextBuilder } = await import('../../domain/recovery/recovery-context.builder.js');
                const { FailureDiagnosisService } = await import('../../domain/recovery/failure-diagnosis.service.js');
                const { OrderContextService } = await import('../../domain/recovery/order-context.service.js');
                const { RazorpayOrderRepository } = await import('../../infrastructure/razorpay/razorpay-order.repository.js');
                const { cacheService } = await import('../../../config/redis.config.js');
                const { connectorManager } = await import('../../../config/connectors.config.js');

                const paymentId = inputContext?.paymentId;

                if (paymentId) {
                    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });

                    if (payment) {
                        let credentials = {};
                        if (payment.connectionId) {
                            credentials = await connectorManager.getDecryptedCredentialsById(payment.connectionId) || {};
                        }

                        const failureDiagnosisService = new FailureDiagnosisService();
                        const orderRepository = new RazorpayOrderRepository(credentials);
                        const orderContextService = new OrderContextService(orderRepository, cacheService);
                        const contextBuilder = new RecoveryContextBuilder(failureDiagnosisService, orderContextService);

                        const downtimeCorrelation = await this.prisma.paymentFailureCorrelation.findFirst({
                            where: { paymentId: payment.id },
                            orderBy: { evaluatedAt: 'desc' }
                        });

                        const agentConfig = await this.prisma.agent.findUnique({ where: { id: execution.agentId } });

                        fullContext = await contextBuilder.buildContext({
                            event: {
                                id: execution.eventId,
                                type: execution.eventType,
                                occurredAt: new Date().toISOString()
                            },
                            payment,
                            provider,
                            downtimeCorrelation,
                            agent: agentConfig
                        });

                        console.log(`[AgentExecutionWorker] Successfully built RecoveryContext for payment ${payment.id}.`);
                    }
                }
                //we will implement this later
            } else if (eventType && eventType.startsWith('cart.')) {
                console.log(`[AgentExecutionWorker] Detected cart event. Placeholder for CartContextBuilder.`);
                // fullContext = await cartContextBuilder.buildContext({...})
            }

            if (fullContext) {
                await this.prisma.agentExecution.update({
                    where: { id: executionId },
                    data: {
                        inputContext: fullContext
                    }
                });
            }

            //agent runtime service placeholder

            await this.prisma.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'SUCCEEDED',
                    completedAt: new Date(),
                    result: { note: 'Placeholder for future integration', contextBuilt: !!fullContext }
                }
            });

            console.log(`[AgentExecutionWorker] Execution ${executionId} SUCCEEDED.`);

        } catch (error) {
            console.error(`[AgentExecutionWorker] Failed to process execution ${executionId}:`, error);

            try {
                await this.prisma.agentExecution.update({
                    where: { id: executionId },
                    data: {
                        status: 'FAILED',
                        completedAt: new Date(),
                        error: { message: error.message || 'Unknown error' }
                    }
                });
            } catch (dbError) {
                console.error(`[AgentExecutionWorker] Failed to update error status for ${executionId}:`, dbError);
            }

            throw error;
        }
    }
}

export default AgentExecutionWorker;
