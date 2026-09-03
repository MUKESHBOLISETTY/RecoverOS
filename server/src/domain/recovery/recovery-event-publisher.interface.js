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
        throw new Error('Not implemented');
    }
}
