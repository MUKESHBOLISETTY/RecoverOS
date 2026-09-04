import { Router } from 'express';
import OnboardingController from '../controllers/onboarding.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

const router = Router();
const onboardingController = new OnboardingController();

router.use(authenticateUser);

router.get('/status', onboardingController.getStatus);

export default router;
