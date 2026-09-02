/**
 * @typedef {Object} VerificationResult
 * @property {string} state - RECOVERED, STILL_RECOVERABLE, CUSTOMER_ACTION_REQUIRED, UNKNOWN, BLOCKED
 * @property {Object} evidence - Details proving the state
 */

export class RecoveryVerifierInterface {
    /**
     * @param {Object} recoveryCase
     * @returns {boolean}
     */
    canVerify(recoveryCase) {
        throw new Error('Not implemented');
    }

    /**
     * @param {Object} recoveryCase
     * @returns {Promise<VerificationResult>}
     */
    async verify(recoveryCase) {
        throw new Error('Not implemented');
    }
}
