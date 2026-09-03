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

import { RecoveryEventPublisher } from '../src/infrastructure/pubsub/recovery-event.publisher.js';
export const recoveryEventPublisher = new RecoveryEventPublisher(pubsubService);

import { WebhookEventQueue } from '../src/infrastructure/queue/webhook-event.queue.js';
import { WebhookEventWorker } from '../src/infrastructure/queue/webhook-event.worker.js';
import { RedisIdempotencyStore } from '../src/infrastructure/idempotency/redis-idempotency.store.js';
import { WebhookService } from '../src/infrastructure/webhooks/webhook.service.js';
import { ShopifyAbandonmentQueue } from '../src/infrastructure/queue/shopify-abandonment.queue.js';
import { ShopifyAbandonmentWorker } from '../src/infrastructure/queue/shopify-abandonment.worker.js';
import { ShopifyCheckoutWebhookHandler } from '../src/infrastructure/webhooks/shopify-checkout-webhook.handler.js';
import { ShopifyOrderWebhookHandler } from '../src/infrastructure/webhooks/shopify-order-webhook.handler.js';
import { PaymentWebhookHandler } from '../src/infrastructure/webhooks/payment-webhook.handler.js';
import { prisma } from './database.config.js';
import { PaymentDowntimeWebhookHandler } from '../src/infrastructure/webhooks/payment-downtime-webhook.handler.js';
import { RazorpayPaymentRepository } from '../src/infrastructure/razorpay/razorpay-payment.repository.js';
import { ReconciliationService } from '../src/domain/payment/reconciliation.service.js';
import { ReconciliationQueue } from '../src/infrastructure/queue/reconciliation-queue.js';
import { ReconciliationWorker } from '../src/infrastructure/queue/reconciliation-worker.js';
import { ReconciliationJob } from '../src/infrastructure/jobs/reconciliation.job.js';

import { PrismaWebhookEventRepository } from '../src/infrastructure/db/webhook/prisma-webhook-event.repository.js';
import { PrismaRecoveryCaseRepository } from '../src/infrastructure/db/recovery/prisma-recovery-case.repository.js';

export const shopifyAbandonmentQueueService = new ShopifyAbandonmentQueue();
export const recoveryCaseRepo = new PrismaRecoveryCaseRepository(prisma);

import { RecoveryCompletionService } from '../src/domain/recovery/recovery-completion.service.js';
export const recoveryCompletionService = new RecoveryCompletionService(recoveryCaseRepo, cacheService);

export const webhookService = new WebhookService([
    new PaymentWebhookHandler(),
    new PaymentDowntimeWebhookHandler(),
    new ShopifyCheckoutWebhookHandler(shopifyAbandonmentQueueService),
    new ShopifyOrderWebhookHandler(recoveryCaseRepo, recoveryCompletionService)
]);
export const idempotencyStore = new RedisIdempotencyStore(cacheService);
export const webhookEventQueueService = new WebhookEventQueue();

export const webhookEventRepository = new PrismaWebhookEventRepository(prisma);
export const webhookEventWorkerService = new WebhookEventWorker(prisma, webhookEventRepository, webhookService);

export let reconciliationQueue = null;
export let reconciliationWorker = null;
export let reconciliationJob = null;

import { AgentExecutionQueue } from '../src/infrastructure/queue/agent-execution.queue.js';
import { RecoveryScheduleQueue } from '../src/infrastructure/queue/recovery-schedule.queue.js';
import { AgentExecutionWorker } from '../src/infrastructure/queue/agent-execution.worker.js';
import { RecoveryScheduleWorker } from '../src/infrastructure/queue/recovery-schedule.worker.js';
import { OutboxPublisher } from '../src/infrastructure/outbox/outbox.publisher.js';
import { RecoveryCaseService } from '../src/domain/recovery/recovery-case.service.js';
import { PrismaAgentExecutionRepository } from '../src/infrastructure/db/agent/prisma-agent-execution.repository.js';
import { PrismaPaymentRepository } from '../src/infrastructure/db/payment/prisma-payment.repository.js';
import { PrismaPaymentFailureCorrelationRepository } from '../src/infrastructure/db/correlation/prisma-payment-failure-correlation.repository.js';
import { PrismaRecoveryActionRepository } from '../src/infrastructure/db/agent/prisma-recovery-action.repository.js';
import { PrismaAgentRepository } from '../src/infrastructure/db/agent/prisma-agent.repository.js';
import { PrismaRecoveryScheduleRepository } from '../src/infrastructure/db/schedule/prisma-recovery-schedule.repository.js';
import { PrismaOutboxEventRepository } from '../src/infrastructure/db/outbox/prisma-outbox-event.repository.js';

