export class RecoveryVerificationService {
    /**
     * @param {import('./recovery-verifier.registry.js').RecoveryVerifierRegistry} registry
     */
    constructor(registry) {
        if (!registry) throw new Error('RecoveryVerificationService: registry is required');
        this.registry = registry;
    }

    /**
     * @param {Object} recoveryCase 
     * @returns {Promise<import('./recovery-verifier.interface.js').VerificationResult>}
     */
    async verify(recoveryCase) {
        if (!recoveryCase) {
            throw new Error('RecoveryVerificationService: recoveryCase is required');
        }

        const verifier = this.registry.getVerifier(recoveryCase);

        if (!verifier) {
            console.warn(`[RecoveryVerificationService] No verifier capable of handling case ${recoveryCase.id}. Defaulting to UNKNOWN.`);
            return {
                state: 'UNKNOWN',
                evidence: { reason: 'no_capable_verifier' }
            };
        }

        try {
            return await verifier.verify(recoveryCase);
        } catch (error) {
            console.error(`[RecoveryVerificationService] Error during verification of case ${recoveryCase.id}:`, error);
            return {
                state: 'UNKNOWN',
                evidence: { reason: 'verifier_threw_error', error: error.message }
            };
        }
    }
}
