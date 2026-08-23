export class WebhookController {
    /**
     * @param {import('../infrastructure/idempotency/redis-idempotency.store.js').RedisIdempotencyStore} idempotencyStore 
     * @param {import('../services/queue/webhook-event.queue.js').WebhookEventQueue} webhookQueue 
     */
    constructor(idempotencyStore, webhookQueue) {
        this.idempotencyStore = idempotencyStore;
        this.webhookQueue = webhookQueue;
    }

    ingestEvent = async (req, res, next) => {
        try {
            let source, idempotencyKey, eventType, eventCategory;
            console.log(req.body)
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

            const LOCK_TTL_SECONDS = 24 * 60 * 60;
            const lockAcquired = await this.idempotencyStore.acquireLock(`${source}:${idempotencyKey}`, LOCK_TTL_SECONDS);

            if (!lockAcquired) {
                console.log(`[WebhookController] Duplicate event detected for ${source}:${idempotencyKey}. Acknowledging.`);
                return res.status(200).send('OK');
            }

            await this.webhookQueue.addEvent(source, idempotencyKey, eventType, eventCategory, req.body);

            console.log(`[WebhookController] Queued new event ${source}:${idempotencyKey}. Acknowledging.`);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('[WebhookController] Error ingesting webhook:', error);
            return next(error);
        }
    };
}