export class RecoveryEventPublisherInterface {
    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     */
    async publishCaseCreated(caseId, recoveryType, provider, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} status
     * @param {string} userId
     */
    async publishCaseStatusChanged(caseId, recoveryType, provider, status, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     */
    async publishVerificationStarted(caseId, recoveryType, provider, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} verificationResult
     * @param {string} userId
     */
    async publishVerificationCompleted(caseId, recoveryType, provider, verificationResult, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} executionId
     * @param {string} userId
     */
    async publishAgentStarted(caseId, recoveryType, provider, executionId, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} action
     * @param {string} userId
     */
    async publishActionStarted(caseId, recoveryType, provider, action, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishAgentDecision(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishPolicyValidated(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishCommunicationSent(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishDiscountCreated(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishPaymentLinkCreated(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {Object} metadata
     * @param {string} userId
     */
    async publishFollowUpScheduled(caseId, recoveryType, provider, metadata, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} action
     * @param {Object} result
     * @param {string} userId
     */
    async publishActionCompleted(caseId, recoveryType, provider, action, result, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} action
     * @param {string} reason
     * @param {string} userId
     */
    async publishActionBlocked(caseId, recoveryType, provider, action, reason, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     */
    async publishCaseRecovered(caseId, recoveryType, provider, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     */
    async publishCaseFailed(caseId, recoveryType, provider, userId) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     * @param {string} paymentId
     */
    async publishPaymentAttemptFailed(caseId, recoveryType, provider, userId, paymentId) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} caseId
     * @param {string} recoveryType
     * @param {string} provider
     * @param {string} userId
     * @param {string} paymentId
     * @param {string} correlationMode
     * @param {string} confidence
     * @returns {Promise<void>}
     */
    async publishHeuristicPaymentSignalCorrelated(caseId, recoveryType, provider, userId, paymentId, correlationMode, confidence) {
        throw new Error('Method not implemented');
    }
}
