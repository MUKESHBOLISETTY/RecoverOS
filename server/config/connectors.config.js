import { prisma } from './database.config.js';
import { cacheService } from './redis.config.js';
import PrismaConnectorCredentialRepository from '../src/infrastructure/db/connectors/prisma-connector-credential.repository.js';
import CredentialEncryptionService from '../src/domain/connectors/credential-encryption.service.js';
import ConnectorFactory from '../src/infrastructure/connectors/connector.factory.js';
import ConnectorManager from '../src/domain/connectors/connector.manager.js';
import ConnectorsController from '../src/controllers/connectors.controller.js';
import createConnectorsRouter from '../src/routes/connectors.routes.js';
import GoogleOAuthService from '../src/infrastructure/connectors/google-oauth.service.js';

const credentialRepo = new PrismaConnectorCredentialRepository(prisma);
const encryptionService = new CredentialEncryptionService(process.env.ENCRYPTION_KEY);
const connectorFactory = new ConnectorFactory();
const connectorManager = new ConnectorManager({
    connectorFactory,
    encryptionService,
    credentialRepository: credentialRepo,
    cacheService
});

const googleOAuthService = new GoogleOAuthService({ connectorManager, cacheService });

const connectorsController = new ConnectorsController(connectorManager, googleOAuthService);
const connectorsRouter = createConnectorsRouter(connectorsController);

export { connectorsRouter, connectorManager, connectorsController };
