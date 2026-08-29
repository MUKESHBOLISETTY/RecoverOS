import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { PaymentMapper } from "../../domain/payment/payment-mapper.js";
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
        if (connectionId) {
            const connection = await connectorCredentialRepository.findById(connectionId);
            if (connection) userId = connection.userId;
        }

        const paymentDowntimeRepository = new PrismaPaymentDowntimeRepository(prisma);
        const paymentFailureCorrelationRepository = new PrismaPaymentFailureCorrelationRepository(prisma);
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

        if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
            await this._handlePaymentRecovered(recoveryCaseRepository, payment, entity, externalEventId);
        }

        if (userId) {
            if (eventType === 'payment.failed') {
                await correlationEngine.correlatePaymentFailure(payment);
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
                        inputContext: { paymentId: payment.id, body }
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

    /**
     * @param {import('../../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {Object} payment - internal Payment record
     * @param {Object} entity - Razorpay payment entity
     * @param {string} [externalEventId] - Razorpay event ID for idempotency key
     */
    async _handlePaymentRecovered(recoveryCaseRepository, payment, entity, externalEventId) {
        const openCases = await recoveryCaseRepository.closeCase(payment, entity, externalEventId);

        for (const recoveryCase of openCases) {
            try {
                await cacheService.del(`recovery_case_status:${recoveryCase.id}`);

                console.log(`[PaymentWebhookHandler] RecoveryCase ${recoveryCase.id} → RECOVERED for payment ${entity.id}`);
            } catch (err) {
                console.error(`[PaymentWebhookHandler] Failed to clear cache for case ${recoveryCase.id}:`, err.message);
            }
        }
    }
}