import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { PaymentMapper } from "../../domain/payment/payment-mapper.js";
import { RecoveryCompletionService } from "../../domain/recovery/recovery-completion.service.js";
import { cacheService } from "../../../config/redis.config.js";
import { AgentTriggerService } from "../../domain/agent/agent-trigger.service.js";
import { PrismaAgentRepository } from "../db/agent/prisma-agent.repository.js";
import { connectorManager } from "../../../config/connectors.config.js";
import { PrismaAgentExecutionRepository } from "../db/agent/prisma-agent-execution.repository.js";
import { AgentExecutionService } from "../../domain/agent/agent-execution.service.js";
import { prisma as globalPrisma } from "../../../config/database.config.js";
import { agentExecutionQueueService } from "../../../config/redis.config.js";
import PrismaConnectorCredentialRepository from "../db/connectors/prisma-connector-credential.repository.js";
import { PrismaPaymentRepository } from "../db/payment/prisma-payment.repository.js";
import { PrismaRecoveryCaseRepository } from "../db/recovery/prisma-recovery-case.repository.js";
import { PrismaPaymentDowntimeRepository } from "../db/correlation/prisma-payment-downtime.repository.js";
import { PrismaPaymentFailureCorrelationRepository } from "../db/correlation/prisma-payment-failure-correlation.repository.js";
import { PaymentRecoveryService } from "../../domain/payment/payment-recovery.service.js";
import { PaymentStabilizationQueue } from "../queue/payment-stabilization.queue.js";
import { redisConnectionManager } from "../../../config/redis.config.js";

