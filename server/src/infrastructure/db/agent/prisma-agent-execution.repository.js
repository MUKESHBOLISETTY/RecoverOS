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
                throw new DuplicateExecutionError(data.agentId, data.eventId);
            }
            throw error;
        }
    }

    /**
     * @param {string} agentId 
     * @param {string} eventId 
     * @param {import('@prisma/client').PrismaClient} [tx] 
     */
    async findByAgentAndEvent(agentId, eventId, tx) {
        const client = tx || this.prisma;
        return await client.agentExecution.findUnique({
            where: {
                agentId_eventId: {
                    agentId,
                    eventId
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
}

export default PrismaAgentExecutionRepository;
