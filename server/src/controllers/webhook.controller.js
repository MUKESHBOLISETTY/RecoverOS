import Razorpay from 'razorpay';

export class WebhookController {
    /**
     * @param {import('../infrastructure/idempotency/redis-idempotency.store.js').RedisIdempotencyStore} idempotencyStore 
     * @param {import('../services/queue/webhook-event.queue.js').WebhookEventQueue} webhookQueue 
     * @param {import('../domain/connectors/connector.manager.js').default} connectorManager
     */
    constructor(idempotencyStore, webhookQueue, connectorManager) {
        this.idempotencyStore = idempotencyStore;
        this.webhookQueue = webhookQueue;
        this.connectorManager = connectorManager;
    }

    ingestEvent = async (req, res, next) => {
        try {
            const connectionId = req.params.connectionId;
            let source, idempotencyKey, eventType, eventCategory;

            if (req.headers['x-razorpay-event-id']) {
                source = 'RAZORPAY';
                idempotencyKey = req.headers['x-razorpay-event-id'];
                eventType = req.body?.event || 'unknown';
                const parts = eventType.split('.');
                if (parts.length > 1) {
                    parts.pop();
                    eventCategory = parts.join('_');
                } else {
                    eventCategory = eventType;
                }
            } else if (req.body && req.body.id && req.body.object === 'event') {
                source = req.body.source || 'unknown';
                idempotencyKey = req.body.id;
                eventType = req.body.type || 'unknown';
                eventCategory = eventType.split('.')[0] || 'unknown';
            } else {
                return res.status(400).json({ success: false, message: 'Unrecognized webhook format' });
            }

            if (source === 'RAZORPAY') {
                const razorpaySignature = req.headers['x-razorpay-signature'];
                if (!razorpaySignature) {
                    return res.status(400).json({ success: false, message: 'Missing Razorpay signature' });
                }
                if (!this.connectorManager) {
                    return res.status(500).json({ success: false, message: 'Connector manager not initialized' });
                }
                const credentials = await this.connectorManager.getDecryptedCredentialsById(connectionId);
                if (!credentials || !credentials.keySecret) {
                    return res.status(500).json({ success: false, message: 'Razorpay credentials not found' });
                }

                try {
                    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
                    Razorpay.validateWebhookSignature(rawBody, razorpaySignature, credentials.keySecret);
                } catch (err) {
                    console.error('[WebhookController] Razorpay signature validation failed:', err.message);
                    return res.status(400).json({ success: false, message: 'Invalid Razorpay signature' });
                }
            }

            const LOCK_TTL_SECONDS = 24 * 60 * 60;
            const lockAcquired = await this.idempotencyStore.acquireLock(`${source}:${idempotencyKey}`, LOCK_TTL_SECONDS);

            if (!lockAcquired) {
                console.log(`[WebhookController] Duplicate event detected for ${source}:${idempotencyKey}. Acknowledging.`);
                return res.status(200).send('OK');
            }

            await this.webhookQueue.addEvent(connectionId, source, idempotencyKey, eventType, eventCategory, req.body);

            console.log(`[WebhookController] Queued new event ${source}:${idempotencyKey} for connection ${connectionId}. Acknowledging.`);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('[WebhookController] Error ingesting webhook:', error);
            return next(error);
        }
    };
}