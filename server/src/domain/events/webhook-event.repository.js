export class WebhookEventRepository {
    async findByIdempotencyKey(source, idempotencyKey, tx = null) {
        throw new Error('Method not implemented.');
    }

    async create(data, tx = null) {
        throw new Error('Method not implemented.');
    }

    async update(id, data, tx = null) {
        throw new Error('Method not implemented.');
    }

    async markFailed(source, idempotencyKey, errorMessage, tx = null) {
        throw new Error('Method not implemented.');
    }
}

export default WebhookEventRepository;
