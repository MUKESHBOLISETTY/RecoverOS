/**
 * @typedef {import('./agent.repository.js').default} AgentRepository
 * @typedef {import('../connectors/connector.manager.js').default} ConnectorManager
 * @typedef {import('../../infrastructure/cache/redis-cache.service.js').RedisCacheService} RedisCacheService
 */

export class AgentTriggerService {
    /**
     * @param {AgentRepository} agentRepository 
     * @param {ConnectorManager} connectorManager
     * @param {RedisCacheService} [cacheService]
     */
    constructor(agentRepository, connectorManager, cacheService) {
        this.agentRepository = agentRepository;
        this.connectorManager = connectorManager;
        this.cacheService = cacheService;
    }

    /**
     * @param {string} userId
     * @param {string} eventType
     * @param {Object} eventPayload
     */
    async evaluateTriggers(userId, eventType, eventPayload) {
        if (!userId) {
            console.warn(`[AgentTriggerService] No userId provided for event ${eventType}. Skipping agent evaluation.`);
            return [];
        }

        try {
            let activeAgents = [];
            if (this.cacheService) {
                activeAgents = await this.cacheService.remember(
                    `active_agents:${userId}`,
                    3600,
                    () => this.agentRepository.findActiveByUserId(userId)
                );
            } else {
                activeAgents = await this.agentRepository.findActiveByUserId(userId);
            }

            if (!activeAgents || activeAgents.length === 0) {
                console.log(`[AgentTriggerService] No active agents found for user ${userId}.`);
                return [];
            }

            const triggeredAgents = [];

            for (const agent of activeAgents) {
                if (agent.triggers && agent.triggers.includes(eventType)) {

                    const validation = await this._validateAgentCapabilities(agent);

                    if (validation.isCapable) {
                        console.log(`[AgentTriggerService] Agent ${agent.id} (${agent.name}) matched trigger ${eventType} and passed capability validation.`);
                        triggeredAgents.push(agent);
                    } else {
                        console.warn(`[AgentTriggerService] Agent ${agent.id} (${agent.name}) matched trigger ${eventType} but FAILED capability validation. Missing capabilities: ${validation.missing.join(', ')}`);
                    }
                }
            }

            return triggeredAgents;

        } catch (error) {
            console.error(`[AgentTriggerService] Error evaluating triggers for user ${userId} and event ${eventType}:`, error);
            throw error;
        }
    }

    /**
     * @param {Object} agent 
     * @returns {Promise<{isCapable: boolean, missing: string[]}>}
     */
    async _validateAgentCapabilities(agent) {
        const required = agent.requiredCapabilities || [];
        if (required.length === 0) return { isCapable: true, missing: [] };

        const agentConnections = agent.connections || [];
        const availableCapabilities = new Set();

        for (const conn of agentConnections) {
            if (conn.connector) {
                availableCapabilities.add(conn.connector.category.toLowerCase());
                availableCapabilities.add(conn.connector.connectorId.toLowerCase());
                if (this.connectorManager && conn.connectorId) {
                    try {
                        const dynamicCaps = await this.connectorManager.getConnectorCapabilities(conn.connectorId);
                        for (const cap of dynamicCaps) {
                            availableCapabilities.add(cap.toLowerCase());
                        }
                    } catch (err) {
                        console.warn(`[AgentTriggerService] Failed to fetch dynamic capabilities for connection ${conn.connectorId}:`, err.message);
                    }
                }
            }
        }

        const missing = [];
        for (const req of required) {
            const reqLower = req.toLowerCase();
            if (!availableCapabilities.has(reqLower)) {
                missing.push(req);
            }
        }

        return { isCapable: missing.length === 0, missing };
    }

    /**
     * @param {string} userId 
     */
    async clearUserCache(userId) {
        if (this.cacheService) {
            await this.cacheService.del(`active_agents:${userId}`);
            console.log(`[AgentTriggerService] Cleared agent cache for user ${userId}`);
        }
    }
}

export default AgentTriggerService;
