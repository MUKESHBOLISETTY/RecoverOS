import { RecoveryActionRepository } from '../../../domain/agent/recovery-action.repository.js';

export class PrismaRecoveryActionRepository extends RecoveryActionRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaRecoveryActionRepository: prisma is required');
        this.prisma = prisma;
    }

    async findByCase(recoveryCaseId) {
        return this.prisma.recoveryAction.findMany({
            where: { recoveryCaseId },
            orderBy: { createdAt: 'asc' }
        });
    }

    async findByIdempotencyKey(key, tx = null) {
        const client = tx || this.prisma;
        return client.recoveryAction.findUnique({
            where: { idempotencyKey: key }
        });
    }

    async create(data, tx = null) {
        const client = tx || this.prisma;
        return client.recoveryAction.create({ data });
    }

    async update(id, data) {
        return this.prisma.recoveryAction.update({
            where: { id },
            data
        });
    }
}

export default PrismaRecoveryActionRepository;
