import { SkillRegistryInterface } from './skill-registry.interface.js';
import Skill from './skill.js';

export class MemorySkillRegistry extends SkillRegistryInterface {
    constructor() {
        super();
        
        /** @type {Map<string, Skill>} */
        this.skills = new Map();
        
        this._initializeDefaultSkills();
    }

    _initializeDefaultSkills() {
        const paymentFailureRecovery = new Skill({
            id: 'payment_failure_recovery',
            version: 1,
            purpose: 'Recover failed payments without unnecessary customer contact.',
            supportedEvents: [
                'payment.failed',
                'payment.downtime.resolved'
            ],
            requiredContext: [
                'payment',
                'order',
                'failure',
                'downtimeCorrelation',
                'customerHistory'
            ],
            toolCategories: [
                'payment.read',
                'payment.recovery',
                'communication',
                'system.internal',
                'scheduling'
            ],
            instructions: [
                'Do not contact customers during active infrastructure downtime.',
                'Prefer retry when policy permits.',
                'Use payment links when direct retry is unavailable.',
                'Stop after payment success.'
            ]
        });

        this.skills.set(paymentFailureRecovery.id, paymentFailureRecovery);
    }

    /**
     * @param {string} skillId
     * @returns {Promise<Skill|null>}
     */
    async getSkill(skillId) {
        return this.skills.get(skillId) || null;
    }

    /**
     * @returns {Promise<Skill[]>}
     */
    async getAllSkills() {
        return Array.from(this.skills.values());
    }
}

export default MemorySkillRegistry;
