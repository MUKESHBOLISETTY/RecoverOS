import { ExecutionContext } from './execution-context.js';

/**
 * @typedef {import('../skills/skill-loader.js').default} SkillLoader
 * @typedef {import('../policy/policy-context.builder.js').default} PolicyContextBuilder
 * @typedef {import('../tools/dynamic-tool.resolver.js').default} DynamicToolResolver
 */

export class ContextAssembler {
    /**
     * @param {SkillLoader} skillLoader
     * @param {PolicyContextBuilder} policyContextBuilder
     * @param {DynamicToolResolver} dynamicToolResolver
     */
    constructor(skillLoader, policyContextBuilder, dynamicToolResolver) {
        this.skillLoader = skillLoader;
        this.policyContextBuilder = policyContextBuilder;
        this.dynamicToolResolver = dynamicToolResolver;
    }

    /**
     * @param {Object} params
     * @param {string} params.executionId
     * @param {string} params.eventId
     * @param {string} params.eventType
     * @param {Object} params.agentData
     * @param {Object} params.recoveryContext
     * @param {Array<{connectorId: string, provider: string, capabilities: string[]}>} params.activeConnections
     * @returns {Promise<ExecutionContext>}
     */
    async assemble(params) {
        const {
            executionId,
            eventId,
            eventType,
            agentData,
            recoveryContext,
            activeConnections
        } = params;

        let skill;
        if (eventType === 'recovery.schedule') {
            skill = await this.skillLoader.loadFromRecoveryCase({
                recoveryCase: recoveryContext.recoveryCase,
                recoveryContext,
                agentData
            });
        } else {
            skill = await this.skillLoader.loadSkillForEvent({
                eventType,
                agentData,
                recoveryContext
            });
        }

        const policyContext = this.policyContextBuilder.build(agentData);

        const resolvedTools = await this.dynamicToolResolver.resolveTools({
            skill,
            agentAllowedActions: policyContext.allowedActions,
            activeConnections
        });

        return new ExecutionContext({
            executionId,
            agentId: agentData.id,
            agentVersion: agentData.version,
            eventId,
            userId: agentData.userId,
            recoveryContext,
            skill,
            policyContext,
            resolvedTools
        });
    }
}

export default ContextAssembler;
