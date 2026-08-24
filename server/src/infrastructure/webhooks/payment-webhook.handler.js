import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { RecoveryManager } from "../../domain/recovery/recovery-manager.js";
import { PaymentMapper } from "../../domain/payment/payment-mapper.js";
import { cacheService } from "../../../config/redis.config.js";
import { AgentTriggerService } from "../../domain/agent/agent-trigger.service.js";
import { PrismaAgentRepository } from "../db/agent/prisma-agent.repository.js";
import { connectorManager } from "../../../config/connectors.config.js";

export class PaymentWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment");
    }

    /**
     * @param {{ body: object, eventType: string, _tx: import('@prisma/client').PrismaClient }} webhook
     */
    async handle(webhook) {
        const { connectionId, body, eventType, _tx: prisma } = webhook;

        let userId = null;
        if (connectionId) {
            const connection = await prisma.connectorCredential.findUnique({
                where: { id: connectionId },
                select: { userId: true }
            });
            if (connection) {
                userId = connection.userId;
            }
        }

        const correlationEngine = new CorrelationEngine(prisma, cacheService);
        const recoveryManager = new RecoveryManager(prisma);
        const agentRepository = new PrismaAgentRepository(prisma);
        const agentTriggerService = new AgentTriggerService(agentRepository, connectorManager, cacheService);

        const entity = body?.payload?.payment?.entity;
        if (!entity) {
            console.warn(`[PaymentWebhookHandler] Missing payment entity for event "${eventType}".`);
            return { status: "ignored" };
        }

        const createData = PaymentMapper.toCreateInput(entity);
        const updateData = PaymentMapper.toUpdateInput(entity);

        const payment = await prisma.payment.upsert({
            where: { razorpayPaymentId: entity.id },
            create: {
                ...createData,
                userId,
                connectionId
            },
            update: {
                ...updateData,
                userId,
                connectionId
            },
        });

        console.log(
            `[PaymentWebhookHandler] Upserted payment ${payment.razorpayPaymentId} ` +
            `(status: ${payment.status}, event: ${eventType})`
        );

        if (eventType === 'payment.failed') {
            await correlationEngine.correlatePaymentFailure(payment);

        } else if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
            // await recoveryManager.handlePaymentCaptured(payment.razorpayPaymentId);
        }
        // we will handle the ouput of agentTriggerService later
        if (userId) {
            await agentTriggerService.evaluateTriggers(userId, eventType, body);
        }

        return { status: "processed", paymentId: payment.id };
    }
}