export class PaymentWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment");
    }

    /**
     * @param {{ body: object, eventType: string, eventId?: string, externalEventId?: string, provider?: string, _tx: import('@prisma/client').PrismaClient, postCommitHooks?: Function[] }} webhook
     */
    async handle(webhook) {
        const {
            connectionId,
            body,
            eventType,
            eventId,
            externalEventId,
            provider,
            _tx: prisma,
            postCommitHooks
        } = webhook;

        const connectorCredentialRepository = new PrismaConnectorCredentialRepository(prisma);
        const paymentRepository = new PrismaPaymentRepository(prisma);
        const recoveryCaseRepository = new PrismaRecoveryCaseRepository(prisma);

        let userId = null;
        let connection = null;
        if (connectionId) {
            connection = await connectorCredentialRepository.findById(connectionId);
            if (connection) userId = connection.userId;
        }

        const paymentDowntimeRepository = new PrismaPaymentDowntimeRepository(prisma);
        const paymentFailureCorrelationRepository = new PrismaPaymentFailureCorrelationRepository(prisma);

        const { RecoveryCaseCorrelationService } = await import('../../domain/recovery/recovery-case-correlation.service.js');
        const recoveryCaseCorrelationService = new RecoveryCaseCorrelationService(recoveryCaseRepository, paymentRepository);
        const correlationEngine = new CorrelationEngine(paymentDowntimeRepository, paymentFailureCorrelationRepository, cacheService);
        const agentRepository = new PrismaAgentRepository(prisma);
        const agentTriggerService = new AgentTriggerService(agentRepository, connectorManager, cacheService);
        const agentExecutionRepository = new PrismaAgentExecutionRepository(prisma);
        const agentExecutionService = new AgentExecutionService(agentExecutionRepository, agentExecutionQueueService);

        const entity = body?.payload?.payment?.entity;
        if (!entity) {
            console.warn(`[PaymentWebhookHandler] Missing payment entity for event "${eventType}".`);
            return { status: "ignored" };
        }

        const createData = PaymentMapper.toCreateInput(entity);
        const updateData = PaymentMapper.toUpdateInput(entity);

        const payment = await paymentRepository.upsert(
            { id: entity.id },
            { ...createData, userId, connectionId },
            { ...updateData, userId, connectionId }
        );

        console.log(`[PaymentWebhookHandler] Upserted payment ${payment.razorpayPaymentId} (status: ${payment.status}, event: ${eventType})`);

        if (eventType === 'payment.captured') {
            const { CheckoutIdentityResolver } = await import('../../domain/recovery/checkout-identity.resolver.js');
            const identity = CheckoutIdentityResolver.resolve(provider || 'RAZORPAY', body, {}, { connectionId });

            let targetCaseId = entity.notes?.recoveryCaseId;
            let shouldComplete = true;

            if (identity.confidence === 'DETERMINISTIC') {
                const checkoutCase = await recoveryCaseRepository.findShopifyAbandonmentCase(identity.storeId, identity.checkoutId);
                if (checkoutCase) {
                    targetCaseId = checkoutCase.id;
                    console.log(`[PaymentWebhookHandler] Payment ${payment.id} captured - deterministically associated with checkout case ${targetCaseId}`);
                }
            }

            if (targetCaseId) {
                const recoveryCase = await recoveryCaseRepository.findById(targetCaseId);
                if (recoveryCase && recoveryCase.paymentId) {
                    const originalPayment = await paymentRepository.findById(recoveryCase.paymentId);
                    if (originalPayment && originalPayment.userId && userId && originalPayment.userId !== userId) {
                        console.warn(`[PaymentWebhookHandler] Rejecting correlation: Case ${targetCaseId} belongs to user ${originalPayment.userId}, but captured payment came from user ${userId}`);
                        shouldComplete = false;
                    }
                }
            }

            if (shouldComplete && (targetCaseId || identity.confidence === 'DETERMINISTIC')) {
                const { recoveryEventPublisher } = await import('../../../config/redis.config.js');
                const recoveryCompletionService = new RecoveryCompletionService(recoveryCaseRepository, cacheService, recoveryEventPublisher);

                const completeArgs = {
                    recoveryCaseId: targetCaseId || undefined,
                    subjectType: targetCaseId ? 'PAYMENT' : 'CHECKOUT',
                    subjectId: targetCaseId ? payment.id : identity.checkoutId,
                    verifiedOutcome: {
                        amountRecovered: payment.amount,
                        notes: `Recovered via ${entity.id} (event: payment.captured)`
                    },
                    sourceEvent: eventType,
                    sourceEventId: externalEventId || entity.id,
                    userId
                };

                const { postCommitOrchestration } = await recoveryCompletionService.complete(completeArgs);

                if (postCommitHooks && postCommitOrchestration) {
                    postCommitHooks.push(postCommitOrchestration);
                }
            }
        }

        if (userId) {
            if (eventType === 'payment.failed') {
                await correlationEngine.correlatePaymentFailure(payment);

                const stabilizationQueue = new PaymentStabilizationQueue();
                const { recoveryEventPublisher } = await import('../../../config/redis.config.js');
                const paymentRecoveryService = new PaymentRecoveryService(recoveryCaseRepository, cacheService, stabilizationQueue, recoveryEventPublisher);

                return paymentRecoveryService.handlePaymentFailed(payment, webhook);
            }

            const triggeredAgents = await agentTriggerService.evaluateTriggers(userId, eventType, body);
            for (const agent of triggeredAgents) {
                try {
                    const execution = await agentExecutionService.createExecution({
                        agent,
                        userId,
                        triggerType: eventType,
                        triggerId: eventId || null,
                        externalTriggerId: externalEventId || null,
                        eventType,
                        provider,
                        inputContext: {
                            paymentId: payment.id,
                            body
                        }
                    });

                    if (postCommitHooks) {
                        postCommitHooks.push(async () => {
                            const globalRepo = new PrismaAgentExecutionRepository(globalPrisma);
                            const globalService = new AgentExecutionService(globalRepo, agentExecutionQueueService);
                            await globalService.enqueueExecution(execution);
                        });
                    } else {
                        await agentExecutionService.enqueueExecution(execution);
                    }
                } catch (err) {
                    console.error(`[PaymentWebhookHandler] Failed to create/enqueue execution for Agent ${agent.id}:`, err);
                }
            }
        }

        return { status: "processed", paymentId: payment.id };
    }
}