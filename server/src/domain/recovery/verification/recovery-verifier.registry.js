export class RecoveryVerifierRegistry {
    constructor() {
        this.verifiers = [];
    }

    /**
     * @param {import('./recovery-verifier.interface.js').RecoveryVerifierInterface} verifier
     */
    register(verifier) {
        this.verifiers.push(verifier);
    }

    /**
     * @param {Object} recoveryCase
     * @returns {import('./recovery-verifier.interface.js').RecoveryVerifierInterface | null}
     */
    getVerifier(recoveryCase) {
        for (const verifier of this.verifiers) {
            if (verifier.canVerify(recoveryCase)) {
                return verifier;
            }
        }
        return null;
    }
}
