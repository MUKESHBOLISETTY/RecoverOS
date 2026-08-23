import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { RecoveryManager } from "../../domain/recovery/recovery-manager.js";
import { PaymentMapper } from "../../domain/payment/payment-mapper.js";
import { cacheService } from "../../../config/redis.config.js";

export class PaymentWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment");
    }

    /**
     * @param {{ body: object, eventType: string, _tx: import('@prisma/client').PrismaClient }} webhook
     */
    async handle(webhook) {
        const { body, eventType, _tx: prisma } = webhook;

        const correlationEngine = new CorrelationEngine(prisma, cacheService);
        const recoveryManager = new RecoveryManager(prisma);

        const entity = body?.payload?.payment?.entity;
        if (!entity) {
            console.warn(`[PaymentWebhookHandler] Missing payment entity for event "${eventType}".`);
            return { status: "ignored" };
        }

        const createData = PaymentMapper.toCreateInput(entity);
        const updateData = PaymentMapper.toUpdateInput(entity);

        const payment = await prisma.payment.upsert({
            where: { razorpayPaymentId: entity.id },
            create: createData,
            update: updateData,
        });

        console.log(
            `[PaymentWebhookHandler] Upserted payment ${payment.razorpayPaymentId} ` +
            `(status: ${payment.status}, event: ${eventType})`
        );

        if (eventType === 'payment.failed') {
            await correlationEngine.correlatePaymentFailure(payment);

        } else if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
            await recoveryManager.handlePaymentCaptured(payment.razorpayPaymentId);
        }

        return { status: "processed", paymentId: payment.id };
    }
}