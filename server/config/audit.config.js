import { prisma } from './database.config.js';
import { AuditService } from '../src/domain/audit/audit.service.js';
import { AuditController } from '../src/controllers/audit.controller.js';
import { createAuditRoutes } from '../src/routes/audit.routes.js';

export const auditService = new AuditService(prisma);
export const auditController = new AuditController(auditService);
export const auditRouter = createAuditRoutes(auditController);
