/**
 * @typedef {import('./skill.js').default} Skill
 */

export class SkillRegistryInterface {
    /**
     * @param {string} skillId
     * @param {number} [version]
     * @returns {Promise<Skill|null>}
     */
    async getSkill(skillId, version = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * @returns {Promise<Skill[]>}
     */
    async getAllSkills() {
        throw new Error('Method not implemented.');
    }
}

export default SkillRegistryInterface;
