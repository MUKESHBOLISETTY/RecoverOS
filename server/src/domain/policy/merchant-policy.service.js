/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 */

export class MerchantPolicyService {
    /**
     * @param {PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * Get the merchant policy from the user's default agent.
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getPolicy(userId) {
        const agent = await this.prisma.agent.findFirst({
            where: {
                userId,
                name: "Revenue Recovery Agent"
            }
        });

        if (!agent) {
            throw new Error('Default agent not found for user');
        }

        return agent.rules || {};
    }

    /**
     * Update the merchant policy on the user's default agent.
     * @param {string} userId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updatePolicy(userId, updates) {
        const agent = await this.prisma.agent.findFirst({
            where: {
                userId,
                name: "Revenue Recovery Agent"
            }
        });

        if (!agent) {
            throw new Error('Default agent not found for user');
        }

        const currentRules = typeof agent.rules === 'object' ? agent.rules : {};
        
        const newRules = { ...currentRules };

        if (updates.maxDiscountPercentage !== undefined) {
            const val = Number(updates.maxDiscountPercentage);
            if (val >= 0 && val <= 100) {
                newRules.maxDiscountPercentage = val;
            } else {
                throw new Error('maxDiscountPercentage must be between 0 and 100');
            }
        }

        if (updates.maxFollowUps !== undefined) {
            const val = Number(updates.maxFollowUps);
            if (val >= 0 && val <= 10) {
                newRules.maxFollowUps = val;
            } else {
                throw new Error('maxFollowUps must be between 0 and 10');
            }
        }

        if (updates.escalationThreshold !== undefined) {
            const val = Number(updates.escalationThreshold);
            if (val >= 0) {
                newRules.escalationThreshold = val;
            } else {
                throw new Error('escalationThreshold must be non-negative');
            }
        }

        if (updates.checkoutAbandonmentEnabled !== undefined) {
            newRules.checkoutAbandonmentEnabled = Boolean(updates.checkoutAbandonmentEnabled);
        }

        if (updates.paymentFailureEnabled !== undefined) {
            newRules.paymentFailureEnabled = Boolean(updates.paymentFailureEnabled);
        }

        if (updates.recoveryWindowHours !== undefined) {
            const val = Number(updates.recoveryWindowHours);
            if (val > 0 && val <= 720) { // Max 30 days
                newRules.recoveryWindowHours = val;
            } else {
                throw new Error('recoveryWindowHours must be between 1 and 720');
            }
        }

        if (updates.dailyCommunicationLimit !== undefined) {
            const val = Number(updates.dailyCommunicationLimit);
            if (val >= 0 && val <= 10) {
                newRules.dailyCommunicationLimit = val;
            } else {
                throw new Error('dailyCommunicationLimit must be between 0 and 10');
            }
        }

        if (updates.communicationChannels !== undefined) {
            if (Array.isArray(updates.communicationChannels)) {
                const validChannels = ['EMAIL', 'SMS', 'WHATSAPP'];
                const filtered = updates.communicationChannels.filter(c => validChannels.includes(c));
                newRules.communicationChannels = filtered;
            } else {
                throw new Error('communicationChannels must be an array');
            }
        }

        if (updates.policyConfigured !== undefined) {
            newRules.policyConfigured = Boolean(updates.policyConfigured);
        }

        const updatedAgent = await this.prisma.agent.update({
            where: { id: agent.id },
            data: {
                rules: newRules
            }
        });

        return updatedAgent.rules;
    }
}

export default MerchantPolicyService;
