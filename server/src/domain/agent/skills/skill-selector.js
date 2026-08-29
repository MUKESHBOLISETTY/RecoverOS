export class SkillSelector {
    constructor() {
        /** 
         * @type {Record<string, string>}
         */
        this.eventMap = { //static mapping for testing
            'payment.failed': 'payment_failure_recovery',
            'payment.downtime.resolved': 'payment_failure_recovery'
        };
    }

    /**
     * @param {Object} params
     * @param {string} params.eventType
     * @param {Object} params.agentData
     * @returns {string|null} skill id or null
     */
    selectForTrigger({ eventType, agentData }) {
        if (!eventType || !agentData) {
            return null;
        }

        const supportsTrigger = agentData.triggers && agentData.triggers.includes(eventType);
        if (!supportsTrigger) {
            console.warn(`[SkillSelector] Agent ${agentData.id} does not support event ${eventType}`);
            return null;
        }
        // static mapping for now
        const skillId = this.eventMap[eventType];
        if (!skillId) {
            console.warn(`[SkillSelector] No skill mapping found for event ${eventType}`);
            return null;
        }

        return skillId;
    }
}

export default SkillSelector;
