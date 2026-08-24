import { BaseWebhookHandler } from "./base-webhook.handler.js";
import { CorrelationEngine } from "../../domain/correlation/correlation-engine.js";
import { RecoveryManager } from "../../domain/recovery/recovery-manager.js";
import { cacheService } from "../../../config/redis.config.js";

export class PaymentDowntimeWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment_downtime");
    }

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

        const downtimeData = body?.payload?.['payment.downtime']?.entity || body?.payload?.downtime?.entity;

        if (!downtimeData) {
            console.warn(`[PaymentDowntimeWebhookHandler] Missing downtime entity in payload for ${eventType}`);
            return { status: "ignored" };
        }

        const statusEnum = downtimeData.status ? downtimeData.status.toUpperCase() : 'STARTED';

        const downtime = await prisma.paymentDowntime.upsert({
            where: { razorpayId: downtimeData.id },
            update: {
                status: statusEnum,
                end: downtimeData.end ? new Date(downtimeData.end * 1000) : null,
                updatedAt: new Date(downtimeData.updated_at * 1000),
                rawPayload: downtimeData,
                userId,
                connectionId
            },
            create: {
                razorpayId: downtimeData.id,
                method: downtimeData.method,
                begin: new Date(downtimeData.begin * 1000),
                end: downtimeData.end ? new Date(downtimeData.end * 1000) : null,
                status: statusEnum,
                scheduled: downtimeData.scheduled || false,
                severity: downtimeData.severity,
                instrument: downtimeData.instrument || {},
                instrumentSchema: downtimeData.instrument_schema || [],
                createdAt: new Date(downtimeData.created_at * 1000),
                updatedAt: new Date(downtimeData.updated_at * 1000),
                rawPayload: downtimeData,
                userId,
                connectionId
            }
        });

        await correlationEngine.refreshDowntimesCache();

        if (eventType === 'payment.downtime.updated' || eventType === 'payment.downtime.resolved') {
            await correlationEngine.reevaluateCorrelationsForDowntime(downtime.id);
        }

        if (eventType === 'payment.downtime.resolved') {
            // await recoveryManager.processResolvedDowntime(downtime.id);
        }

        return { status: "processed", downtimeId: downtime.id };
    }
}