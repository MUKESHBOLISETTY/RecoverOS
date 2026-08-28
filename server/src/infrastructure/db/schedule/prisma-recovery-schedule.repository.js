import { RecoveryScheduleRepository } from '../../../domain/recovery/recovery-schedule.repository.js';

export class PrismaRecoveryScheduleRepository extends RecoveryScheduleRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaRecoveryScheduleRepository: prisma is required');
        this.prisma = prisma;
    }

    async findById(id) {
        return this.prisma.recoverySchedule.findUnique({
            where: { id }
        });
    }

    async cancel(id, tx = null) {
        const client = tx || this.prisma;
        return client.recoverySchedule.update({
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date() }
        });
    }

    async cancelManyForCase(caseId, tx = null) {
        const client = tx || this.prisma;
        return client.recoverySchedule.updateMany({
            where: {
                recoveryCaseId: caseId,
                status: 'SCHEDULED'
            },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date()
            }
        });
    }

    async markFailed(id, tx = null) {
        const client = tx || this.prisma;
        return client.recoverySchedule.update({
            where: { id },
            data: { status: 'FAILED' }
        });
    }

    async atomicFire(scheduleId, executionId) {
        return this.prisma.$executeRaw`
            UPDATE "RecoverySchedule"
            SET
                status = 'FIRED',
                "triggeredExecutionId" = ${executionId}::uuid,
                "firedAt" = NOW()
            WHERE id = ${scheduleId}::uuid
              AND status = 'SCHEDULED'
              AND "triggeredExecutionId" IS NULL
        `;
    }

    async create(data, tx = null) {
        const client = tx || this.prisma;
        return client.recoverySchedule.create({ data });
    }
}

export default PrismaRecoveryScheduleRepository;
