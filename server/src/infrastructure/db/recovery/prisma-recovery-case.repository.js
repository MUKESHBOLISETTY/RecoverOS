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
     * @param {string} shopDomain
     * @param {string} checkoutToken
     * @returns {Promise<Object|null>}
     */
    async findShopifyAbandonmentCase(shopDomain, checkoutToken) {
        return this.prisma.recoveryCase.findFirst({
            where: {
                type: 'CART_ABANDONMENT',
                subjectType: 'CHECKOUT',
                subjectId: checkoutToken,
                contextSnapshot: {
                    path: ['shopDomain'],
                    equals: shopDomain
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * @param {string} storeDomainOrConnectionId
     * @param {Date} sinceTime
     * @returns {Promise<Array<Object>>}
     */
    async findActiveShopifyAbandonmentCases(storeDomainOrConnectionId, sinceTime) {
        // Query cases since the time window that are active
        const cases = await this.prisma.recoveryCase.findMany({
            where: {
                type: 'CART_ABANDONMENT',
                subjectType: 'CHECKOUT',
                status: { in: ['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED'] },
                createdAt: { gte: sinceTime }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filter in memory for storeDomain or connectionId safety because 
        // connectionId could be the store identifier in some contexts.
        return cases.filter(c => {
            const domain = c.contextSnapshot?.shopDomain;
            return domain === storeDomainOrConnectionId;
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

    /**
     * @param {string} caseId
     * @param {string} skillId
     * @param {number} skillVersion
     * @returns {Promise<{ updated: boolean, caseRecord: Object }>}
     */
    async updateSkillIfNull(caseId, skillId, skillVersion) {
        return await this.prisma.$transaction(async (tx) => {
            const caseRecord = await tx.recoveryCase.findUnique({ where: { id: caseId } });
            if (!caseRecord) {
                throw new Error(`RecoveryCase ${caseId} not found`);
            }
            if (caseRecord.activeSkillId) {
                // Already populated by another worker
                return { updated: false, caseRecord };
            }
            const updated = await tx.recoveryCase.update({
                where: { id: caseId },
                data: {
                    activeSkillId: skillId,
                    activeSkillVersion: skillVersion
                }
            });
            return { updated: true, caseRecord: updated };
        });
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
                    type: 'INTERNAL_SYSTEM_ACTION',
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
        try {
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
                        type: 'INTERNAL_SYSTEM_ACTION',
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
        } catch (error) {
            if (error.code === 'P2002') {
                const existingSchedule = await this.prisma.recoverySchedule.findFirst({
                    where: { recoveryCaseId: caseId, status: 'SCHEDULED' }
                });
                return {
                    status: 'ALREADY_SCHEDULED',
                    schedule: existingSchedule,
                    updatedCase: { id: caseId }
                };
            }
            throw error;
        }
    }

    async markRecovered({ recoveryCaseId, subjectType, subjectId, verifiedOutcome, sourceEvent, sourceEventId }) {
        const whereClause = { status: { in: ['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED'] } };

        if (recoveryCaseId) {
            whereClause.id = recoveryCaseId;
        } else if (subjectType && subjectId) {
            whereClause.OR = [
                { subjectType, subjectId },
                // TEMPORARY
                { paymentId: subjectId }
            ];
        } else {
            return [];
        }

        const eligibleCases = await this.prisma.recoveryCase.findMany({
            where: whereClause,
            select: { id: true, paymentId: true }
        });

        if (eligibleCases.length === 0) return [];

        const recoveredCases = [];

        for (const { id: caseId, paymentId } of eligibleCases) {
            const result = await this.prisma.$transaction(async (tx) => {
                const updateResult = await tx.recoveryCase.updateMany({
                    where: {
                        id: caseId,
                        status: { in: ['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED'] }
                    },
                    data: { status: 'RECOVERED' }
                });

                if (updateResult.count === 0) {
                    return null;
                }

                await tx.outcome.upsert({
                    where: { recoveryCaseId: caseId },
                    create: {
                        recoveryCaseId: caseId,
                        successful: true,
                        amountRecovered: verifiedOutcome.amountRecovered,
                        notes: verifiedOutcome.notes
                    },
                    update: {}
                });

                const schedulesCancelled = await tx.recoverySchedule.updateMany({
                    where: {
                        recoveryCaseId: caseId,
                        status: 'SCHEDULED'
                    },
                    data: {
                        status: 'CANCELLED',
                        cancelledAt: new Date()
                    }
                });

                await tx.auditEvent.create({
                    data: {
                        entityId: caseId,
                        entityType: 'RecoveryCase',
                        action: 'RECOVERED',
                        newValue: {
                            status: 'RECOVERED',
                            sourceEvent,
                            sourceEventId
                        },
                        actor: `system:${sourceEvent}`
                    }
                });

                return { id: caseId, schedulesCancelled: schedulesCancelled.count };
            });

            if (result) {
                recoveredCases.push(result);
            }
        }

        return recoveredCases;
    }
}

export default PrismaRecoveryCaseRepository;
