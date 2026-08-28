import { DeviceSessionRepository } from '../../../domain/user/device-session.repository.js';

export class PrismaDeviceSessionRepository extends DeviceSessionRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaDeviceSessionRepository: prisma is required');
        this.prisma = prisma;
    }

    async create(sessionData) {
        return this.prisma.deviceSession.create({
            data: sessionData
        });
    }

    async findById(id) {
        return this.prisma.deviceSession.findUnique({
            where: { id }
        });
    }

    async delete(id) {
        return this.prisma.deviceSession.delete({
            where: { id }
        });
    }
}
