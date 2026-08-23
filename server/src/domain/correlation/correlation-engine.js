import { CorrelationRules } from './correlation-rules.js';

export class CorrelationEngine {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     * @param {import('../../services/cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(prisma, cacheService = null) {
        this.prisma = prisma;
        this.cacheService = cacheService;
        this.CACHE_KEY = 'correlation:active_downtimes';
    }

    async refreshDowntimesCache() {
        if (!this.cacheService) return null;

        const activeDowntimes = await this.prisma.paymentDowntime.findMany({
            where: {
                OR: [
                    { status: 'STARTED' },
                    { status: 'UPDATED' },
                    { status: 'RESOLVED' }
                ]
            }
        });

        await this.cacheService.set(this.CACHE_KEY, JSON.stringify(activeDowntimes), 3600); // 1 hour
        return activeDowntimes;
    }

    /**
     * @param {Object} payment - payment object
     * @returns {Promise<Object[]>} - Array of correlations (matchstages)
     */
    async correlatePaymentFailure(payment) {
        let candidateDowntimes = [];

        if (this.cacheService) {
            const cached = await this.cacheService.get(this.CACHE_KEY);
            if (cached) {
                candidateDowntimes = JSON.parse(cached);
            } else {
                candidateDowntimes = await this.refreshDowntimesCache();
            }
        } else {
            candidateDowntimes = await this.prisma.paymentDowntime.findMany({
                where: {
                    OR: [
                        { status: 'STARTED' },
                        { status: 'UPDATED' },
                        { status: 'RESOLVED' }
                    ]
                }
            });
        }

        //remove resolved downtimes that ended before payment
        candidateDowntimes = candidateDowntimes.filter(dt => {
            if (dt.status === 'RESOLVED' && dt.end) {
                return new Date(dt.end) >= new Date(payment.paymentCreatedAt);
            }
            return true;
        });

        if (candidateDowntimes.length === 0) return [];

        return await this.prisma.$transaction(async (tx) => {
            const correlations = [];

            for (const downtime of candidateDowntimes) {
                const { score, matchedSignals } = CorrelationRules.evaluate(payment, downtime);
                const confidence = CorrelationRules.getConfidence(score);

                if (score > 0) {
                    const correlation = await tx.paymentFailureCorrelation.upsert({
                        where: {
                            paymentId_downtimeId: {
                                paymentId: payment.id,
                                downtimeId: downtime.id
                            }
                        },
                        update: {
                            status: confidence === 'HIGH' ? 'MATCHED' : 'CANDIDATE',
                            confidence,
                            score,
                            matchedSignals,
                            evaluatedAt: new Date()
                        },
                        create: {
                            paymentId: payment.id,
                            downtimeId: downtime.id,
                            status: confidence === 'HIGH' ? 'MATCHED' : 'CANDIDATE',
                            confidence,
                            score,
                            matchedSignals,
                            paymentContext: payment,
                            downtimeContext: downtime,
                            explanation: `Payment failed with ${matchedSignals.length} matched signals including ${matchedSignals.join(', ')}.`
                        }
                    });

                    correlations.push(correlation);
                }
            }

            return correlations;
        });
    }

    /**
     * @param {string} downtimeId 
     */
    async reevaluateCorrelationsForDowntime(downtimeId) {
        const downtime = await this.prisma.paymentDowntime.findUnique({
            where: { id: downtimeId }
        });

        if (!downtime) return;

        const BATCH_SIZE = 500;
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            const queryParams = {
                where: { downtimeId },
                include: { payment: true },
                take: BATCH_SIZE,
                orderBy: { id: 'asc' }
            };

            if (cursor) {
                queryParams.cursor = { id: cursor };
                queryParams.skip = 1;
            }

            const batch = await this.prisma.paymentFailureCorrelation.findMany(queryParams);

            if (batch.length === 0) {
                hasMore = false;
                break;
            }

            await this.prisma.$transaction(async (tx) => {
                for (const correlation of batch) {
                    const { score, matchedSignals } = CorrelationRules.evaluate(correlation.payment, downtime);
                    const confidence = CorrelationRules.getConfidence(score);

                    await tx.paymentFailureCorrelation.update({
                        where: { id: correlation.id },
                        data: {
                            status: confidence === 'HIGH' ? 'MATCHED' : 'CANDIDATE',
                            confidence,
                            score,
                            matchedSignals,
                            evaluatedAt: new Date(),
                            downtimeContext: downtime
                        }
                    });
                }
            });

            if (batch.length === BATCH_SIZE) {
                cursor = batch[batch.length - 1].id;
            } else {
                hasMore = false;
            }
        }
    }
}
