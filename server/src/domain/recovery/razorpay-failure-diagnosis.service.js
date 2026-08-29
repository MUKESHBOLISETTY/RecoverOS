export class RazorpayFailureDiagnosisService {
    analyze({ payment, downtimeCorrelation }) {
        const raw = {
            errorCode: payment.errorCode ?? null,
            errorDescription: payment.errorDescription ?? null,
            errorSource: payment.errorSource ?? null,
            errorStep: payment.errorStep ?? null,
            errorReason: payment.errorReason ?? null,
        };

        const evidence = [];

        let category = 'UNKNOWN';
        let diagnosisCode = 'UNKNOWN_FAILURE';
        let source = 'UNKNOWN';
        let severity = 'LOW';

        let recoverability = 'UNKNOWN';
        let retryable = null;

        let confidenceScore = 0.4;
        let recommendedStrategy = 'ASSESS';
        let nextEvaluationAt = null;

        if (payment.errorSource) {
            evidence.push({ type: 'FAILURE_SOURCE', value: payment.errorSource });
            source = payment.errorSource.toUpperCase();
        }

        if (payment.errorStep) {
            evidence.push({ type: 'FAILURE_STEP', value: payment.errorStep });
        }

        if (payment.errorReason) {
            evidence.push({ type: 'ERROR_REASON', value: payment.errorReason });
        }

        const reason = payment.errorReason?.toLowerCase() ?? '';
        const description = payment.errorDescription?.toLowerCase() ?? '';

        const isInsufficientFunds =
            reason === 'insufficient_funds' ||
            (payment.errorCode === 'BAD_REQUEST_ERROR' && description.includes('fund'));

        const isCustomerActionRequired =
            payment.errorSource === 'customer' ||
            payment.errorStep === 'payment_authentication';

        const isExplicitDecline =
            payment.errorCode === 'BAD_REQUEST_ERROR' &&
            reason === 'payment_declined';

        const isTransient = [
            'timeout',
            'gateway_timeout',
            'network_error',
            'issuer_unavailable',
            'bank_unavailable',
        ].includes(reason);

        const isGatewayFailure =
            payment.errorSource === 'gateway' &&
            payment.errorStep === 'payment_authorization' &&
            reason === 'payment_failed';

        if (downtimeCorrelation?.status === 'MATCHED') {
            const downtimeSeverityMap = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };
            const downtimeSeverity = downtimeSeverityMap[downtimeCorrelation.severity?.toLowerCase()] || 'HIGH';

            evidence.push({
                type: 'DOWNTIME_MATCH',
                downtimeId: downtimeCorrelation.downtimeId,
                confidence: downtimeCorrelation.confidence,
                signals: downtimeCorrelation.matchedSignals ?? []
            });

            category = 'INFRASTRUCTURE';
            diagnosisCode = 'PAYMENT_DOWNTIME';
            severity = downtimeSeverity;
            recoverability = 'HIGH';
            retryable = true;

            confidenceScore = downtimeCorrelation.confidence === 'HIGH' ? 0.97 : (downtimeCorrelation.confidence === 'MEDIUM' ? 0.85 : 0.70);
            recommendedStrategy = 'WAIT';

            if (downtimeCorrelation.downtimeContext?.end) {
                nextEvaluationAt = new Date(downtimeCorrelation.downtimeContext.end).toISOString();
            }

        }
        else if (isGatewayFailure) {
            category = 'GATEWAY_FAILURE';
            diagnosisCode = 'GATEWAY_PAYMENT_FAILURE';
            severity = 'MEDIUM';
            recoverability = 'MEDIUM';
            retryable = false;
            confidenceScore = 0.68;
            recommendedStrategy = 'ASSESS';
        }
        else if (isInsufficientFunds) {
            category = 'INSUFFICIENT_FUNDS';
            diagnosisCode = 'INSUFFICIENT_FUNDS';
            severity = 'MEDIUM';
            recoverability = 'MEDIUM';
            retryable = true;
            confidenceScore = 0.90;
            recommendedStrategy = 'WAIT';
            nextEvaluationAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        } else if (isCustomerActionRequired) {
            category = 'CUSTOMER_ACTION_REQUIRED';
            diagnosisCode = 'CUSTOMER_AUTHENTICATION';
            severity = 'MEDIUM';
            recoverability = 'HIGH';
            retryable = false;
            confidenceScore = 0.92;
            recommendedStrategy = 'CUSTOMER_ACTION';
        } else if (isExplicitDecline) {
            category = 'BANK_DECLINE';
            diagnosisCode = 'BANK_DECLINE';
            severity = 'MEDIUM';
            recoverability = 'LOW';
            retryable = false;
            confidenceScore = 0.90;
            recommendedStrategy = 'CUSTOMER_ACTION';
        }
        else if (isTransient) {
            category = 'INFRASTRUCTURE';
            diagnosisCode = 'TRANSIENT_FAILURE';
            severity = 'HIGH';
            recoverability = 'HIGH';
            retryable = true;
            confidenceScore = 0.82;
            recommendedStrategy = 'RETRY';
        }

        if (downtimeCorrelation?.status === 'CANDIDATE') {
            evidence.push({
                type: 'DOWNTIME_CANDIDATE',
                downtimeId: downtimeCorrelation.downtimeId,
                confidence: downtimeCorrelation.confidence,
                signals: downtimeCorrelation.matchedSignals ?? []
            });
        }

        return {
            raw,
            category,
            diagnosisCode,
            source,
            severity,
            recoverability,
            retryable,
            confidenceScore,
            recommendedStrategy,
            nextEvaluationAt,
            downtimeCorrelation: downtimeCorrelation
                ? {
                    matched: downtimeCorrelation.status === 'MATCHED',
                    status: downtimeCorrelation.status,
                    downtimeId: downtimeCorrelation.downtimeId,
                    confidence: downtimeCorrelation.confidence,
                    score: downtimeCorrelation.score,
                    matchedSignals: downtimeCorrelation.matchedSignals ?? []
                }
                : null,
            evidence
        };
    }
}