export const agentExecutionQueueService = new AgentExecutionQueue();
export const recoveryScheduleQueueService = new RecoveryScheduleQueue();

const agentExecutionRepository = new PrismaAgentExecutionRepository(prisma);
const paymentRepository = new PrismaPaymentRepository(prisma);
const paymentFailureCorrelationRepository = new PrismaPaymentFailureCorrelationRepository(prisma);
const recoveryActionRepository = new PrismaRecoveryActionRepository(prisma);
const agentRepository = new PrismaAgentRepository(prisma);

const recoveryCaseService = new RecoveryCaseService(recoveryCaseRepo);

import PrismaConnectorCredentialRepository from '../src/infrastructure/db/connectors/prisma-connector-credential.repository.js';
const credentialRepo = new PrismaConnectorCredentialRepository(prisma);

import { connectorManager } from './connectors.config.js';

import { ShopifyCommerceVerifier } from '../src/domain/recovery/verification/shopify-commerce.verifier.js';
import { RazorpayPaymentVerifier } from '../src/domain/recovery/verification/razorpay-payment.verifier.js';
import { RecoveryVerifierRegistry } from '../src/domain/recovery/verification/recovery-verifier.registry.js';
import { RecoveryVerificationService } from '../src/domain/recovery/verification/recovery-verification.service.js';
import ShopifyConnector from '../src/infrastructure/connectors/shopify-connector.js'; // Assume available or injected via factory

const shopifyVerifier = new ShopifyCommerceVerifier(paymentRepository, connectorManager.connectorFactory.getConnector('shopify'), connectorManager, webhookEventRepository);
const razorpayRepoFactory = (credentials) => new RazorpayPaymentRepository(credentials);
const razorpayVerifier = new RazorpayPaymentVerifier(paymentRepository, razorpayRepoFactory, connectorManager);
const verifierRegistry = new RecoveryVerifierRegistry();
verifierRegistry.register(shopifyVerifier);
verifierRegistry.register(razorpayVerifier);

export const recoveryVerificationService = new RecoveryVerificationService(verifierRegistry);

import { RecoveryPolicyValidator } from '../src/domain/agent/policy/recovery-policy.validator.js';
import { AgentTriggerService } from '../src/domain/agent/agent-trigger.service.js';
const agentTriggerService = new AgentTriggerService(agentRepository, connectorManager, cacheService);

import { AgentExecutionService } from '../src/domain/agent/agent-execution.service.js';
const agentExecutionService = new AgentExecutionService(agentExecutionRepository, agentExecutionQueueService);

import { ShopifyAbandonmentService } from '../src/domain/recovery/shopify-abandonment.service.js';
const shopifyAbandonmentService = new ShopifyAbandonmentService(
    webhookEventRepository,
    recoveryCaseRepo,
    credentialRepo,
    agentTriggerService,
    agentExecutionService,
    cacheService,
    recoveryEventPublisher
);

export const shopifyAbandonmentWorkerService = new ShopifyAbandonmentWorker(shopifyAbandonmentService);

const subjectContextRegistryFactory = async (credentials) => {
    const { SubjectContextRegistry } = await import('../src/domain/recovery/context-providers/subject-context.registry.js');
    const { PaymentContextProvider } = await import('../src/domain/recovery/context-providers/payment-context.provider.js');
    const { CheckoutContextProvider } = await import('../src/domain/recovery/context-providers/checkout-context.provider.js');
    const { RecoveryHistoryBuilder } = await import('../src/domain/recovery/recovery-history.builder.js');

    const { RazorpayOrderRepository } = await import('../src/infrastructure/razorpay/razorpay-order.repository.js');
    const { OrderContextService } = await import('../src/domain/recovery/order-context.service.js');
    const { FailureDiagnosisService } = await import('../src/domain/recovery/failure-diagnosis.service.js');

    const orderRepository = new RazorpayOrderRepository(credentials);
    const orderContextService = new OrderContextService(orderRepository, cacheService);
    const failureDiagnosisService = new FailureDiagnosisService();
    const recoveryHistoryBuilder = new RecoveryHistoryBuilder(recoveryActionRepository);

    const paymentContextProvider = new PaymentContextProvider(
        paymentRepository,
        paymentFailureCorrelationRepository,
        recoveryHistoryBuilder,
        failureDiagnosisService,
        orderContextService,
        connectorManager
    );

    const checkoutContextProvider = new CheckoutContextProvider(
        webhookEventRepository,
        recoveryHistoryBuilder
    );

    const registry = new SubjectContextRegistry();
    registry.register('PAYMENT', paymentContextProvider);
    registry.register('CHECKOUT', checkoutContextProvider);
    return registry;
};

