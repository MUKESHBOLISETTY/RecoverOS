import { AgentExecutionRepository } from '../../../domain/agent/agent-execution.repository.js';

export class PrismaAgentExecutionRepository extends AgentExecutionRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma 
     */
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }

    /**
     * @param {Object} data 
     * @param {import('@prisma/client').PrismaClient} [tx] 
     */
    async create(data, tx) {
        const client = tx || this.prisma;
        try {
            return await client.agentExecution.create({
                data
            });
        } catch (error) {
            if (error.code === 'P2002') {
                const { DuplicateExecutionError } = await import('../../../domain/agent/errors/duplicate-execution.error.js');
                throw new DuplicateExecutionError(data.agentId, data.triggerId);
            }
            throw error;
        }
    }

    /**
     * @param {string} agentId
     * @param {string} triggerType
     * @param {string|null} triggerId
     * @param {import('@prisma/client').PrismaClient} [tx]
     */
    async findByAgentAndEvent(agentId, triggerType, triggerId, tx) {
        const client = tx || this.prisma;
        return await client.agentExecution.findUnique({
            where: {
                agentId_triggerType_triggerId: {
                    agentId,
                    triggerType,
                    triggerId: triggerId || null
                }
            }
        });
    }

    /**
     * @param {string} id 
     */
    async findById(id) {
        return await this.prisma.agentExecution.findUnique({
            where: { id }
        });
    }

    /**
     * @param {string} id 
     * @param {Object} data 
     */
    async update(id, data) {
        return await this.prisma.agentExecution.update({
            where: { id },
            data
        });
    }

    async markCompleted(executionId, result) {
        return await this.prisma.$transaction(async (tx) => {
            return await tx.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'SUCCEEDED',
                    result: result || {},
                    completedAt: new Date()
                }
            });
        });
    }

    async markFailed(executionId, error) {
        return await this.prisma.$transaction(async (tx) => {
            return await tx.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'FAILED',
                    error: error || {},
                    completedAt: new Date()
                }
            });
        });
    }

    async markBlocked(executionId, decision) {
        return await this.prisma.$transaction(async (tx) => {
            return await tx.agentExecution.update({
                where: { id: executionId },
                data: {
                    status: 'BLOCKED',
                    decision: decision || {},
                    completedAt: new Date()
                }
            });
        });
    }
}

export default PrismaAgentExecutionRepository;
