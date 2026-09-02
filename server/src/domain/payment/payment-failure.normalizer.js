export class PaymentFailureNormalizer {
    static CLASSES = {
        AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
        INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
        HARD_DECLINE: 'HARD_DECLINE',
        TEMPORARY_PROVIDER_FAILURE: 'TEMPORARY_PROVIDER_FAILURE',
        CUSTOMER_ACTION_REQUIRED: 'CUSTOMER_ACTION_REQUIRED', // Invalid details, expired card
        UNKNOWN: 'UNKNOWN' // Ambiguous or unrecognized error
    };

    /**
     * @param {Object} payment
     * @returns {string} Normalized failure class
     */
    static normalizeRazorpayFailure(payment) {
        if (payment.status !== 'failed') return PaymentFailureNormalizer.CLASSES.UNKNOWN;

        const reason = payment.errorReason || '';
        const step = payment.errorStep || '';
        const code = payment.errorCode || '';

        if (step === 'payment_authentication' || reason === 'payment_authentication_failed') {
            return PaymentFailureNormalizer.CLASSES.AUTHENTICATION_REQUIRED;
        }

        if (reason === 'insufficient_funds' || reason === 'balance_insufficient') {
            return PaymentFailureNormalizer.CLASSES.INSUFFICIENT_FUNDS;
        }

        if (reason === 'suspected_fraud' || reason === 'card_blocked' || reason === 'account_closed') {
            return PaymentFailureNormalizer.CLASSES.HARD_DECLINE;
        }

        if (reason === 'invalid_card_details' || reason === 'card_expired' || reason === 'cvv_invalid' || reason === 'invalid_vpa') {
            return PaymentFailureNormalizer.CLASSES.CUSTOMER_ACTION_REQUIRED;
        }

        if (reason === 'bank_network_error' || reason === 'gateway_error' || reason === 'timeout') {
            return PaymentFailureNormalizer.CLASSES.TEMPORARY_PROVIDER_FAILURE;
        }

        return PaymentFailureNormalizer.CLASSES.UNKNOWN;
    }
}
