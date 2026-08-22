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

export const webhookService = new WebhookService([
    new PaymentWebhookHandler()
]);
export const idempotencyStore = new RedisIdempotencyStore(cacheService);
export const webhookEventQueueService = new WebhookEventQueue();
export const webhookEventWorkerService = new WebhookEventWorker(prisma, webhookService);


export async function connectRedis() {
    try {
        await redisClient.ping();
        console.log('Successfully connected and authenticated to Redis!');
        console.log('Background queue workers initialized and listening for jobs.');
    } catch (error) {
        console.warn(`Failed to connect to Redis on startup (${error.message}). Continuing with graceful cache fallback...`);
    }
}

export async function disconnectRedis() {
    try {
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
    webhookService: webhookService
};
