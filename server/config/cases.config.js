import { prisma } from './database.config.js';
import { CasesController } from '../src/controllers/cases.controller.js';
import { createCasesRoutes } from '../src/routes/cases.routes.js';

export const casesController = new CasesController(prisma);
export const casesRouter = createCasesRoutes(casesController);
