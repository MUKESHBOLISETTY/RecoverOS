/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 */

export class CasesController {
    /**
     * @param {PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
        this.getCases = this.getCases.bind(this);
        this.getCaseDetails = this.getCaseDetails.bind(this);
    }

    async getCases(req, res, next) {
        try {
            const userId = req.user.id;
            const cases = await this.prisma.recoveryCase.findMany({
                where: { userId },
                include: {
                    outcome: true,
                    actions: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            });

            const safeCases = cases.map(c => ({
                ...c,
                revenueAtRisk: c.revenueAtRisk ? c.revenueAtRisk.toString() : null,
                outcome: c.outcome ? {
                    ...c.outcome,
                    amountRecovered: c.outcome.amountRecovered ? c.outcome.amountRecovered.toString() : null
                } : null
            }));

            return res.status(200).json({
                success: true,
                data: safeCases
            });
        } catch (error) {
            console.error('[CasesController] getCases Error:', error);
            next(error);
        }
    }

    async getCaseDetails(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const caseData = await this.prisma.recoveryCase.findFirst({
                where: { id, userId },
                include: {
                    outcome: true,
                    actions: true
                }
            });

            if (!caseData) {
                return res.status(404).json({ success: false, message: 'Case not found' });
            }

            const auditEvents = await this.prisma.auditEvent.findMany({
                where: { entityId: id, entityType: 'RecoveryCase' },
                orderBy: { createdAt: 'asc' }
            });

            const agentExecutions = await this.prisma.agentExecution.findMany({
                where: { recoveryCaseId: id, userId: userId },
                orderBy: { createdAt: 'desc' }
            });

            const safeCase = {
                ...caseData,
                revenueAtRisk: caseData.revenueAtRisk ? caseData.revenueAtRisk.toString() : null,
                outcome: caseData.outcome ? {
                    ...caseData.outcome,
                    amountRecovered: caseData.outcome.amountRecovered ? caseData.outcome.amountRecovered.toString() : null
                } : null,
                auditEvents,
                agentExecutions
            };

            return res.status(200).json({
                success: true,
                data: safeCase
            });
        } catch (error) {
            console.error('[CasesController] getCaseDetails Error:', error);
            next(error);
        }
    }
}

export default CasesController;
