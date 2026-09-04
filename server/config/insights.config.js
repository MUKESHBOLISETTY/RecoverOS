import { prisma } from './database.config.js';
import { InsightsService } from '../src/domain/insights/insights.service.js';
import { InsightsController } from '../src/controllers/insights.controller.js';
import { createInsightsRoutes } from '../src/routes/insights.routes.js';

export const insightsService = new InsightsService(prisma);
export const insightsController = new InsightsController(insightsService);
export const insightsRouter = createInsightsRoutes(insightsController);
