import { MetricsService } from '../../infrastructure/observability/metrics.service.js';

export class ShopifyAbandonmentService {
    /**
     * @param {import('../events/webhook-event.repository.js').WebhookEventRepository} webhookEventRepository
     * @param {import('./recovery-case.repository.js').RecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../infrastructure/db/connectors/prisma-connector-credential.repository.js').PrismaConnectorCredentialRepository} credentialRepo
     * @param {import('../agent/agent-trigger.service.js').AgentTriggerService} agentTriggerService
     * @param {import('../agent/agent-execution.service.js').AgentExecutionService} agentExecutionService
     * @param {import('../../infrastructure/cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(
        webhookEventRepository,
        recoveryCaseRepository,
        credentialRepo,
        agentTriggerService,
        agentExecutionService,
        cacheService,
        recoveryEventPublisher = null
    ) {
        this.webhookEventRepository = webhookEventRepository;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.credentialRepo = credentialRepo;
        this.agentTriggerService = agentTriggerService;
        this.agentExecutionService = agentExecutionService;
        this.cacheService = cacheService;
        this.recoveryEventPublisher = recoveryEventPublisher;
    }

    async processAbandonment({ shopDomain, checkoutToken, webhookEventId, checkoutUpdatedAt, jobId }) {
        console.log(`[ShopifyAbandonmentService] Safe Job Metadata:`, {
            provider: 'SHOPIFY',
            topic: 'checkouts/update',
            shopDomain,
            checkoutTokenPresent: !!checkoutToken,
            webhookEventId,
            verificationJobId: jobId
        });

        const latestCheckoutUpdate = await this.webhookEventRepository.findLatestShopifyCheckoutUpdate(shopDomain, checkoutToken);
        if (!latestCheckoutUpdate) {
            console.log(`[ShopifyAbandonmentService] Token ${checkoutToken} has no persisted checkouts/update events. (Job: ${jobId})`);
            return { status: 'DONE', stage: '3B', reason: 'NO_CHECKOUT_UPDATE_EVENTS' };
        }

        // Stale check
        const latestEventUpdatedAt = new Date(latestCheckoutUpdate.payload.updated_at).getTime();
        const currentEventUpdatedAt = new Date(checkoutUpdatedAt).getTime();

        if (latestEventUpdatedAt > currentEventUpdatedAt) {
            console.log(`[ShopifyAbandonmentService] Job ${jobId} is stale. Newer checkout activity exists. (Token: ${checkoutToken})`);
            return { status: 'DONE', stage: '3B', reason: 'STALE_EVENT_DEBOUNCED' };
        }

        // Completion check
        const orderCreateEvent = await this.webhookEventRepository.findShopifyOrderCreateByCheckoutToken(shopDomain, checkoutToken);
        if (orderCreateEvent) {
            console.log(`[ShopifyAbandonmentService] Checkout ${checkoutToken} has already been completed via orders/create. Ignoring abandonment. (Job: ${jobId})`);
            return { status: 'DONE', stage: '3B', reason: 'CHECKOUT_ALREADY_COMPLETED' };
        }

        // Contact eligibility
        const payload = latestCheckoutUpdate.payload;
        const email = payload.email || payload.customer?.email;
        const phone = payload.phone || payload.customer?.phone;

        if (!email && !phone) {
            console.log(`[ShopifyAbandonmentService] Checkout ${checkoutToken} has no usable contact channels. (Job: ${jobId})`);
            return { status: 'DONE', stage: '3B', reason: 'NO_USABLE_CONTACT' };
        }

        // Duplicate prevention & creation critical section
        const lockKey = `lock:shopify:recovery-case:${shopDomain}:${checkoutToken}`;
        const lockValue = jobId;
        const lockAcquired = await this.cacheService.setNx(lockKey, lockValue, 30);

        if (!lockAcquired) {
            console.log(`[ShopifyAbandonmentService] Failed to acquire lock for checkout ${checkoutToken} on ${shopDomain}. Another worker is processing it. (Job: ${jobId})`);
            return { status: 'DONE', stage: '3B', reason: 'CONCURRENT_PROCESSING_SKIPPED' };
        }

        try {
            const existingCase = await this.recoveryCaseRepository.findShopifyAbandonmentCase(shopDomain, checkoutToken);
            if (existingCase) {
                console.log(`[ShopifyAbandonmentService] CART_ABANDONMENT case already exists for checkout ${checkoutToken} on ${shopDomain}. (Job: ${jobId})`);
                return { status: 'DONE', stage: '3B', reason: 'RECOVERY_CASE_ALREADY_EXISTS' };
            }

            // RecoveryCase creation
            const contextSnapshot = {
                shopDomain,
                checkoutToken,
                checkoutUrl: payload.abandoned_checkout_url,
                customer: {
                    firstName: payload.customer?.first_name || null,
                    emailAvailable: !!email,
                    phoneAvailable: !!phone
                },
                cartValue: payload.total_price,
                currency: payload.currency || payload.presentment_currency,
                itemCount: Array.isArray(payload.line_items) ? payload.line_items.length : 0,
                createdAt: payload.created_at,
                updatedAt: payload.updated_at
            };

            const recoveryCase = await this.recoveryCaseRepository.create({
                type: 'CART_ABANDONMENT',
                subjectType: 'CHECKOUT',
                subjectId: checkoutToken,
                status: 'OPEN',
                contextSnapshot
            });

            MetricsService.increment('cart_recovery_count');

            console.log(`[ShopifyAbandonmentService] Successfully created CART_ABANDONMENT RecoveryCase ${recoveryCase.id} for checkout ${checkoutToken} on ${shopDomain}`);

            // Trigger AgentExecution
            try {
                const connectionName = `Shopify (${shopDomain})`;
                const credential = await this.credentialRepo.findByConnectorAndName('shopify', connectionName);

                if (credential) {
                    const userId = credential.userId;

                    if (this.recoveryEventPublisher) {
                        await this.recoveryEventPublisher.publishCaseCreated(recoveryCase.id, 'CART_ABANDONMENT', 'shopify', userId);
                    }

                    const triggeredAgents = await this.agentTriggerService.evaluateTriggers(userId, 'checkout.abandoned', payload);
                    const exactAgents = triggeredAgents.filter(agent =>
                        agent.connections && agent.connections.some(c => c.connectorId === credential.id)
                    );

                    if (exactAgents.length > 0) {
                        for (const agent of exactAgents) {
                            try {
                                const execution = await this.agentExecutionService.createExecution({
                                    agent,
                                    userId,
                                    triggerType: 'checkout.abandoned',
                                    triggerId: recoveryCase.id,
                                    inputContext: {
                                        recoveryCaseId: recoveryCase.id,
                                        checkoutToken
                                    }
                                });

                                await this.agentExecutionService.enqueueExecution(execution);
                                MetricsService.increment('agent_execution_created_count', { triggerType: 'checkout.abandoned', agentId: agent.id });
                                console.log(`[ShopifyAbandonmentService] Queued AgentExecution ${execution.id} for agent ${agent.id}`);
                            } catch (err) {
                                if (err.name === 'DuplicateExecutionError') {
                                    console.log(`[ShopifyAbandonmentService] Execution already exists for case ${recoveryCase.id}, skipping.`);
                                } else {
                                    console.error(`[ShopifyAbandonmentService] Failed to create execution for agent ${agent.id}:`, err);
                                }
                            }
                        }
                    } else {
                        console.log(`[ShopifyAbandonmentService] No exact agent match found for checkout ${checkoutToken} (Store: ${shopDomain}).`);
                    }
                } else {
                    console.log(`[ShopifyAbandonmentService] No ConnectorCredential found for shopDomain ${shopDomain}. Skipping AgentExecution.`);
                }
            } catch (err) {
                console.error(`[ShopifyAbandonmentService] Error triggering agent execution:`, err);
            }

            return { status: 'DONE', stage: '3B', recoveryCaseId: recoveryCase.id };
        } finally {
            // lock release
            const currentLockOwner = await this.cacheService.get(lockKey);
            if (currentLockOwner === lockValue) {
                await this.cacheService.del(lockKey);
            }
        }
    }
}
