import { WebhookEventRepository } from '../../../domain/events/webhook-event.repository.js';

export class PrismaWebhookEventRepository extends WebhookEventRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaWebhookEventRepository: prisma is required');
        this.prisma = prisma;
    }

    async findByIdempotencyKey(source, idempotencyKey, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.findUnique({
            where: { source_idempotencyKey: { source, idempotencyKey } }
        });
    }

    async create(data, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.create({ data });
    }

    async update(id, data, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.update({
            where: { id },
            data
        });
    }

    async markFailed(source, idempotencyKey, errorMessage, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.updateMany({
            where: { source, idempotencyKey },
            data: {
                status: 'FAILED',
                errorReason: errorMessage
            }
        });
    }
}

export default PrismaWebhookEventRepository;
