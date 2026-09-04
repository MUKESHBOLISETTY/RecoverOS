/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 */

export class InsightsService {
    /**
     * @param {PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * Get dashboard metrics for a specific merchant (userId).
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getDashboardMetrics(userId) {
        if (!userId) {
            throw new Error('InsightsService: userId is required');
        }
        
        const cases = await this.prisma.recoveryCase.findMany({
            where: { userId },
            include: {
                outcome: true,
                actions: true
            }
        });

        let totalCases = cases.length;
        let activeCases = 0;
        let recoveredCases = 0;
        let stoppedCases = 0;
        let revenueAtRisk = 0n;
        let recoveredRevenue = 0n;

        const recoveryByType = {
            checkoutAbandonment: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n },
            paymentFailure: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n }
        };

        const recoveryByIntervention = {
            email: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n },
            sms: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n },
            discount: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n },
            paymentLink: { cases: 0, recoveredCases: 0, recoveredRevenue: 0n }
        };

        const recoveryOverTime = {};

        for (const c of cases) {
            const isRecovered = c.status === 'RECOVERED';
            const isStopped = ['STOPPED', 'FAILED', 'EXPIRED'].includes(c.status);

            if (['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED'].includes(c.status)) {
                activeCases++;
            } else if (isRecovered) {
                recoveredCases++;
            } else if (isStopped) {
                stoppedCases++;
            }

            const caseRevenueAtRisk = c.revenueAtRisk ? BigInt(c.revenueAtRisk) : 0n;
            const caseRecoveredRevenue = (c.outcome && c.outcome.amountRecovered) ? BigInt(c.outcome.amountRecovered) : 0n;

            revenueAtRisk += caseRevenueAtRisk;

            recoveredRevenue += caseRecoveredRevenue;

            const typeKey = c.type === 'CART_ABANDONMENT' ? 'checkoutAbandonment' : 'paymentFailure';
            recoveryByType[typeKey].cases++;
            if (isRecovered) {
                recoveryByType[typeKey].recoveredCases++;
                recoveryByType[typeKey].recoveredRevenue += caseRecoveredRevenue;
            }

            if (c.actions && c.actions.length > 0) {
                const involvedInterventions = new Set();
                
                for (const action of c.actions) {
                    if (action.type === 'EMAIL') involvedInterventions.add('email');
                    if (action.type === 'SMS') involvedInterventions.add('sms');
                    if (action.type === 'DISCOUNT') involvedInterventions.add('discount');
                    
                    if (action.type === 'PAYMENT_LINK') involvedInterventions.add('paymentLink');
                }

                for (const intervention of involvedInterventions) {
                    if (recoveryByIntervention[intervention]) {
                        recoveryByIntervention[intervention].cases++;
                        if (isRecovered) {
                            recoveryByIntervention[intervention].recoveredCases++;
                            recoveryByIntervention[intervention].recoveredRevenue += caseRecoveredRevenue;
                        }
                    }
                }
            }

            if (isRecovered && c.outcome) {
                const dateKey = new Date(c.outcome.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
                if (!recoveryOverTime[dateKey]) {
                    recoveryOverTime[dateKey] = 0n;
                }
                recoveryOverTime[dateKey] += caseRecoveredRevenue;
            }
        }

        const recoveryRate = totalCases > 0 ? (recoveredCases / totalCases) : 0;

        const formatNestedBigInts = (obj) => {
            const result = {};
            for (const [key, val] of Object.entries(obj)) {
                if (typeof val === 'bigint') {
                    result[key] = val.toString();
                } else if (typeof val === 'object' && val !== null) {
                    result[key] = formatNestedBigInts(val);
                } else {
                    result[key] = val;
                }
            }
            return result;
        };

        const serializedRecoveryByType = formatNestedBigInts(recoveryByType);
        const serializedRecoveryByIntervention = formatNestedBigInts(recoveryByIntervention);
        
        const timeSeries = Object.entries(recoveryOverTime)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([date, amount]) => ({
                date,
                amount: amount.toString()
            }));

        return {
            totalCases,
            activeCases,
            recoveredCases,
            stoppedCases,
            revenueAtRisk: revenueAtRisk.toString(),
            recoveredRevenue: recoveredRevenue.toString(),
            recoveryRate,
            recoveryByType: serializedRecoveryByType,
            recoveryByIntervention: serializedRecoveryByIntervention,
            recoveryOverTime: timeSeries
        };
    }
}

export default InsightsService;
