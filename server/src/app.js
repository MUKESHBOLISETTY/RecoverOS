import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import "dotenv/config";
import helmet from 'helmet';
import createWebhookRouter from './routes/webhook.routes.js';
import createAuthRouter from './routes/auth.routes.js';
import recoveryStreamRoutes from './routes/recovery-stream.routes.js';
import { connectorsRouter, connectorManager } from '../config/connectors.config.js';
import { connectDB } from '../config/database.config.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import { connectRedis, idempotencyStore, webhookEventQueueService, webhookEventRepository } from '../config/redis.config.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { ShopifyWebhookController } from './controllers/shopify-webhook.controller.js';
import { authController } from '../config/auth.config.js';
import { insightsRouter } from '../config/insights.config.js';
import { policyRouter } from '../config/policy.config.js';
import { casesRouter } from '../config/cases.config.js';
import { auditRouter } from '../config/audit.config.js';

const app = express();
connectDB();
connectRedis();
const corsoptions = {
    origin: process.env.CORS_ORIGIN,
    methods: "GET, POST, PUT, DELETE, HEAD, PATCH",
    credentials: true,
};
app.use(cors(corsoptions));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.set('trust proxy', 1);

const webhookController = new WebhookController(idempotencyStore, webhookEventQueueService, connectorManager);
const shopifyWebhookController = new ShopifyWebhookController(idempotencyStore, webhookEventQueueService, connectorManager, webhookEventRepository);
const webhookRoutes = createWebhookRouter(webhookController);
const authRoutes = createAuthRouter(authController);

app.post('/webhooks/shopify', express.raw({ type: 'application/json' }), shopifyWebhookController.ingestEvent);

app.use(express.json());
app.use(cookieParser());

app.use('/webhooks', webhookRoutes);
app.use('/auth', authRoutes);
app.use('/connectors', connectorsRouter);
app.use('/api/v1/recovery/stream', recoveryStreamRoutes);
app.use('/api/v1/insights', insightsRouter);
app.use('/api/v1/policy', policyRouter);
app.use('/api/v1/cases', casesRouter);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/audit', auditRouter);

app.get('/', (req, res) => {
    return res.json({
        success: true,
        message: "Your server is up and running",
    });
});

// app.use((err, req, res, next) => {
//     if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
//         return res.status(400).json({
//             success: false,
//             message: "Bad Request: Malformed JSON"
//         });
//     }
//     res.status(err.statusCode || 500).json({
//         success: false,
//         message: "An unexpected error occurred on the server."
//     });
// });

export default app;