import { prisma } from './database.config.js';

import PrismaConnectorCredentialRepository from '../src/infrastructure/db/connectors/prisma-connector-credential.repository.js';
import CredentialEncryptionService from '../src/domain/connectors/credential-encryption.service.js';
import ConnectorFactory from '../src/infrastructure/connectors/connector.factory.js';
import ConnectorManager from '../src/domain/connectors/connector.manager.js';
import ConnectorsController from '../src/controllers/connectors.controller.js';
import createConnectorsRouter from '../src/routes/connectors.routes.js';
import GoogleOAuthService from '../src/infrastructure/connectors/google-oauth.service.js';
import ShopifyOAuthService from '../src/infrastructure/connectors/shopify-oauth.service.js';
import PrismaAgentRepository from '../src/infrastructure/db/agent/prisma-agent.repository.js';

const credentialRepo = new PrismaConnectorCredentialRepository(prisma);
const encryptionService = new CredentialEncryptionService(process.env.ENCRYPTION_KEY);
const connectorFactory = new ConnectorFactory();
const connectorManager = new ConnectorManager({
    connectorFactory,
    encryptionService,
    credentialRepository: credentialRepo,
    cacheService: new Proxy({}, {
        get: (target, prop) => {
            return async (...args) => {
                const { cacheService: lazyCache } = await import('./redis.config.js');
                return lazyCache[prop](...args);
            };
        }
    })
});

const agentRepository = new PrismaAgentRepository(prisma);

const googleOAuthService = new GoogleOAuthService({
    connectorManager,
    cacheService: new Proxy({}, {
        get: (target, prop) => {
            return async (...args) => {
                const { cacheService: lazyCache } = await import('./redis.config.js');
                return lazyCache[prop](...args);
            };
        }
    })
});

const shopifyOAuthService = new ShopifyOAuthService({
    connectorManager,
    cacheService: new Proxy({}, {
        get: (target, prop) => {
            return async (...args) => {
                const { cacheService: lazyCache } = await import('./redis.config.js');
                return lazyCache[prop](...args);
            };
        }
    })
});

const connectorsController = new ConnectorsController(connectorManager, googleOAuthService, agentRepository, shopifyOAuthService);
const connectorsRouter = createConnectorsRouter(connectorsController);

export { connectorsRouter, connectorManager, connectorsController };
