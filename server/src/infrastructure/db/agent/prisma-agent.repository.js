import { AgentRepository } from '../../../domain/agent/agent.repository.js';

export class PrismaAgentRepository extends AgentRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma 
     */
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }

    /**
     * @param {string} userId 
     * @returns {Promise<Array<Object>>}
     */
    async findActiveByUserId(userId) {
        return this.prisma.agent.findMany({
            where: {
                userId: userId,
                status: 'ACTIVE'
            },
            include: {
                connections: {
                    include: {
                        connector: true
                    }
                }
            }
        });
    }

    /**
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        return this.prisma.agent.findUnique({
            where: { id },
            include: {
                connections: {
                    include: {
                        connector: true
                    }
                }
            }
        });
    }

    /**
     * @param {string} userId
     * @param {string} connectorId 
     */
    async attachCredentialToActiveAgents(userId, connectorId) {
        return this.prisma.$transaction(async (tx) => {
            const activeAgents = await tx.agent.findMany({
                where: { userId, status: 'ACTIVE' },
                select: { id: true }
            });

            const results = [];
            for (const agent of activeAgents) {
                const agentConnector = await tx.agentConnector.upsert({
                    where: {
                        agentId_connectorId: {
                            agentId: agent.id,
                            connectorId
                        }
                    },
                    update: {},
                    create: {
                        agentId: agent.id,
                        connectorId
                    }
                });
                results.push(agentConnector);
            }
            return results;
        });
    }
}

export default PrismaAgentRepository;