const { TriggerContextResolver } = await import('../src/domain/agent/execution/trigger-context.resolver.js');
const { skillSelector, skillRegistry } = await import('./skills.config.js');
const triggerContextResolver = new TriggerContextResolver(
    recoveryCaseService,
    subjectContextRegistryFactory,
    skillSelector,
    skillRegistry
);

export const agentExecutionWorkerService = new AgentExecutionWorker(
    agentExecutionRepository,
    agentRepository,
    triggerContextResolver,
    recoveryCaseRepo,
    paymentRepository
);

const recoveryScheduleRepository = new PrismaRecoveryScheduleRepository(prisma);

export const recoveryScheduleWorkerService = new RecoveryScheduleWorker(
    recoveryScheduleRepository,
    recoveryCaseRepo,
    agentExecutionRepository,
    recoveryCaseService,
    agentExecutionQueueService,
    recoveryVerificationService,
    RecoveryPolicyValidator
);

import { PaymentStabilizationWorker } from '../src/infrastructure/queue/payment-stabilization.worker.js';
export const paymentStabilizationWorkerService = new PaymentStabilizationWorker(
    recoveryVerificationService,
    RecoveryPolicyValidator,
    agentExecutionService,
    recoveryCaseRepo,
    agentTriggerService,
    paymentRepository
);

const outboxEventRepository = new PrismaOutboxEventRepository(prisma);
export const outboxPublisher = new OutboxPublisher(outboxEventRepository, recoveryScheduleQueueService);

import { RecoveryScheduleReconciler } from '../src/infrastructure/reconciliation/recovery-schedule.reconciler.js';
export const recoveryScheduleReconciler = new RecoveryScheduleReconciler(
    recoveryScheduleRepository,
    outboxEventRepository,
    recoveryCaseService,
    recoveryScheduleQueueService
);


export async function connectRedis() {
    try {
        if (redisClient.status !== 'ready') {
            if (redisClient.status === 'wait') {
                await redisClient.connect();
            } else {
                await new Promise((resolve, reject) => {
                    const onReady = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    const timeout = setTimeout(() => {
                        redisClient.off('ready', onReady);
                        reject(new Error("Redis connection timeout after 10s"));
                    }, 10000);
                    redisClient.once('ready', onReady);
                });
            }
        }
        console.log('Successfully connected and authenticated to Redis!');
    } catch (error) {
        console.warn(`Failed to connect to Redis on startup (${error.message}). Aborting worker initialization.`);
        return;
    }

    try {
        if (process.env.START_WORKERS === 'true' || process.env.NODE_ENV === 'development') {
            await emailWorkerService.start();
            await webhookEventWorkerService.start();
            await shopifyAbandonmentWorkerService.start();
            await agentExecutionWorkerService.start();
            await recoveryScheduleWorkerService.start();
            await paymentStabilizationWorkerService.start();
            outboxPublisher.start();
            recoveryScheduleReconciler.start();

            if (!reconciliationQueue) {
                try {
                    const { connectorManager } = await import('./connectors.config.js');
                    const { PrismaUserRepository } = await import('../src/infrastructure/db/user/prisma-user.repository.js');
                    const userRepository = new PrismaUserRepository(prisma);
                    const razorpayRepoFactory = (credentials) => new RazorpayPaymentRepository(credentials);
                    const reconciliationSvc = new ReconciliationService(paymentRepository, connectorManager, cacheService, razorpayRepoFactory, userRepository);
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

        recoveryScheduleReconciler.stop();
        await outboxPublisher.stop();
        await recoveryScheduleWorkerService.close();
        await paymentStabilizationWorkerService.close();
        await webhookEventWorkerService.close();
        await shopifyAbandonmentWorkerService.close();
        await webhookEventQueueService.close();
        await shopifyAbandonmentQueueService.close();
        await recoveryScheduleQueueService.close();
        await agentExecutionWorkerService.close();
        await agentExecutionQueueService.close();
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
    shopifyAbandonmentQueue: shopifyAbandonmentQueueService,
    shopifyAbandonmentWorker: shopifyAbandonmentWorkerService,
    webhookService: webhookService,
    agentExecutionQueue: agentExecutionQueueService,
    agentExecutionWorker: agentExecutionWorkerService,
    recoveryScheduleQueue: recoveryScheduleQueueService,
    recoveryScheduleWorker: recoveryScheduleWorkerService,
    reconciliationQueue,
    reconciliationWorker,
    reconciliationJob,
};
