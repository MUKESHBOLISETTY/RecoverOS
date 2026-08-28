/**
 * @typedef {import('./skill.js').default} Skill
 */

export class SkillRegistryInterface {
    /**
     * @param {string} skillId
     * @returns {Promise<Skill|null>}
     */
    async getSkill(skillId) {
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
