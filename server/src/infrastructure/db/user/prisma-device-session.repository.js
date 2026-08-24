import { DeviceSessionRepository } from '../../../domain/user/device-session.repository.js';
import { prisma } from '../../../../config/database.config.js';

export class PrismaDeviceSessionRepository extends DeviceSessionRepository {
    async create(sessionData) {
        return prisma.deviceSession.create({
            data: sessionData
        });
    }

    async findById(id) {
        return prisma.deviceSession.findUnique({
            where: { id }
        });
    }

    async delete(id) {
        return prisma.deviceSession.delete({
            where: { id }
        });
    }
}
