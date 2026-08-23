import { RedisConfig, defaultRedisConfig } from '../src/infrastructure/redis/redis-options.js';
import { RedisConnectionManager, redisConnectionManager } from '../src/infrastructure/redis/redis-connection.manager.js';
import { BaseCacheService } from '../src/services/cache/base-cache.service.js';
import { RedisCacheService } from '../src/services/cache/redis-cache.service.js';
import { BasePubSubService } from '../src/services/pubsub/base-pubsub.service.js';
import { RedisPubSubService } from '../src/services/pubsub/redis-pubsub.service.js';
import { BaseQueueService } from '../src/services/queue/base-queue.service.js';
import { BullQueueService } from '../src/services/queue/bull-queue.service.js';
import { BaseWorkerService } from '../src/services/queue/base-worker.service.js';
import { EmailWorkerService } from '../src/services/queue/email-worker.service.js';

export const redisClient = redisConnectionManager.getConnection('default');
export const redisPub = redisConnectionManager.getPublisherConnection('publisher');
export const redisSub = redisConnectionManager.getSubscriberConnection('subscriber');

export const cacheService = new RedisCacheService(redisClient);
export const pubsubService = new RedisPubSubService(redisPub, redisSub);
export const emailQueueService = new BullQueueService('emailQueue');
export const emailWorkerService = new EmailWorkerService();

export const emailQueue = emailQueueService.getUnderlyingQueue();
export const emailWorker = emailWorkerService.getUnderlyingWorker();

import { WebhookEventQueue } from '../src/services/queue/webhook-event.queue.js';
import { WebhookEventWorker } from '../src/services/queue/webhook-event.worker.js';
import { RedisIdempotencyStore } from '../src/infrastructure/idempotency/redis-idempotency.store.js';
import { WebhookService } from '../src/services/webhook.service.js';
import { PaymentWebhookHandler } from '../src/services/webhooks/payment-webhook.handler.js';
import { prisma } from './database.config.js';
import { PaymentDowntimeWebhookHandler } from '../src/services/webhooks/payment-downtime-webhook.handler.js';
import { RazorpayPaymentRepository } from '../src/infrastructure/razorpay/razorpay-payment.repository.js';
import { ReconciliationService } from '../src/domain/payment/reconciliation.service.js';
import { ReconciliationQueue } from '../src/services/queue/reconciliation-queue.js';
import { ReconciliationWorker } from '../src/services/queue/reconciliation-worker.js';
import { ReconciliationJob } from '../src/infrastructure/jobs/reconciliation.job.js';

export const webhookService = new WebhookService([
    new PaymentWebhookHandler(),
    new PaymentDowntimeWebhookHandler()
]);
export const idempotencyStore = new RedisIdempotencyStore(cacheService);
export const webhookEventQueueService = new WebhookEventQueue();
export const webhookEventWorkerService = new WebhookEventWorker(prisma, webhookService);

function createReconciliationInfra() {
    try {
        const razorpayRepo = new RazorpayPaymentRepository();
        const reconciliationSvc = new ReconciliationService(prisma, razorpayRepo, cacheService);
        const reconciliationQueue = new ReconciliationQueue();
        const reconciliationWorker = new ReconciliationWorker(reconciliationSvc);
        const reconciliationJob = new ReconciliationJob(reconciliationQueue);
        return { reconciliationQueue, reconciliationWorker, reconciliationJob };
    } catch (err) {
        console.warn(
            `[ReconciliationInfra] Could not initialise reconciliation: ${err.message}. ` +
            'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable it.'
        );
        return null;
    }
}

const _reconciliation = createReconciliationInfra();
export const reconciliationQueue = _reconciliation?.reconciliationQueue ?? null;
export const reconciliationWorker = _reconciliation?.reconciliationWorker ?? null;
export const reconciliationJob = _reconciliation?.reconciliationJob ?? null;


export async function connectRedis() {
    try {
        if (redisClient.status !== 'ready') {
            await new Promise((resolve) => {
                redisClient.once('ready', resolve);
                redisClient.once('error', resolve);
                setTimeout(resolve, 3000);
            });
        }
        console.log('Successfully connected and authenticated to Redis!');
    } catch (error) {
        console.warn(`Failed to ping Redis on startup (${error.message}).`);
    }

    try {
        if (process.env.START_WORKERS === 'true' || process.env.NODE_ENV === 'development') {
            await emailWorkerService.start();
            await webhookEventWorkerService.start();

            if (reconciliationWorker && reconciliationJob) {
                reconciliationWorker.start();
                reconciliationJob.start().catch(err =>
                    console.error('Failed to start reconciliation job:', err)
                );
                console.log('Reconciliation worker started and nightly job scheduled.');
            }

            console.log('Background queue workers initialized and listening for jobs.');
        } else {
            console.log('Workers are NOT started (START_WORKERS is false). API is running in web-only mode.');
        }
    } catch (error) {
        console.warn(`Failed to start workers: ${error.message}`);
    }
}

export async function disconnectRedis() {
    try {
        if (reconciliationJob) await reconciliationJob.stop();
        if (reconciliationWorker) await reconciliationWorker.close();
        if (reconciliationQueue) await reconciliationQueue.close();

        await webhookEventWorkerService.close();
        await webhookEventQueueService.close();
        await emailWorkerService.close();
        await emailQueueService.close();
        await pubsubService.close();
        await redisConnectionManager.disconnectAll();
        console.log('Disconnected all Redis connections and workers.');
    } catch (error) {
        console.error('Error disconnecting Redis:', error.message);
    }
}

export {
    RedisConfig,
    defaultRedisConfig,
    RedisConnectionManager,
    redisConnectionManager,
    BaseCacheService,
    RedisCacheService,
    BasePubSubService,
    RedisPubSubService,
    BaseQueueService,
    BullQueueService,
    BaseWorkerService,
    EmailWorkerService
};

export default {
    connectRedis,
    disconnectRedis,
    config: defaultRedisConfig,
    connectionManager: redisConnectionManager,
    cache: cacheService,
    pubsub: pubsubService,
    emailQueue: emailQueueService,
    emailWorker: emailWorkerService,
    webhookEventQueue: webhookEventQueueService,
    webhookEventWorker: webhookEventWorkerService,
    webhookService: webhookService,
    reconciliationQueue,
    reconciliationWorker,
    reconciliationJob,
};
