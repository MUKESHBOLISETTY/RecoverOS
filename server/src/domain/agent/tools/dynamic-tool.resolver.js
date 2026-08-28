import { ResolvedTool } from './resolved-tool.js';

/**
 * @typedef {import('./tool-registry.interface.js').default} ToolRegistry
 * @typedef {import('../skills/skill.js').default} Skill
 * @typedef {import('./tool-definition.js').default} ToolDefinition
 */

export class DynamicToolResolver {
    /**
     * @param {ToolRegistry} toolRegistry
     */
    constructor(toolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    /**
     * @param {Object} params
     * @param {Skill} params.skill
     * @param {string[]} params.agentAllowedActions allowed actions from the agent's policy/rules
     * @param {Array<{connectorId: string, provider: string, capabilities: string[]}>} params.activeConnections
     * @returns {Promise<ResolvedTool[]>}
     */
    async resolveTools({ skill, agentAllowedActions, activeConnections }) {
        if (!skill || !agentAllowedActions || !activeConnections) {
            return [];
        }

        const resolvedTools = [];

        for (const category of skill.toolCategories) {
            const categoryTools = await this.toolRegistry.getToolsByCategory(category);

            for (const toolDef of categoryTools) {
                // not allowed by policy
                if (!agentAllowedActions.includes(toolDef.action)) {
                    continue;
                }

                if (toolDef.requiresCapability === 'system.internal') {
                    resolvedTools.push(new ResolvedTool({
                        definition: toolDef,
                        connectorId: 'system',
                        provider: 'system'
                    }));
                    continue;
                }

                // active connector for required capability
                const matchingConnection = this._findCapableConnection(toolDef.requiresCapability, activeConnections);

                if (matchingConnection) {
                    resolvedTools.push(new ResolvedTool({
                        definition: toolDef,
                        connectorId: matchingConnection.connectorId,
                        provider: matchingConnection.provider
                    }));
                }
            }
        }

        return resolvedTools;
    }

    /**
     * @param {string} capability 
     * @param {Array<{connectorId: string, provider: string, capabilities: string[]}>} activeConnections 
     * @returns {Object|null}
     */
    _findCapableConnection(capability, activeConnections) {
        if (!capability) return null;

        for (const conn of activeConnections) {
            if (conn.capabilities && conn.capabilities.includes(capability)) {
                return conn;
            }
        }
        return null;
    }
}

export default DynamicToolResolver;
