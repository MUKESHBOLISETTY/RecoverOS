import crypto from 'crypto';

export class ShopifyWebhookController {
    /**
     * @param {import('../infrastructure/idempotency/redis-idempotency.store.js').RedisIdempotencyStore} idempotencyStore 
     * @param {import('../services/queue/webhook-event.queue.js').WebhookEventQueue} webhookQueue 
     * @param {import('../domain/connectors/connector.manager.js').default} connectorManager
     * @param {import('../domain/events/webhook-event.repository.js').WebhookEventRepository} webhookEventRepository
     */
    constructor(idempotencyStore, webhookQueue, connectorManager, webhookEventRepository) {
        this.idempotencyStore = idempotencyStore;
        this.webhookQueue = webhookQueue;
        this.connectorManager = connectorManager;
        this.webhookEventRepository = webhookEventRepository;
    }

    normalizeShopDomain(shopDomain) {
        if (!shopDomain || typeof shopDomain !== 'string') {
            return null;
        }
        let normalized = shopDomain.trim().toLowerCase();

        if (normalized.startsWith('http://')) normalized = normalized.substring(7);
        if (normalized.startsWith('https://')) normalized = normalized.substring(8);
        if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);

        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$/.test(normalized)) {
            return null;
        }
        return normalized;
    }

    ingestEvent = async (req, res, next) => {
        try {
            const hmacHeader = req.headers['x-shopify-hmac-sha256'];
            const shopDomainHeader = req.headers['x-shopify-shop-domain'];
            const topicHeader = req.headers['x-shopify-topic'];
            const webhookIdHeader = req.headers['x-shopify-webhook-id'];
            const eventIdHeader = req.headers['x-shopify-event-id'];

            if (!hmacHeader || !shopDomainHeader || !topicHeader || !webhookIdHeader) {
                return res.status(400).send('Missing required Shopify headers');
            }

            const secret = process.env.SHOPIFY_API_SECRET;
            if (!secret) {
                console.error('[ShopifyWebhook] SHOPIFY_API_SECRET is not configured');
                return res.status(500).send('Server configuration error');
            }

            const rawBody = req.body;
            if (!rawBody || !Buffer.isBuffer(rawBody)) {
                return res.status(400).send('Invalid raw body');
            }

            const generatedHash = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('base64');

            let hashEquals = false;
            try {
                hashEquals = crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader));
            } catch (e) {
                hashEquals = false;
            }

            if (!hashEquals) {
                console.error(`[ShopifyWebhook] HMAC validation failed for ${webhookIdHeader}`);
                return res.status(401).send('Unauthorized');
            }

            let parsedBody;
            try {
                parsedBody = JSON.parse(rawBody.toString('utf8'));
            } catch (e) {
                console.error(`[ShopifyWebhook] Failed to parse JSON body for ${webhookIdHeader}`);
                return res.status(400).send('Invalid JSON');
            }

            const normalizedShop = this.normalizeShopDomain(shopDomainHeader);
            if (!normalizedShop) {
                return res.status(400).send('Invalid shop domain');
            }

            const allShopifyCredentials = await this.connectorManager.getAllDecryptedCredentialsByConnectorId('shopify');
            const targetCredential = allShopifyCredentials.find(c => c.credentials && c.credentials.shopDomain === normalizedShop);

            if (!targetCredential) {
                console.warn(`[ShopifyWebhook] Received valid webhook for unknown shop: ${normalizedShop}`);
                return res.status(404).send('Shop not found');
            }

            const connectionId = targetCredential.id;
            const source = 'SHOPIFY';
            const idempotencyKey = webhookIdHeader;
            const eventCategory = topicHeader.split('/')[0] || 'unknown';

            const enrichedPayload = {
                ...parsedBody,
                _shopifyHeaders: {
                    webhookId: webhookIdHeader,
                    eventId: eventIdHeader,
                    topic: topicHeader,
                    shopDomain: shopDomainHeader
                }
            };

            const LOCK_TTL_SECONDS = 24 * 60 * 60;
            const lockAcquired = await this.idempotencyStore.acquireLock(`${source}:${idempotencyKey}`, LOCK_TTL_SECONDS);

            if (!lockAcquired) {
                console.log(`[ShopifyWebhook] Duplicate event detected (Redis) for ${source}:${idempotencyKey}. Acknowledging.`);
                return res.status(200).send('OK');
            }

            try {
                await this.webhookEventRepository.create({
                    source,
                    idempotencyKey,
                    eventType: topicHeader,
                    payload: enrichedPayload,
                    status: 'PENDING'
                });
            } catch (dbError) {
                if (dbError.code === 'P2002') {
                    console.log(`[ShopifyWebhook] Duplicate event detected (DB) for ${source}:${idempotencyKey}. Acknowledging.`);
                    return res.status(200).send('OK');
                }
                throw dbError;
            }

            await this.webhookQueue.addEvent(connectionId, source, idempotencyKey, topicHeader, eventCategory, enrichedPayload);

            console.log(`[ShopifyWebhook] Persisted and queued new event ${source}:${idempotencyKey} for shop ${normalizedShop}. Acknowledging.`);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('[ShopifyWebhook] Error ingesting webhook:', error);
            return res.status(500).send('Internal Server Error');
        }
    };
}
