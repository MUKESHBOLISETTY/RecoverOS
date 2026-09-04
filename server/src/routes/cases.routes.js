import { Router } from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export function createCasesRoutes(casesController) {
    const router = Router();

    router.use(authenticateUser);

    router.get('/', casesController.getCases);
    router.get('/:id', casesController.getCaseDetails);

    return router;
}
