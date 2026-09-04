import { Router } from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export function createAuditRoutes(auditController) {
    const router = Router();

    router.use(authenticateUser);

    router.get('/', auditController.getAuditEvents);

    return router;
}
