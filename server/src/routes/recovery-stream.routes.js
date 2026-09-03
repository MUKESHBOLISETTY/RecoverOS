import { Router } from 'express';
import { subscribeToRecoveryEvents } from '../controllers/recovery-stream.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateUser, subscribeToRecoveryEvents);

export default router;
