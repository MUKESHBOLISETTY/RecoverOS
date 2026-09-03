/**
 * @type {Set<string>}
 */
const SCHEDULE_ELIGIBLE_STATUSES = new Set(['OPEN', 'ANALYZING', 'WAITING']);

export class RecoveryCaseService {
    /**
     * @param {import('./recovery-case.repository.js').RecoveryCaseRepository} recoveryCaseRepository
     * @param {import('./recovery-event-publisher.interface.js').RecoveryEventPublisherInterface} [recoveryEventPublisher]
     */
    constructor(recoveryCaseRepository, recoveryEventPublisher = null) {
        if (!recoveryCaseRepository) {
            throw new Error('RecoveryCaseService: recoveryCaseRepository is required');
        }
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.recoveryEventPublisher = recoveryEventPublisher;
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
     * @param {string} [params.subjectType]
     * @param {string} [params.subjectId]
     * @param {string} [params.activeSkillId]
     * @param {number} [params.activeSkillVersion]
     * @param {string} [params.userId]
     * @returns {Promise<Object>} RecoveryCase
     */
    async getOrCreateCase({ type, identity, correlationId = null, contextSnapshot = null, subjectType = null, subjectId = null, activeSkillId = null, activeSkillVersion = null, userId = null }) {
        if (!type || !identity || Object.keys(identity).length === 0) {
            throw new Error('RecoveryCaseService.getOrCreateCase: type and identity are required');
        }

        const existing = await this.recoveryCaseRepository.findByEntity(type, identity);
        if (existing) {
            return existing;
        }

        const newCase = await this.recoveryCaseRepository.create({
            type,
            ...identity,
            subjectType,
            subjectId,
            activeSkillId,
            activeSkillVersion,
            correlationId: correlationId || null,
            status: 'OPEN',
            contextSnapshot: contextSnapshot || null,
        });

        if (this.recoveryEventPublisher && userId) {
            const provider = type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
            await this.recoveryEventPublisher.publishCaseCreated(newCase.id, newCase.type, provider, userId);
        }
        
        return newCase;
    }

    /**
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async getCaseById(caseId) {
        return this.recoveryCaseRepository.findById(caseId);
    }

    /**
     * @param {string} caseId
     * @param {string} [userId]
     * @returns {Promise<Object>}
     */
    async markAnalyzing(caseId, userId = null) {
        const updated = await this.recoveryCaseRepository.update(caseId, { status: 'ANALYZING' });
        if (this.recoveryEventPublisher && userId) {
            const provider = updated.type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
            await this.recoveryEventPublisher.publishCaseStatusChanged(caseId, updated.type, provider, 'ANALYZING', userId);
        }
        return updated;
    }

    /**
     * @param {string} caseId
     * @param {string} [userId]
     * @returns {Promise<Object>}
     */
    async markWaiting(caseId, userId = null) {
        const updated = await this.recoveryCaseRepository.update(caseId, { status: 'WAITING' });
        if (this.recoveryEventPublisher && userId) {
            const provider = updated.type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
            await this.recoveryEventPublisher.publishCaseStatusChanged(caseId, updated.type, provider, 'WAITING', userId);
        }
        return updated;
    }

    /**
     * @param {string} caseId
     * @param {string} [strategyApplied]
     * @param {string} [userId]
     * @returns {Promise<Object>}
     */
    async markEscalated(caseId, strategyApplied = 'MANUAL_REVIEW', userId = null) {
        const updated = await this.recoveryCaseRepository.update(caseId, {
            status: 'ESCALATED',
            strategyApplied,
        });
        if (this.recoveryEventPublisher && userId) {
            const provider = updated.type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
            await this.recoveryEventPublisher.publishCaseStatusChanged(caseId, updated.type, provider, 'ESCALATED', userId);
        }
        return updated;
    }

    /**
     * @param {string} caseId
     * @param {string} [userId]
     * @returns {Promise<Object>}
     */
    async markStopped(caseId, userId = null) {
        const updated = await this.recoveryCaseRepository.update(caseId, { status: 'STOPPED' });
        if (this.recoveryEventPublisher && userId) {
            const provider = updated.type === 'CART_ABANDONMENT' ? 'shopify' : 'razorpay';
            await this.recoveryEventPublisher.publishCaseStatusChanged(caseId, updated.type, provider, 'STOPPED', userId);
        }
        return updated;
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
