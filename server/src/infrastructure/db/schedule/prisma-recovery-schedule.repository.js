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

    async findScheduledForReconciliation(batchSize) {
        const schedules = await this.prisma.recoverySchedule.findMany({
            where: {
                status: 'SCHEDULED',
                triggeredExecutionId: null
            },
            orderBy: { executeAt: 'asc' },
            take: batchSize
        });

        if (schedules.length === 0) return [];

        const caseIds = [...new Set(schedules.map(s => s.recoveryCaseId))];
        const cases = await this.prisma.recoveryCase.findMany({
            where: { id: { in: caseIds } },
            select: { id: true, status: true }
        });

        const caseMap = new Map(cases.map(c => [c.id, c]));

        return schedules.map(s => ({
            ...s,
            recoveryCase: caseMap.get(s.recoveryCaseId) || null
        }));
    }
}

export default PrismaRecoveryScheduleRepository;
