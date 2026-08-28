export class PaymentFailureCorrelationRepository {
    async upsertCorrelation(payment, downtime, status, confidence, score, matchedSignals, tx = null) {
        throw new Error('Method not implemented.');
    }

    async updateBatch(correlations, downtime, tx = null) {
        throw new Error('Method not implemented.');
    }

    async findFirstByPaymentId(paymentId) {
        throw new Error('Method not implemented.');
    }

    async findBatchByDowntimeId(downtimeId, cursor, batchSize) {
        throw new Error('Method not implemented.');
    }
}

export default PaymentFailureCorrelationRepository;
