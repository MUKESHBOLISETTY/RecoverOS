import { WebhookEventRepository } from '../../../domain/events/webhook-event.repository.js';

export class PrismaWebhookEventRepository extends WebhookEventRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     */
    constructor(prisma) {
        super();
        if (!prisma) throw new Error('PrismaWebhookEventRepository: prisma is required');
        this.prisma = prisma;
    }

    async findByIdempotencyKey(source, idempotencyKey, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.findUnique({
            where: { source_idempotencyKey: { source, idempotencyKey } }
        });
    }

    async create(data, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.create({ data });
    }

    async update(id, data, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.update({
            where: { id },
            data
        });
    }

    async markFailed(source, idempotencyKey, errorMessage, tx = null) {
        const client = tx || this.prisma;
        return client.webhookEvent.updateMany({
            where: { source, idempotencyKey },
            data: {
                status: 'FAILED',
                errorReason: errorMessage
            }
        });
    }

    async findLatestShopifyCheckoutUpdate(shopDomain, token, tx = null) {
        const client = tx || this.prisma;
        const results = await client.$queryRaw`
            SELECT * FROM "WebhookEvent"
            WHERE "source" = 'SHOPIFY'
              AND "eventType" = 'checkouts/update'
              AND payload->>'token' = ${token}
              AND payload->'_shopifyHeaders'->>'shopDomain' = ${shopDomain}
            ORDER BY "createdAt" DESC
            LIMIT 1
        `;
        return results.length > 0 ? results[0] : null;
    }

    async findShopifyOrderCreateByCheckoutToken(shopDomain, checkoutToken, tx = null) {
        const client = tx || this.prisma;
        const results = await client.$queryRaw`
            SELECT * FROM "WebhookEvent"
            WHERE "source" = 'SHOPIFY'
              AND "eventType" = 'orders/create'
              AND payload->>'checkout_token' = ${checkoutToken}
              AND payload->'_shopifyHeaders'->>'shopDomain' = ${shopDomain}
            ORDER BY "createdAt" DESC
            LIMIT 1
        `;
        return results.length > 0 ? results[0] : null;
    }
}

export default PrismaWebhookEventRepository;
