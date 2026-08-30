import express from 'express';
import { authenticateUser } from '../middlewares/auth.middleware.js';

/**
 * @param {import('../controllers/connectors.controller.js').default} connectorsController 
 */
function createConnectorsRouter(connectorsController) {
  const router = express.Router();

  router.get('/google/callback', connectorsController.handleGoogleCallback);

  router.use(authenticateUser);

  router.get('/available', connectorsController.getAvailableConnectors);

  router.post('/google/init', connectorsController.initGoogleOAuth);

  router.get('/google/spreadsheets', connectorsController.getGoogleSpreadsheets);

  router.post('/google/spreadsheets/finalize', connectorsController.finalizeSheetsConnection);

  router.get('/', connectorsController.getUserConnections);

  router.post('/', connectorsController.saveConnection);

  router.post('/:id/sync', connectorsController.syncConnection);

  router.delete('/:id', connectorsController.deleteConnection);

  return router;
}

export default createConnectorsRouter;
