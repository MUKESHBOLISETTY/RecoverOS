/**
 * @typedef {import('./skill.js').default} Skill
 */

export class SkillValidator {
    /**
     * @param {Object} params
     * @param {Skill} params.skill
     * @param {string} params.eventType
     * @param {Object} params.recoveryContext
     * @param {Object} params.agentData
     */
    validate({ skill, eventType, recoveryContext, agentData }) {
        if (!skill) {
            throw new Error('[SkillValidator] Skill is null or undefined.');
        }

        this._validateSupportedEvent(skill, eventType);
        this._validateRequiredContext(skill, recoveryContext);
        this._validateIncompatibleCombinations(skill, agentData);
    }

    /**
     * @param {Skill} skill 
     * @param {string} eventType 
     */
    _validateSupportedEvent(skill, eventType) {
        if (!skill.supportedEvents.includes(eventType)) {
            throw new Error(`[SkillValidator] Skill ${skill.id} does not support event ${eventType}`);
        }
    }

    /**
     * @param {Skill} skill 
     * @param {Object} recoveryContext 
     */
    _validateRequiredContext(skill, recoveryContext) {
        if (!recoveryContext) {
            if (skill.requiredContext.length > 0) {
                throw new Error(`[SkillValidator] RecoveryContext is missing, but skill ${skill.id} requires: ${skill.requiredContext.join(', ')}`);
            }
            return;
        }

        for (const req of skill.requiredContext) {
            if (recoveryContext[req] === undefined || recoveryContext[req] === null) {
                throw new Error(`[SkillValidator] Missing required context property '${req}' for skill ${skill.id}`);
            }
        }
    }

    /**
     * @param {Skill} skill 
     * @param {Object} agentData 
     */
    _validateIncompatibleCombinations(skill, agentData) {
        if (!agentData) {
            throw new Error(`[SkillValidator] AgentData is missing.`);
        }

        if (skill.version < 1) {
            throw new Error(`[SkillValidator] Skill ${skill.id} version ${skill.version} is not supported.`);
        }
    }
}

export default SkillValidator;
