import { CorrelationRules } from './correlation-rules.js';

export class CorrelationEngine {
    /**
     * @param {import('./payment-downtime.repository.js').PaymentDowntimeRepository} paymentDowntimeRepository
     * @param {import('./payment-failure-correlation.repository.js').PaymentFailureCorrelationRepository} paymentFailureCorrelationRepository
     * @param {import('../../infrastructure/cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(paymentDowntimeRepository, paymentFailureCorrelationRepository, cacheService = null) {
        this.paymentDowntimeRepository = paymentDowntimeRepository;
        this.paymentFailureCorrelationRepository = paymentFailureCorrelationRepository;
        this.cacheService = cacheService;
        this.CACHE_KEY = 'correlation:active_downtimes';
    }

    async refreshDowntimesCache() {
        if (!this.cacheService) return null;

        const activeDowntimes = await this.paymentDowntimeRepository.findActive();

        await this.cacheService.setJson(this.CACHE_KEY, activeDowntimes, 3600); // 1 hour
        return activeDowntimes;
    }

    /**
     * @param {Object} payment - payment object
     * @returns {Promise<Object[]>} - Array of correlations (matchstages)
     */
    async correlatePaymentFailure(payment) {
        let candidateDowntimes = [];

        if (this.cacheService) {
            const cached = await this.cacheService.getJson(this.CACHE_KEY);
            if (cached) {
                candidateDowntimes = cached;
            } else {
                candidateDowntimes = await this.refreshDowntimesCache();
            }
        } else {
            candidateDowntimes = await this.paymentDowntimeRepository.findActive();
        }

        //remove resolved downtimes that ended before payment
        candidateDowntimes = candidateDowntimes.filter(dt => {
            if (dt.status === 'RESOLVED' && dt.end) {
                return new Date(dt.end) >= new Date(payment.paymentCreatedAt);
            }
            return true;
        });

        if (candidateDowntimes.length === 0) return [];

        const correlations = [];

        for (const downtime of candidateDowntimes) {
            const { score, matchedSignals } = CorrelationRules.evaluate(payment, downtime);
            const confidence = CorrelationRules.getConfidence(score);

            if (score > 0) {
                const correlation = await this.paymentFailureCorrelationRepository.upsertCorrelation(
                    payment,
                    downtime,
                    confidence === 'HIGH' ? 'MATCHED' : 'CANDIDATE',
                    confidence,
                    score,
                    matchedSignals
                );
                correlations.push(correlation);
            }
        }

        return correlations;
    }

    /**
     * @param {string} downtimeId 
     */
    async reevaluateCorrelationsForDowntime(downtimeId) {
        const downtime = await this.paymentDowntimeRepository.findById(downtimeId);

        if (!downtime) return;

        const BATCH_SIZE = 500;
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            const batch = await this.paymentFailureCorrelationRepository.findBatchByDowntimeId(downtimeId, cursor, BATCH_SIZE);

            if (batch.length === 0) {
                hasMore = false;
                break;
            }

            await this.paymentFailureCorrelationRepository.updateBatch(batch, downtime);

            if (batch.length === BATCH_SIZE) {
                cursor = batch[batch.length - 1].id;
            } else {
                hasMore = false;
            }
        }
    }
}
