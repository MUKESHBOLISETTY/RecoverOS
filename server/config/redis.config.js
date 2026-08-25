import { RedisConfig, defaultRedisConfig } from '../src/infrastructure/redis/redis-options.js';
import { RedisConnectionManager, redisConnectionManager } from '../src/infrastructure/redis/redis-connection.manager.js';
import { BaseCacheService } from '../src/infrastructure/cache/base-cache.service.js';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service.js';
import { BasePubSubService } from '../src/infrastructure/pubsub/base-pubsub.service.js';
import { RedisPubSubService } from '../src/infrastructure/pubsub/redis-pubsub.service.js';
import { BaseQueueService } from '../src/infrastructure/queue/base-queue.service.js';
import { BullQueueService } from '../src/infrastructure/queue/bull-queue.service.js';
import { BaseWorkerService } from '../src/infrastructure/queue/base-worker.service.js';
import { EmailWorkerService } from '../src/infrastructure/queue/email-worker.service.js';

export const redisClient = redisConnectionManager.getConnection('default');
export const redisPub = redisConnectionManager.getPublisherConnection('publisher');
export const redisSub = redisConnectionManager.getSubscriberConnection('subscriber');

export const cacheService = new RedisCacheService(redisClient);
export const pubsubService = new RedisPubSubService(redisPub, redisSub);
export const emailQueueService = new BullQueueService('emailQueue');
export const emailWorkerService = new EmailWorkerService();

export const emailQueue = emailQueueService.getUnderlyingQueue();
export const emailWorker = emailWorkerService.getUnderlyingWorker();

import { WebhookEventQueue } from '../src/infrastructure/queue/webhook-event.queue.js';
import { WebhookEventWorker } from '../src/infrastructure/queue/webhook-event.worker.js';
import { RedisIdempotencyStore } from '../src/infrastructure/idempotency/redis-idempotency.store.js';
import { WebhookService } from '../src/infrastructure/webhooks/webhook.service.js';
import { PaymentWebhookHandler } from '../src/infrastructure/webhooks/payment-webhook.handler.js';
import { prisma } from './database.config.js';
import { PaymentDowntimeWebhookHandler } from '../src/infrastructure/webhooks/payment-downtime-webhook.handler.js';
import { RazorpayPaymentRepository } from '../src/infrastructure/razorpay/razorpay-payment.repository.js';
import { ReconciliationService } from '../src/domain/payment/reconciliation.service.js';
import { ReconciliationQueue } from '../src/infrastructure/queue/reconciliation-queue.js';
import { ReconciliationWorker } from '../src/infrastructure/queue/reconciliation-worker.js';
import { ReconciliationJob } from '../src/infrastructure/jobs/reconciliation.job.js';

export const webhookService = new WebhookService([
    new PaymentWebhookHandler(),
    new PaymentDowntimeWebhookHandler()
]);
export const idempotencyStore = new RedisIdempotencyStore(cacheService);
export const webhookEventQueueService = new WebhookEventQueue();
export const webhookEventWorkerService = new WebhookEventWorker(prisma, webhookService);

export let reconciliationQueue = null;
export let reconciliationWorker = null;
export let reconciliationJob = null;


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

            if (!reconciliationQueue) {
                try {
                    const { connectorManager } = await import('./connectors.config.js');
                    const reconciliationSvc = new ReconciliationService(prisma, connectorManager, cacheService);
                    reconciliationQueue = new ReconciliationQueue();
                    reconciliationWorker = new ReconciliationWorker(reconciliationSvc);
                    reconciliationJob = new ReconciliationJob(reconciliationQueue);
                } catch (err) {
                    console.warn(`[ReconciliationInfra] Could not initialise reconciliation: ${err.message}`);
                }
            }

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
