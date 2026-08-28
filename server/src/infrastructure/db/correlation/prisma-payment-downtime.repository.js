import { PaymentDowntimeRepository } from '../../../domain/correlation/payment-downtime.repository.js';

export class PrismaPaymentDowntimeRepository extends PaymentDowntimeRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaPaymentDowntimeRepository: prisma is required');
        this.prisma = prisma;
    }

    async findActive() {
        return this.prisma.paymentDowntime.findMany({
            where: {
                OR: [
                    { status: 'STARTED' },
                    { status: 'UPDATED' },
                    { status: 'RESOLVED' }
                ]
            }
        });
    }

    async findById(id) {
        return this.prisma.paymentDowntime.findUnique({
            where: { id }
        });
    }
}

export default PrismaPaymentDowntimeRepository;
