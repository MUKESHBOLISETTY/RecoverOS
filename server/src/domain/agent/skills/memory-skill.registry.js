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
                'payment.downtime.resolved',
                'recovery.schedule'
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

        const recoveryReEvaluation = new Skill({
            id: 'recovery_re_evaluation',
            version: 1,
            purpose: 'Re-evaluate an existing recovery case upon a scheduled follow-up or manual retry.',
            supportedEvents: [
                'recovery.schedule'
            ],
            requiredContext: [
                'recoveryCase',
                'recoveryHistory'
            ],
            toolCategories: [
                'payment.read',
                'payment.recovery',
                'communication',
                'system.internal',
                'scheduling'
            ],
            instructions: [
                'Review the previous recovery actions in the history.',
                'Do not blindly repeat the same actions that have already failed.',
                'If the payment was successful, stop the recovery process.',
                'If limits are reached, escalate the case.',
                'Choose a safe next step based on the current policy.'
            ]
        });

        this.skills.set(recoveryReEvaluation.id, recoveryReEvaluation);

        const cartAbandonmentRecovery = new Skill({
            id: 'cart_abandonment_recovery',
            version: 1,
            purpose: 'Recover abandoned checkout sessions via customer communication.',
            supportedEvents: [
                'checkout.abandoned',
                'recovery.schedule'
            ],
            requiredContext: [
                'checkout',
                'customer',
                'recoveryHistory'
            ],
            toolCategories: [
                'communication',
                'system.internal',
                'commerce.discount'
            ],
            instructions: [
                'Choose the most appropriate available communication channel based on customer context.',
                'Personalize messages using customer name and cart contents.',
                'Include the Shopify checkout recovery URL provided in the context. Do not modify it.',
                'Do not assume email is the only option; use SMS or WhatsApp if more appropriate or if it is the only channel available.',
                'If the case is RECOVERED, make no customer communication attempt.',
                'The agent MAY consider offering a discount when it is appropriate to improve conversion. Consider engagement, cart value, and history.',
                'If a discount is requested, propose an appropriate percentage. The maximum discount limit is enforced by the system, so if the discount tool rejects the request, adapt the response appropriately without retrying with an unauthorized percentage or fabricating a code.',
                'When the discount tool succeeds, it returns a discount code. Use that exact discount code in your subsequent communication tool call.',
                'Never fabricate a discount code, and never generate Razorpay payment links.',
                'Escalate to human review only if customer context indicates it is strictly necessary.'
            ]
        });

        this.skills.set(cartAbandonmentRecovery.id, cartAbandonmentRecovery);

    }

    /**
     * @param {string} skillId
     * @param {number} [version]
     * @returns {Promise<Skill|null>}
     */
    async getSkill(skillId, version = null) {
        const skill = this.skills.get(skillId);
        if (!skill) return null;
        if (version !== null && skill.version !== version) {
            console.warn(`[MemorySkillRegistry] Skill ${skillId} version mismatch. Requested: ${version}, Available: ${skill.version}`);
            return null;
        }
        return skill;
    }

    /**
     * @returns {Promise<Skill[]>}
     */
    async getAllSkills() {
        return Array.from(this.skills.values());
    }
}

export default MemorySkillRegistry;
