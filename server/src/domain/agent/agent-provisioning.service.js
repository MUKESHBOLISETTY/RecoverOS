/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 */

export class AgentProvisioningService {
    /**
     * @param {PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
        
        this.defaultAgentSpec = {
            name: "Revenue Recovery Agent",
            version: 1,
            description: "Automatically recovers revenue from failed payments and abandoned carts using safe, bounded merchant policies.",
            purpose: "Detect revenue at risk, determine the right intervention, and execute a bounded recovery workflow.",
            triggers: [
                "payment.failed",
                "checkout.abandoned"
            ],
            requiredCapabilities: [
                "SEND_EMAIL",
                "CREATE_DISCOUNT",
                "CREATE_PAYMENT_LINK"
            ],
            rules: {
                maxDiscountPercentage: 20,
                maxFollowUps: 3,
                escalationThreshold: 500000 // 5000 in minor units
            },
            actions: [
                "EMAIL",
                "DISCOUNT",
                "PAYMENT_LINK"
            ],
            stopConditions: [
                "RECOVERED",
                "MAX_ATTEMPTS_REACHED",
                "CUSTOMER_OPT_OUT"
            ]
        };
    }

    /**
     * Idempotently provision the default agent for a user.
     * @param {string} userId
     * @returns {Promise<Object>} The provisioned agent
     */
    async provisionDefaultAgent(userId) {
        if (!userId) {
            throw new Error('userId is required for agent provisioning');
        }

        const existingAgent = await this.prisma.agent.findFirst({
            where: {
                userId,
                name: this.defaultAgentSpec.name
            }
        });

        if (existingAgent) {
            return existingAgent;
        }

        const agent = await this.prisma.agent.create({
            data: {
                userId,
                name: this.defaultAgentSpec.name,
                version: this.defaultAgentSpec.version,
                description: this.defaultAgentSpec.description,
                purpose: this.defaultAgentSpec.purpose,
                triggers: this.defaultAgentSpec.triggers,
                requiredCapabilities: this.defaultAgentSpec.requiredCapabilities,
                rules: this.defaultAgentSpec.rules,
                actions: this.defaultAgentSpec.actions,
                stopConditions: this.defaultAgentSpec.stopConditions,
                spec: this.defaultAgentSpec,
                status: 'ACTIVE'
            }
        });

        console.log(`[AgentProvisioningService] Provisioned default agent for user ${userId}`);
        return agent;
    }

    /**
     * Backfill agents for all users who do not have one.
     * @returns {Promise<number>} Number of users backfilled
     */
    async backfillAgents() {
        const users = await this.prisma.user.findMany({
            include: {
                agents: true
            }
        });

        let provisionedCount = 0;
        for (const user of users) {
            const hasDefaultAgent = user.agents.some(a => a.name === this.defaultAgentSpec.name);
            if (!hasDefaultAgent) {
                await this.provisionDefaultAgent(user.id);
                provisionedCount++;
            }
        }

        console.log(`[AgentProvisioningService] Backfilled default agents for ${provisionedCount} users.`);
        return provisionedCount;
    }
}

export default AgentProvisioningService;
