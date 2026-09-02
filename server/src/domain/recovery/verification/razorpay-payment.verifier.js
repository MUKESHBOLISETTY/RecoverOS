import { RecoveryVerifierInterface } from './recovery-verifier.interface.js';

export class RazorpayPaymentVerifier extends RecoveryVerifierInterface {
    /**
     * @param {import('../../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} paymentRepository
     * @param {Function} razorpayRepoFactory
     * @param {import('../../../domain/connectors/connector.manager.js').default} connectorManager
     */
    constructor(paymentRepository, razorpayRepoFactory, connectorManager) {
        super();
        this.paymentRepository = paymentRepository;
        this.razorpayRepoFactory = razorpayRepoFactory;
        this.connectorManager = connectorManager;
    }

    canVerify(recoveryCase) {
        return !!recoveryCase.paymentId;
    }

    async verify(recoveryCase) {
        try {
            const payment = await this.paymentRepository.findById(recoveryCase.paymentId);
            if (!payment) {
                return { state: 'UNKNOWN', evidence: { reason: 'payment_not_found' } };
            }

            let apiPayment;
            try {
                if (!payment.connectionId) {
                    return { state: 'UNKNOWN', evidence: { reason: 'missing_connection_id' } };
                }
                const credentials = await this.connectorManager.getDecryptedCredentialsById(payment.connectionId);
                if (!credentials || !credentials.keyId || !credentials.keySecret) {
                    return { state: 'UNKNOWN', evidence: { reason: 'missing_or_invalid_credentials' } };
                }

                const razorpayApiRepository = this.razorpayRepoFactory({
                    keyId: credentials.keyId,
                    keySecret: credentials.keySecret
                });

                apiPayment = await razorpayApiRepository.fetchById(payment.razorpayPaymentId);
            } catch (err) {
                console.error(`[RazorpayPaymentVerifier] API fetch failed for ${payment.razorpayPaymentId}:`, err);
                return { state: 'UNKNOWN', evidence: { reason: 'api_failure', error: err.message } };
            }

            if (!apiPayment) {
                return { state: 'UNKNOWN', evidence: { reason: 'api_payment_not_found' } };
            }

            if (apiPayment.status === 'captured' || apiPayment.status === 'authorized') {
                return { state: 'RECOVERED', evidence: { razorpayStatus: apiPayment.status } };
            }

            const recoveryTarget = recoveryCase.contextSnapshot?.recoveryTarget || 'PAYMENT_ATTEMPT';

            if (recoveryTarget === 'COMMERCE_PURCHASE') {
                return { state: 'UNKNOWN', evidence: { reason: 'shopify_originated_missing_commerce_key', originalPaymentStatus: apiPayment.status, target: 'COMMERCE_PURCHASE' } };
            } else {
                if (apiPayment.status === 'failed') {
                    return { state: 'STILL_RECOVERABLE', evidence: { razorpayStatus: apiPayment.status, target: 'PAYMENT_ATTEMPT' } };
                }
                return { state: 'UNKNOWN', evidence: { razorpayStatus: apiPayment.status } };
            }
        } catch (error) {
            console.error(`[RazorpayPaymentVerifier] Verification failed:`, error);
            return { state: 'UNKNOWN', evidence: { error: error.message } };
        }
    }
}
