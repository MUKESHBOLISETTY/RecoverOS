import { Router } from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export function createPolicyRoutes(policyController) {
    const router = Router();

    router.use(authenticateUser);

    router.get('/', policyController.getPolicy);
    router.put('/', policyController.updatePolicy);

    return router;
}
