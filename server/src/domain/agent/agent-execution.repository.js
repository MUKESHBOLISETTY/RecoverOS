/**
 * @typedef {Object} AgentExecution
 * @property {string} id
 * @property {string} agentId
 * @property {number} agentVersion
 * @property {string} userId
 * @property {string} [eventId]
 * @property {string} eventType
 * @property {string} [provider]
 * @property {string} [externalEventId]
 * @property {string} status
 * @property {string} [recoveryCaseId]
 * @property {Object} [inputContext]
 * @property {Object} [decision]
 * @property {Object} [result]
 * @property {Object} [error]
 * @property {string} [jobId]
 * @property {Date} queuedAt
 * @property {Date} [startedAt]
 * @property {Date} [completedAt]
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

export class AgentExecutionRepository {
    /**
     * @param {Object} data 
     * @param {import('@prisma/client').PrismaClient} [tx]
     * @returns {Promise<AgentExecution>}
     */
    async create(data, tx) {
        throw new Error('Method not implemented.');
    }

    /**
     * @param {string} agentId 
     * @param {string} eventId 
     * @param {import('@prisma/client').PrismaClient} [tx]
     * @returns {Promise<AgentExecution | null>}
     */
    async findByAgentAndEvent(agentId, eventId, tx) {
        throw new Error('Method not implemented.');
    }

    /**
     * @param {string} id 
     * @returns {Promise<AgentExecution | null>}
     */
    async findById(id) {
        throw new Error('Method not implemented.');
    }

    /**
     * @param {string} id 
     * @param {Object} data 
     * @returns {Promise<AgentExecution>}
     */
    async update(id, data) {
        throw new Error('Method not implemented.');
    }
}

export default AgentExecutionRepository;
