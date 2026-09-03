import { PaymentFailureNormalizer } from './payment-failure.normalizer.js';
import { MetricsService } from '../../infrastructure/observability/metrics.service.js';

export class PaymentRecoveryService {
    /**
     * @param {import('../../infrastructure/db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../infrastructure/cache/base-cache.service.js').BaseCacheService} cacheService
     * @param {import('../../infrastructure/queue/payment-stabilization.queue.js').PaymentStabilizationQueue} paymentStabilizationQueue
     */
    constructor(recoveryCaseRepository, cacheService, paymentStabilizationQueue, recoveryEventPublisher = null) {
        if (!recoveryCaseRepository) throw new Error('PaymentRecoveryService: recoveryCaseRepository is required');
        if (!cacheService) throw new Error('PaymentRecoveryService: cacheService is required');
        if (!paymentStabilizationQueue) throw new Error('PaymentRecoveryService: paymentStabilizationQueue is required');

        this.recoveryCaseRepository = recoveryCaseRepository;
        this.cacheService = cacheService;
        this.paymentStabilizationQueue = paymentStabilizationQueue;
        this.recoveryEventPublisher = recoveryEventPublisher;
    }

    /**
     * @param {Object} payment
     * @param {Object} webhookContext
     * @returns {Promise<Object>}
     */
    async handlePaymentFailed(payment, webhookContext) {
        const rawBody = webhookContext.body || webhookContext;
        const provider = webhookContext.provider || 'RAZORPAY';
        const connectionId = webhookContext.connectionId;

        const transactionType = this._classifyTransactionType(payment, rawBody);
        if (transactionType !== 'ONE_TIME') {
            console.log(`[PaymentRecoveryService] Ignoring transaction type ${transactionType} for payment ${payment.id}`);
            return { status: 'skipped', reason: `unsupported_transaction_type_${transactionType}` };
        }

        const recoveryTarget = this._classifyRecoveryTarget(payment, rawBody);
        const normalizedFailure = PaymentFailureNormalizer.normalizeRazorpayFailure(payment);

        const lockKey = `lock-recovery-creation-${payment.id}`;
        const acquired = await this.cacheService.setNx(lockKey, 'locked', 10);
        if (!acquired) {
            console.log(`[PaymentRecoveryService] Case creation locked for payment ${payment.id}, likely concurrent webhook.`);
            return { status: 'skipped', reason: 'concurrent_creation_locked' };
        }

        try {
            const { CheckoutIdentityResolver } = await import('../recovery/checkout-identity.resolver.js');
            const identity = CheckoutIdentityResolver.resolve(provider, rawBody, {}, { connectionId });

            if (identity.confidence === 'DETERMINISTIC') {
                const checkoutCase = await this.recoveryCaseRepository.findShopifyAbandonmentCase(identity.storeId, identity.checkoutId);

                if (checkoutCase) {
                    console.log(`[PaymentRecoveryService] Deterministic payment ${payment.id} associated with checkout case ${checkoutCase.id}`);
                    if (this.recoveryEventPublisher && payment.userId) {
                        await this.recoveryEventPublisher.publishPaymentAttemptFailed(checkoutCase.id, checkoutCase.type, provider, payment.userId, payment.id);
                    }
                    return { status: 'associated', recoveryCaseId: checkoutCase.id };
                } else {
                    console.log(`[PaymentRecoveryService] Deterministic payment ${payment.id} has no existing checkout case. Preserving payment without fabricating abandonment.`);
                    return { status: 'preserved', reason: 'waiting_for_abandonment' };
                }
            }

            let recoveryCase = await this.recoveryCaseRepository.findByEntity('PAYMENT_FAILURE', { paymentId: payment.id });
            if (!recoveryCase) {
                const contextSnapshot = {
                    failureClass: normalizedFailure,
                    transactionType,
                    recoveryTarget
                };

                const entityNotes = rawBody?.payload?.payment?.entity?.notes || {};
                if (entityNotes.checkout_token) contextSnapshot.checkout_token = entityNotes.checkout_token;
                if (entityNotes.cart_token) contextSnapshot.cart_token = entityNotes.cart_token;

                recoveryCase = await this.recoveryCaseRepository.create({
                    type: 'PAYMENT_FAILURE',
                    subjectType: 'PAYMENT',
                    subjectId: payment.id,
                    paymentId: payment.id,
                    status: 'OPEN',
                    contextSnapshot
                });

                if (this.recoveryEventPublisher && payment.userId) {
                    await this.recoveryEventPublisher.publishCaseCreated(recoveryCase.id, 'PAYMENT_FAILURE', provider, payment.userId);
                }

                MetricsService.increment('payment_recovery_count', {
                    transactionType,
                    recoveryTarget,
                    failureClass: normalizedFailure
                });
                console.log(`[PaymentRecoveryService] Created RecoveryCase ${recoveryCase.id} for payment ${payment.id}`);
            } else {
                console.log(`[PaymentRecoveryService] Found existing RecoveryCase ${recoveryCase.id} for payment ${payment.id}`);
            }

            await this.paymentStabilizationQueue.enqueueStabilization(recoveryCase.id, payment.id);
            return { status: 'processed', recoveryCaseId: recoveryCase.id };

        } finally {
            await this.cacheService.del(lockKey);
        }
    }

    _classifyTransactionType(payment, rawBody) {
        const method = payment.method || rawBody?.payload?.payment?.entity?.method;
        const recurring = payment.recurring || rawBody?.payload?.payment?.entity?.recurring;

        if (method === 'emandate' || method === 'nach') return 'MANDATE';
        if (method === 'recurring' || recurring) return 'RECURRING';
        if (rawBody?.payload?.payment?.entity?.token_id) return 'RECURRING';

        if (!method) return 'UNKNOWN';

        return 'ONE_TIME';
    }

    _classifyRecoveryTarget(payment, rawBody) {
        const notes = payment.notes || rawBody?.payload?.payment?.entity?.notes || {};
        const isShopifyOriginated = !!(notes.domain && (notes.shopify_order_id || notes.payment_session_id) || String(notes.gid).includes('shopify/PaymentSession'));

        if (isShopifyOriginated) {
            return 'COMMERCE_PURCHASE';
        }
        return 'PAYMENT_ATTEMPT';
    }
}
