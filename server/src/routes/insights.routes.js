import { Router } from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export function createInsightsRoutes(insightsController) {
    const router = Router();

    router.use(authenticateUser);

    router.get('/dashboard', insightsController.getDashboardMetrics);

    return router;
}
