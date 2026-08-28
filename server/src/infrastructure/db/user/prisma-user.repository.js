import { UserRepository } from '../../../domain/user/user.repository.js';

export class PrismaUserRepository extends UserRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaUserRepository: prisma is required');
        this.prisma = prisma;
    }

    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email }
        });
    }

    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id }
        });
    }

    async create(userData) {
        return this.prisma.user.create({
            data: userData
        });
    }

    async update(id, data) {
        return this.prisma.user.update({
            where: { id },
            data
        });
    }
}
