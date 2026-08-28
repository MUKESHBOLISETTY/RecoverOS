export class PaymentRepository {
    async findByRazorpayId(razorpayPaymentId) {
        throw new Error('Method not implemented.');
    }

    async findById(id) {
        throw new Error('Method not implemented.');
    }

    async findManyByRazorpayIds(ids) {
        throw new Error('Method not implemented.');
    }

    async upsert(entity, createInput, updateInput, tx = null) {
        throw new Error('Method not implemented.');
    }

    async upsertBatch(entities, getCreateInput, getUpdateInput) {
        throw new Error('Method not implemented.');
    }
}

export default PaymentRepository;
