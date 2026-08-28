/**
 * @type {Set<string>}
 */
const SCHEDULE_ELIGIBLE_STATUSES = new Set(['OPEN', 'ANALYZING', 'WAITING']);

export class RecoveryCaseService {
    /**
     * @param {import('./recovery-case.repository.js').RecoveryCaseRepository} recoveryCaseRepository
     */
    constructor(recoveryCaseRepository) {
        if (!recoveryCaseRepository) {
            throw new Error('RecoveryCaseService: recoveryCaseRepository is required');
        }
        this.recoveryCaseRepository = recoveryCaseRepository;
    }

    /**
     * @param {Object} trigger
     * @returns {Object}
     */
    resolveRecoveryAggregate(trigger) {
        if (trigger?.paymentId) return { paymentId: trigger.paymentId };
        if (trigger?.cartId) return { cartId: trigger.cartId };
        throw new Error('RecoveryCaseService: unable to resolve recovery aggregate from trigger');
    }

    /**
     * @param {Object} params
     * @param {string} params.type - 'PAYMENT_FAILURE', 'CART_ABANDONMENT'
     * @param {Object} params.identity - { paymentId: '...' }
     * @param {string} [params.correlationId]
     * @param {Object} [params.contextSnapshot]
     * @returns {Promise<Object>} RecoveryCase
     */
    async getOrCreateCase({ type, identity, correlationId = null, contextSnapshot = null }) {
        if (!type || !identity || Object.keys(identity).length === 0) {
            throw new Error('RecoveryCaseService.getOrCreateCase: type and identity are required');
        }

        const existing = await this.recoveryCaseRepository.findByEntity(type, identity);
        if (existing) {
            return existing;
        }

        return this.recoveryCaseRepository.create({
            type,
            ...identity,
            correlationId: correlationId || null,
            status: 'OPEN',
            contextSnapshot: contextSnapshot || null,
        });
    }

    /**
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async markAnalyzing(caseId) {
        return this.recoveryCaseRepository.update(caseId, { status: 'ANALYZING' });
    }

    /**
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async markWaiting(caseId) {
        return this.recoveryCaseRepository.update(caseId, { status: 'WAITING' });
    }

    /**
     * @param {string} caseId
     * @param {string} [strategyApplied]
     * @returns {Promise<Object>}
     */
    async markEscalated(caseId, strategyApplied = 'MANUAL_REVIEW') {
        return this.recoveryCaseRepository.update(caseId, {
            status: 'ESCALATED',
            strategyApplied,
        });
    }

    /**
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async markStopped(caseId) {
        return this.recoveryCaseRepository.update(caseId, { status: 'STOPPED' });
    }

    /**
     * @param {string} caseStatus
     * @returns {boolean}
     */
    isEligibleForScheduledExecution(caseStatus) {
        return SCHEDULE_ELIGIBLE_STATUSES.has(caseStatus);
    }
}

export default RecoveryCaseService;
