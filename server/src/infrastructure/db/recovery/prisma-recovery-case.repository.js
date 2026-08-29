import { RecoveryCaseRepository } from '../../../domain/recovery/recovery-case.repository.js';

export class PrismaRecoveryCaseRepository extends RecoveryCaseRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaRecoveryCaseRepository: prisma is required');
        this.prisma = prisma;
    }

    /**
     * @param {string} type
     * @param {Object} identity
     * @returns {Promise<Object|null>}
     */
    async findByEntity(type, identity) {
        return this.prisma.recoveryCase.findFirst({
            where: {
                type,
                ...identity
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        return this.prisma.recoveryCase.findUnique({ where: { id } });
    }

    /**
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async create(data) {
        return this.prisma.recoveryCase.create({ data });
    }

    /**
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        return this.prisma.recoveryCase.update({ where: { id }, data });
    }

    async escalateCase(caseId, executionId, reason) {
        const idempotencyKey = `escalate:${caseId}:${executionId}`;

        return await this.prisma.$transaction(async (tx) => {
            const existingAction = await tx.recoveryAction.findUnique({
                where: { idempotencyKey }
            });
            if (existingAction) {
                return await tx.recoveryCase.findUnique({ where: { id: caseId } });
            }

            const updatedCase = await tx.recoveryCase.update({
                where: { id: caseId },
                data: {
                    status: 'ESCALATED',
                    strategyApplied: 'MANUAL_REVIEW',
                }
            });

            await tx.recoveryAction.create({
                data: {
                    recoveryCaseId: caseId,
                    type: 'IN_APP',
                    status: 'SUCCEEDED',
                    payload: { reason, escalatedAt: new Date().toISOString() },
                    idempotencyKey,
                }
            });

            await tx.auditEvent.create({
                data: {
                    entityId: caseId,
                    entityType: 'RecoveryCase',
                    action: 'ESCALATED',
                    newValue: { status: 'ESCALATED', reason },
                    actor: `agent-execution:${executionId}`,
                }
            });

            return updatedCase;
        });
    }

    async scheduleRecovery(caseId, executionId, reason, delayMinutes, executeAt) {
        return await this.prisma.$transaction(async (tx) => {
            const updatedCase = await tx.recoveryCase.update({
                where: { id: caseId },
                data: { status: 'WAITING' }
            });

            await tx.recoverySchedule.updateMany({
                where: {
                    recoveryCaseId: caseId,
                    status: 'SCHEDULED'
                },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date()
                }
            });

            const schedule = await tx.recoverySchedule.create({
                data: {
                    recoveryCaseId: caseId,
                    executeAt,
                    reason,
                    status: 'SCHEDULED',
                    createdByExecutionId: executionId,
                }
            });

            const outboxEvent = await tx.outboxEvent.create({
                data: {
                    eventType: 'RECOVERY_SCHEDULE_CREATED',
                    aggregateType: 'RecoverySchedule',
                    aggregateId: schedule.id,
                    payload: {
                        scheduleId: schedule.id,
                        caseId,
                        executeAt: executeAt.toISOString(),
                        delayMinutes,
                        reason
                    },
                    status: 'PENDING',
                }
            });

            await tx.recoveryAction.create({
                data: {
                    recoveryCaseId: caseId,
                    type: 'IN_APP',
                    status: 'SCHEDULED',
                    payload: { reason, delayMinutes, scheduleId: schedule.id },
                    idempotencyKey: `schedule:${caseId}:${executionId}`,
                }
            });

            await tx.auditEvent.create({
                data: {
                    entityId: caseId,
                    entityType: 'RecoveryCase',
                    action: 'WAITING',
                    newValue: { status: 'WAITING', scheduleId: schedule.id, reason },
                    actor: `agent-execution:${executionId}`,
                }
            });

            return { updatedCase, schedule, outboxEvent };
        });
    }

    async closeCase(payment, entity, externalEventId) {
        const openCases = await this.prisma.recoveryCase.findMany({
            where: {
                paymentId: payment.id,
                status: { in: ['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED'] }
            }
        });

        if (openCases.length === 0) return openCases;

        for (const recoveryCase of openCases) {
            await this.prisma.$transaction(async (tx) => {
                await tx.outcome.upsert({
                    where: { recoveryCaseId: recoveryCase.id },
                    create: {
                        recoveryCaseId: recoveryCase.id,
                        successful: true,
                        amountRecovered: payment.amount,
                        notes: `Recovered via ${entity.id} (event: payment.captured)`
                    },
                    update: {}
                });

                if (recoveryCase.status !== 'RECOVERED') {
                    await tx.recoveryCase.update({
                        where: { id: recoveryCase.id },
                        data: { status: 'RECOVERED' }
                    });
                }

                await tx.recoverySchedule.updateMany({
                    where: {
                        recoveryCaseId: recoveryCase.id,
                        status: 'SCHEDULED'
                    },
                    data: {
                        status: 'CANCELLED',
                        cancelledAt: new Date()
                    }
                });

                await tx.auditEvent.create({
                    data: {
                        entityId: recoveryCase.id,
                        entityType: 'RecoveryCase',
                        action: 'RECOVERED',
                        newValue: { status: 'RECOVERED', razorpayPaymentId: entity.id },
                        actor: `webhook:${externalEventId || 'unknown'}`
                    }
                });
            });
        }

        return openCases;
    }
}

export default PrismaRecoveryCaseRepository;
