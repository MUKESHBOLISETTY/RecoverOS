import { RazorpayFailureDiagnosisService } from './razorpay-failure-diagnosis.service.js';

export class FailureDiagnosisService {
    constructor() {
        this.razorpayService = new RazorpayFailureDiagnosisService();
    }

    /**
     * @param {Object} params
     * @param {string} params.provider
     * @param {Object} params.payment
     * @param {Object} [params.downtimeCorrelation]
     * @returns {Object} FailureContext
     */
    analyze(params) {
        const provider = params.provider?.toLowerCase();

        switch (provider) {
            case 'razorpay':
                return this.razorpayService.analyze(params);

            default:
                console.warn(`[FailureDiagnosisService] Unsupported provider "${provider}". Falling back to generic/unknown diagnosis.`);
                return this._getGenericDiagnosis(params);
        }
    }

    _getGenericDiagnosis({ payment, downtimeCorrelation }) {
        return {
            raw: {
                errorCode: payment.errorCode ?? null,
                errorDescription: payment.errorDescription ?? null,
                errorSource: payment.errorSource ?? null,
                errorStep: payment.errorStep ?? null,
                errorReason: payment.errorReason ?? null,
            },
            category: 'UNKNOWN',
            diagnosisCode: 'UNKNOWN_FAILURE',
            source: 'UNKNOWN',
            severity: 'LOW',
            recoverability: 'UNKNOWN',
            retryable: null,
            confidenceScore: 0.0,
            recommendedStrategy: 'ASSESS',
            nextEvaluationAt: null,
            downtimeCorrelation: downtimeCorrelation || null,
            evidence: []
        };
    }
}
