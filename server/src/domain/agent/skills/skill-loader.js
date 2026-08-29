/**
 * @typedef {import('./skill-registry.interface.js').default} SkillRegistry
 * @typedef {import('./skill-selector.js').default} SkillSelector
 * @typedef {import('./skill-validator.js').default} SkillValidator
 * @typedef {import('./skill.js').default} Skill
 */

export class SkillLoader {
    /**
     * @param {SkillRegistry} skillRegistry
     * @param {SkillSelector} skillSelector
     * @param {SkillValidator} skillValidator
     */
    constructor(skillRegistry, skillSelector, skillValidator) {
        this.skillRegistry = skillRegistry;
        this.skillSelector = skillSelector;
        this.skillValidator = skillValidator;
    }

    /**
     * @param {Object} params
     * @param {string} params.eventType
     * @param {Object} params.agentData
     * @param {Object} params.recoveryContext
     * @returns {Promise<Skill>} loaded and validated skill
     * @throws {Error}
     */
    async loadSkillForEvent({ eventType, agentData, recoveryContext }) {
        const skillId = this.skillSelector.selectForTrigger({ eventType, agentData });

        if (!skillId) {
            throw new Error(`[SkillLoader] No applicable skill found for event ${eventType}`);
        }

        const skill = await this.skillRegistry.getSkill(skillId);

        if (!skill) {
            throw new Error(`[SkillLoader] Skill ${skillId} selected but not found in registry.`);
        }

        this.skillValidator.validate({
            skill,
            eventType,
            recoveryContext,
            agentData
        });

        return skill;
    }

    /**
     * @param {Object} params
     * @param {Object} params.recoveryCase
     * @param {Object} params.recoveryContext
     * @param {Object} params.agentData
     * @returns {Promise<Skill>} loaded and validated skill
     * @throws {Error}
     */
    async loadFromRecoveryCase({ recoveryCase, recoveryContext, agentData }) {
        if (!recoveryCase.activeSkillId) {
            throw new Error(`[SkillLoader] RecoveryCase ${recoveryCase.id} has no activeSkillId.`);
        }

        const skill = await this.skillRegistry.getSkill(recoveryCase.activeSkillId, recoveryCase.activeSkillVersion);

        if (!skill) {
            throw new Error(`[SkillLoader] Exact Skill ${recoveryCase.activeSkillId} (v${recoveryCase.activeSkillVersion}) not found.`);
        }

        this.skillValidator.validate({
            skill,
            eventType: 'recovery.schedule',
            recoveryContext,
            agentData
        });

        return skill;
    }
}

export default SkillLoader;
