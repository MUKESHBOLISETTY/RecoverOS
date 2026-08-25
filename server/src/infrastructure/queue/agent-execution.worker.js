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

            //agent runtime service

            await this.prisma.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'SUCCEEDED',
                    completedAt: new Date(),
                    result: { note: 'Placeholder for future integration' }
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
