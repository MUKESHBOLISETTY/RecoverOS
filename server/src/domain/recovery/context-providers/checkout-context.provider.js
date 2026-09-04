import { SubjectContextProviderInterface } from './subject-context-provider.interface.js';

export class CheckoutContextProvider extends SubjectContextProviderInterface {
    /**
     * @param {import('../../../infrastructure/db/webhook/prisma-webhook-event.repository.js').PrismaWebhookEventRepository} webhookEventRepository
     * @param {import('../recovery-history.builder.js').RecoveryHistoryBuilder} recoveryHistoryBuilder
     */
    constructor(webhookEventRepository, recoveryHistoryBuilder) {
        super();
        this.webhookEventRepository = webhookEventRepository;
        this.recoveryHistoryBuilder = recoveryHistoryBuilder;
    }

    async buildContext(params) {
        const { subjectId, execution, recoveryCase, availableCapabilities } = params;
        const shopDomain = recoveryCase.contextSnapshot?.shopDomain;
        const checkoutToken = subjectId;

        if (!shopDomain) {
            throw new Error(`[CheckoutContextProvider] Missing shopDomain in recoveryCase ${recoveryCase.id}`);
        }

        const latestWebhook = await this.webhookEventRepository.findLatestShopifyCheckoutUpdate(shopDomain, checkoutToken);
        if (!latestWebhook) {
            throw new Error(`[CheckoutContextProvider] No checkouts/update webhook found for ${checkoutToken} on ${shopDomain}`);
        }

        const payload = latestWebhook.payload;
        const recoveryHistory = await this.recoveryHistoryBuilder.buildHistory(recoveryCase.id);

        const email = payload.email || payload.customer?.email || null;
        const phone = payload.phone || payload.customer?.phone || null;
        const firstName = payload.customer?.first_name || null;

        const lineItems = Array.isArray(payload.line_items) ? payload.line_items.map(item => ({
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku
        })) : [];

        let agentPolicy = null;

        return {
            event: {
                id: execution.triggerId || execution.id,
                type: 'checkout.abandonment.derived',
                detection: 'INACTIVITY_AFTER_CHECKOUT_UPDATE',
                occurredAt: execution.queuedAt?.toISOString() || new Date().toISOString()
            },
            store: {
                domain: shopDomain
            },
            checkout: {
                url: payload.abandoned_checkout_url,
                value: payload.total_price,
                currency: payload.currency || payload.presentment_currency,
                itemCount: lineItems.reduce((acc, curr) => acc + curr.quantity, 0),
                lineItems
            },
            customer: {
                firstName,
                email,
                phone
            },
            recoveryCase: {
                id: recoveryCase.id,
                status: recoveryCase.status,
                subjectType: recoveryCase.subjectType || 'UNKNOWN',
                subjectId: recoveryCase.subjectId || checkoutToken,
                contextSnapshot: recoveryCase.contextSnapshot || {},
                strategyApplied: recoveryCase.strategyApplied || null,
                activeSkillId: recoveryCase.activeSkillId || null,
                activeSkillVersion: recoveryCase.activeSkillVersion || null,
                previousDiscountPercent: recoveryCase.previousDiscountPercent ?? null
            },
            recoveryHistory,
            customerHistory: {},
            agentPolicy,
            availableCapabilities: availableCapabilities || []
        };
    }
}

export default CheckoutContextProvider;
