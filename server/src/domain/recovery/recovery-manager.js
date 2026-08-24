export class RecoveryManager {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * @param {string} paymentId 
     * @param {string} correlationId 
     */
    async openRecoveryCase(paymentId, correlationId = null) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId }
        });

        if (!payment) throw new Error('Payment not found');

        return this.prisma.recoveryCase.create({
            data: {
                paymentId,
                correlationId,
                status: 'OPEN',
                paymentSnapshot: payment
            }
        });
    }

    /**
     * @param {string} razorpayPaymentId 
     */
    async handlePaymentCaptured(razorpayPaymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { razorpayPaymentId },
            include: { recoveryCases: true }
        });

        if (!payment) return;

        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'captured' }
        });

        const openCases = payment.recoveryCases.filter(rc => rc.status === 'OPEN' || rc.status === 'WAITING');

        for (const recoveryCase of openCases) {
            await this.prisma.recoveryCase.update({
                where: { id: recoveryCase.id },
                data: { status: 'RECOVERED' }
            });

            await this.prisma.outcome.create({
                data: {
                    recoveryCaseId: recoveryCase.id,
                    successful: true,
                    amountRecovered: payment.amount,
                    notes: 'Recovered via payment.captured event (late auth/retry)'
                }
            });
        }
    }

    /**
     * Processes eligible recovery cases after a downtime is resolved.
     * @param {string} downtimeId 
     */
    async processResolvedDowntime(downtimeId) {
        const downtime = await this.prisma.paymentDowntime.findUnique({
            where: { id: downtimeId }
        });

        if (!downtime || downtime.status !== 'RESOLVED') return;

        // Find correlations with HIGH confidence that belong to this downtime
        const correlations = await this.prisma.paymentFailureCorrelation.findMany({
            where: {
                downtimeId,
                confidence: 'HIGH'
            },
            include: { payment: true }
        });

        for (const correlation of correlations) {
            // Check if there is an existing recovery case
            const existingCase = await this.prisma.recoveryCase.findFirst({
                where: { paymentId: correlation.paymentId }
            });

            if (!existingCase) {
                // We queue eligible cases
                await this.openRecoveryCase(correlation.paymentId, correlation.id);
            } else if (existingCase.status === 'WAITING') {
                // If it was waiting for downtime to resolve, move to OPEN
                await this.prisma.recoveryCase.update({
                    where: { id: existingCase.id },
                    data: { status: 'OPEN' }
                });
            }
        }
    }
}
