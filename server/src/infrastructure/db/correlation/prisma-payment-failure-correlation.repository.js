import { PaymentFailureCorrelationRepository } from '../../../domain/correlation/payment-failure-correlation.repository.js';
import { CorrelationRules } from '../../../domain/correlation/correlation-rules.js';

export class PrismaPaymentFailureCorrelationRepository extends PaymentFailureCorrelationRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaPaymentFailureCorrelationRepository: prisma is required');
        this.prisma = prisma;
    }

    async upsertCorrelation(payment, downtime, status, confidence, score, matchedSignals, tx = null) {
        const client = tx || this.prisma;
        return client.paymentFailureCorrelation.upsert({
            where: {
                paymentId_downtimeId: {
                    paymentId: payment.id,
                    downtimeId: downtime.id
                }
            },
            update: {
                status,
                confidence,
                score,
                matchedSignals,
                evaluatedAt: new Date()
            },
            create: {
                paymentId: payment.id,
                downtimeId: downtime.id,
                status,
                confidence,
                score,
                matchedSignals,
                paymentContext: payment,
                downtimeContext: downtime,
                explanation: `Payment failed with ${matchedSignals.length} matched signals including ${matchedSignals.join(', ')}.`
            }
        });
    }

    async updateBatch(correlations, downtime, tx = null) {
        const client = tx || this.prisma;

        const operations = async (transactionClient) => {
            for (const correlation of correlations) {
                const { score, matchedSignals } = CorrelationRules.evaluate(correlation.payment, downtime);
                const confidence = CorrelationRules.getConfidence(score);

                await transactionClient.paymentFailureCorrelation.update({
                    where: { id: correlation.id },
                    data: {
                        status: confidence === 'HIGH' ? 'MATCHED' : 'CANDIDATE',
                        confidence,
                        score,
                        matchedSignals,
                        evaluatedAt: new Date(),
                        downtimeContext: downtime
                    }
                });
            }
        };

        if (tx) {
            await operations(tx);
        } else {
            await this.prisma.$transaction(operations);
        }
    }

    async findFirstByPaymentId(paymentId) {
        return this.prisma.paymentFailureCorrelation.findFirst({
            where: { paymentId },
            orderBy: { evaluatedAt: 'desc' }
        });
    }

    async findBatchByDowntimeId(downtimeId, cursor, batchSize) {
        const queryParams = {
            where: { downtimeId },
            include: { payment: true },
            take: batchSize,
            orderBy: { id: 'asc' }
        };

        if (cursor) {
            queryParams.cursor = { id: cursor };
            queryParams.skip = 1;
        }

        return this.prisma.paymentFailureCorrelation.findMany(queryParams);
    }
}

export default PrismaPaymentFailureCorrelationRepository;
