import express from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

/**
 * @param {import('../controllers/auth.controller.js').AuthController} authController 
 */
function createAuthRouter(authController) {
  const router = express.Router();

  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.post('/logout', authenticateUser, authController.logout);

  return router;
}

export default createAuthRouter;
