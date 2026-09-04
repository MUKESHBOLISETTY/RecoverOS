import { AuthService } from '../src/domain/auth/auth.service.js';
import { AuthController } from '../src/controllers/auth.controller.js';
import { PrismaUserRepository } from '../src/infrastructure/db/user/prisma-user.repository.js';
import { PrismaDeviceSessionRepository } from '../src/infrastructure/db/user/prisma-device-session.repository.js';
import { AgentProvisioningService } from '../src/domain/agent/agent-provisioning.service.js';
import { prisma } from './database.config.js';

const userRepository = new PrismaUserRepository(prisma);
const deviceSessionRepository = new PrismaDeviceSessionRepository(prisma);
const agentProvisioningService = new AgentProvisioningService(prisma);

export const authService = new AuthService(userRepository, deviceSessionRepository, agentProvisioningService);

export const authController = new AuthController(authService);
