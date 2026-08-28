import { PaymentRepository } from '../../../domain/payment/payment.repository.js';

export class PrismaPaymentRepository extends PaymentRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaPaymentRepository: prisma is required');
        this.prisma = prisma;
    }

    async findByRazorpayId(razorpayPaymentId) {
        return this.prisma.payment.findUnique({
            where: { razorpayPaymentId }
        });
    }

    async findById(id) {
        return this.prisma.payment.findUnique({
            where: { id }
        });
    }

    async findManyByRazorpayIds(ids) {
        return this.prisma.payment.findMany({
            where: { razorpayPaymentId: { in: ids } },
            select: { razorpayPaymentId: true, status: true }
        });
    }

    async upsert(entity, createInput, updateInput, tx = null) {
        const client = tx || this.prisma;
        return client.payment.upsert({
            where: { razorpayPaymentId: entity.id },
            create: createInput,
            update: updateInput
        });
    }

    async upsertBatch(entities, getCreateInput, getUpdateInput) {
        await this.prisma.$transaction(
            async (tx) => {
                for (const entity of entities) {
                    await tx.payment.upsert({
                        where: { razorpayPaymentId: entity.id },
                        create: getCreateInput(entity),
                        update: getUpdateInput(entity),
                    });
                }
            },
            { timeout: 30_000 }
        );
    }
}

export default PrismaPaymentRepository;
