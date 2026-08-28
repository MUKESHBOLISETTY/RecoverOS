/**
 * @typedef {import('../skills/skill.js').default} Skill
 * @typedef {import('../policy/policy-context.js').default} PolicyContext
 * @typedef {import('../tools/resolved-tool.js').default} ResolvedTool
 */

export class ExecutionContext {
    /**
     * @param {Object} data
     * @param {string} data.executionId
     * @param {string} data.agentId
     * @param {number} data.agentVersion
     * @param {string} data.eventId
     * @param {string} data.userId
     * @param {Object} data.recoveryContext
     * @param {Skill} data.skill
     * @param {PolicyContext} data.policyContext
     * @param {ResolvedTool[]} data.resolvedTools
     */
    constructor(data) {
        this.executionId = data.executionId;
        this.agentId = data.agentId;
        this.agentVersion = data.agentVersion;
        this.eventId = data.eventId;
        this.userId = data.userId;
        this.recoveryContext = data.recoveryContext;
        this.skill = data.skill;
        this.policyContext = data.policyContext;
        this.resolvedTools = data.resolvedTools;
    }
}

export default ExecutionContext;
