export class PaymentMapper {
    /**
    * @param {Object} entity
    * @param {Object} [context]
    * @param {string} [context.userId]
    * @param {string} [context.connectionId]
     * @returns {import('@prisma/client').Prisma.PaymentCreateInput}
     */
    static toCreateInput(entity, context = {}) {
        return {
            razorpayPaymentId: entity.id,
            userId: context.userId ?? null,
            connectionId: context.connectionId ?? null,
            amount: BigInt(entity.amount),
            currency: entity.currency,
            status: entity.status,
            method: entity.method,
            orderId: entity.order_id ?? null,
            invoiceId: entity.invoice_id ?? null,
            bank: entity.bank ?? null,
            vpa: entity.vpa ?? null,
            email: entity.email ?? null,
            contact: entity.contact ?? null,

            errorCode: entity.error_code ?? null,
            errorDescription: entity.error_description ?? null,
            errorSource: entity.error_source ?? null,
            errorStep: entity.error_step ?? null,
            errorReason: entity.error_reason ?? null,

            acquirerData: entity.acquirer_data ?? {},
            notes: entity.notes ?? {},

            customerId: entity.customer_id ?? null,
            captured: entity.captured ?? null,
            description: entity.description ?? null,
            international: entity.international ?? null,
            tokenId: entity.token_id ?? null,
            offerId: entity.offer_id ?? null,

            paymentCreatedAt: new Date(entity.created_at * 1000),
        };
    }

    /**
     * @param {Object} entity
     * @returns {import('@prisma/client').Prisma.PaymentUpdateInput}
     */
    static toUpdateInput(entity) {
        return {
            status: entity.status,
            captured: entity.captured ?? null,

            errorCode: entity.error_code ?? null,
            errorDescription: entity.error_description ?? null,
            errorSource: entity.error_source ?? null,
            errorStep: entity.error_step ?? null,
            errorReason: entity.error_reason ?? null,

            acquirerData: entity.acquirer_data ?? {},
            notes: entity.notes ?? {},
        };
    }
}
