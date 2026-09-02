import { MetricsService } from '../../../infrastructure/observability/metrics.service.js';

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

        let result;
        try {
            result = await verifier.verify(recoveryCase);
        } catch (error) {
            console.error(`[RecoveryVerificationService] Error during verification of case ${recoveryCase.id}:`, error);
            result = {
                state: 'UNKNOWN',
                evidence: { reason: 'verifier_threw_error', error: error.message }
            };
        }

        MetricsService.increment('verification_coverage', { 
            state: result.state, 
            type: recoveryCase.subjectType 
        });

        if (result.state === 'UNKNOWN') {
            MetricsService.increment('verification_unknown_count', { type: recoveryCase.subjectType });
        } else if (result.state === 'RECOVERED') {
            MetricsService.increment('verification_recovered_count', { type: recoveryCase.subjectType });
        } else if (result.state === 'STILL_RECOVERABLE') {
            MetricsService.increment('verification_still_recoverable_count', { type: recoveryCase.subjectType });
        } else if (result.state === 'CUSTOMER_ACTION_REQUIRED') {
            MetricsService.increment('customer_action_required_count', { type: recoveryCase.subjectType });
        }

        return result;
    }
}
