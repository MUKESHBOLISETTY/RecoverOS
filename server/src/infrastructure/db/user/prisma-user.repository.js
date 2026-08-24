import { UserRepository } from '../../../domain/user/user.repository.js';
import { prisma } from '../../../../config/database.config.js';

export class PrismaUserRepository extends UserRepository {
    async findByEmail(email) {
        return prisma.user.findUnique({
            where: { email }
        });
    }

    async findById(id) {
        return prisma.user.findUnique({
            where: { id }
        });
    }

    async create(userData) {
        return prisma.user.create({
            data: userData
        });
    }

    async update(id, data) {
        return prisma.user.update({
            where: { id },
            data
        });
    }
}
