/**
 * @typedef {import('../../infrastructure/db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} PrismaRecoveryCaseRepository
 * @typedef {import('../../infrastructure/db/payment/prisma-payment.repository.js').PrismaPaymentRepository} PrismaPaymentRepository
 */

const TERMINAL_STATES = new Set(['RECOVERED', 'STOPPED', 'FAILED', 'EXPIRED']);

export class RecoveryCaseCorrelationService {
    /**
     * @param {PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {PrismaPaymentRepository} paymentRepository
     */
    constructor(recoveryCaseRepository, paymentRepository) {
        if (!recoveryCaseRepository) throw new Error('RecoveryCaseCorrelationService requires recoveryCaseRepository');
        if (!paymentRepository) throw new Error('RecoveryCaseCorrelationService requires paymentRepository');

        this.recoveryCaseRepository = recoveryCaseRepository;
        this.paymentRepository = paymentRepository;
    }

    /**
     * @param {Object} params
     * @param {string|null} params.suppliedRecoveryCaseId 
     * @param {string} params.eventType 
     * @param {string} params.userId 
     * @param {string} params.connectionId 
     * @param {string} params.provider 
     * @returns {Promise<{decision: 'CREATE'|'REUSE'|'REJECT_INVALID'|'REJECT_UNAUTHORIZED'|'IGNORE_TERMINAL', recoveryCaseId: string|null, reason: string|null}>}
     */
    async evaluateCorrelation({ suppliedRecoveryCaseId, eventType, userId, connectionId, provider }) {
        if (!suppliedRecoveryCaseId) {
            return { decision: 'CREATE', recoveryCaseId: null, reason: 'No correlation ID supplied' };
        }

        const recoveryCase = await this.recoveryCaseRepository.findById(suppliedRecoveryCaseId);
        if (!recoveryCase) {
            return { decision: 'REJECT_INVALID', recoveryCaseId: null, reason: `RecoveryCase ${suppliedRecoveryCaseId} not found` };
        }

        if (recoveryCase.paymentId) {
            const originalPayment = await this.paymentRepository.findById(recoveryCase.paymentId);
            if (!originalPayment) {
                return { decision: 'REJECT_INVALID', recoveryCaseId: null, reason: `Original context payment ${recoveryCase.paymentId} not found` };
            }

            const isAuthorizedUser = originalPayment.userId === userId;
            const isAuthorizedConnection = (!connectionId || originalPayment.connectionId === connectionId);

            if (!isAuthorizedUser || !isAuthorizedConnection) {
                return {
                    decision: 'REJECT_UNAUTHORIZED',
                    recoveryCaseId: null,
                    reason: `Cross-tenant mismatch: User ${userId} / Conn ${connectionId} !== Case User ${originalPayment.userId} / Conn ${originalPayment.connectionId}`
                };
            }
        } else {
            return { decision: 'REJECT_UNAUTHORIZED', recoveryCaseId: null, reason: 'Missing contextual ownership to validate' };
        }

        if (TERMINAL_STATES.has(recoveryCase.status)) {
            return { decision: 'IGNORE_TERMINAL', recoveryCaseId: suppliedRecoveryCaseId, reason: `Case is in terminal state: ${recoveryCase.status}` };
        }

        return { decision: 'REUSE', recoveryCaseId: suppliedRecoveryCaseId, reason: 'Valid correlation' };
    }
}

export default RecoveryCaseCorrelationService;
