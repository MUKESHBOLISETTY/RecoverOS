import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { RecoveryManager } from "../../domain/recovery/recovery-manager.js";
import { cacheService } from "../../../config/redis.config.js";

export class PaymentWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment");
    }

    async handle(webhook) {
        const { body, eventType, _tx: prisma } = webhook;

        const correlationEngine = new CorrelationEngine(prisma, cacheService);
        const recoveryManager = new RecoveryManager(prisma);

        const paymentData = body?.payload?.payment?.entity;
        if (!paymentData) {
            console.warn(`[PaymentWebhookHandler] Missing payment entity in payload for ${eventType}`);
            return { status: "ignored" };
        }

        const payment = await prisma.payment.upsert({
            where: { razorpayPaymentId: paymentData.id },
            update: {
                status: paymentData.status,
                // Optional: update other fields if they change
            },
            create: {
                razorpayPaymentId: paymentData.id,
                amount: BigInt(paymentData.amount),
                currency: paymentData.currency,
                status: paymentData.status,
                method: paymentData.method,
                orderId: paymentData.order_id,
                invoiceId: paymentData.invoice_id,
                bank: paymentData.bank,
                vpa: paymentData.vpa,
                email: paymentData.email,
                contact: paymentData.contact,
                errorCode: paymentData.error_code,
                errorDescription: paymentData.error_description,
                errorSource: paymentData.error_source,
                errorStep: paymentData.error_step,
                errorReason: paymentData.error_reason,
                acquirerData: paymentData.acquirer_data || {},
                notes: paymentData.notes || {},
                paymentCreatedAt: new Date(paymentData.created_at * 1000)
            }
        });

        if (eventType === 'payment.failed') {
            await correlationEngine.correlatePaymentFailure(payment);
        } else if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
            // await recoveryManager.handlePaymentCaptured(payment.razorpayPaymentId);
        }

        return { status: "processed", paymentId: payment.id };
    }
}