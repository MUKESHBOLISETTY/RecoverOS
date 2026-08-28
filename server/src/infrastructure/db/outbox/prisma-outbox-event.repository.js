import { OutboxEventRepository } from '../../../domain/events/outbox-event.repository.js';

export class PrismaOutboxEventRepository extends OutboxEventRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaOutboxEventRepository: prisma is required');
        this.prisma = prisma;
    }

    async findPending(maxAttempts, batchSize) {
        return this.prisma.outboxEvent.findMany({
            where: {
                status: 'PENDING',
                attempts: { lt: maxAttempts }
            },
            orderBy: { createdAt: 'asc' },
            take: batchSize,
        });
    }

    async markPublished(id) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                attempts: { increment: 1 },
            }
        });
    }

    async updateStatus(id, status, attempts, lastError = null) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status,
                attempts,
                lastError,
            }
        });
    }
}

export default PrismaOutboxEventRepository;
