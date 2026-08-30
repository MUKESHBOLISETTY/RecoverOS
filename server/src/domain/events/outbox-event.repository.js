export class OutboxEventRepository {
    async findPending(maxAttempts, batchSize) {
        throw new Error('Method not implemented.');
    }

    async markPublished(id) {
        throw new Error('Method not implemented.');
    }

    async updateStatus(id, status, attempts, lastError = null) {
        throw new Error('Method not implemented.');
    }

    async findLatestByAggregateIds(aggregateType, aggregateIds) {
        throw new Error('Method not implemented.');
    }
}

export default OutboxEventRepository;
