import { BaseWebhookHandler } from './base-webhook.handler.js';
import { MoneyParser } from '../../domain/payment/money-parser.js';

export class ShopifyOrderWebhookHandler extends BaseWebhookHandler {
    /**
     * @param {import('../../domain/recovery/recovery-case.repository.js').RecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../domain/recovery/recovery-completion.service.js').RecoveryCompletionService} recoveryCompletionService
     */
    constructor(recoveryCaseRepository, recoveryCompletionService) {
        super('orders');
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.recoveryCompletionService = recoveryCompletionService;
    }

    async handle({ body, eventType, eventId, provider, _tx, postCommitHooks }) {
        if (provider !== 'SHOPIFY') {
            throw new Error(`ShopifyOrderWebhookHandler received event from unknown provider: ${provider}`);
        }

        if (eventType !== 'orders/create') {
            console.log(`[ShopifyOrderWebhookHandler] Ignoring unhandled eventType: ${eventType}`);
            return;
        }

        const checkoutToken = body.checkout_token;
        if (!checkoutToken) {
            console.log(`[ShopifyOrderWebhookHandler] Missing checkout_token in payload for event ${eventId}. Ignoring safely.`);
            return;
        }

        const shopDomain = body._shopifyHeaders?.shopDomain;
        if (!shopDomain) {
            console.log(`[ShopifyOrderWebhookHandler] Missing shopDomain in _shopifyHeaders for event ${eventId}. Ignoring safely.`);
            return;
        }

        console.log(`[ShopifyOrderWebhookHandler] Received orders/create for shop: ${shopDomain}, checkoutToken: ${checkoutToken}`);

        postCommitHooks.push(async () => {
            const existingCase = await this.recoveryCaseRepository.findShopifyAbandonmentCase(shopDomain, checkoutToken);

            if (!existingCase) {
                console.log(`[ShopifyOrderWebhookHandler] No active CART_ABANDONMENT case found for store ${shopDomain} and token ${checkoutToken}. No transition required.`);
                return;
            }

            if (existingCase.status === 'RECOVERED') {
                console.log(`[ShopifyOrderWebhookHandler] RecoveryCase ${existingCase.id} is already RECOVERED. Idempotent action.`);
                return;
            }

            console.log(`[ShopifyOrderWebhookHandler] Found active RecoveryCase ${existingCase.id} (status: ${existingCase.status}). Transitioning to RECOVERED.`);

            const { postCommitOrchestration } = await this.recoveryCompletionService.complete({
                recoveryCaseId: existingCase.id,
                verifiedOutcome: {
                    amountRecovered: MoneyParser.parseDecimalToMinorUnits(body.total_price),
                    notes: `Recovered via Shopify order ${body.id || 'unknown'}`
                },
                sourceEvent: 'SHOPIFY_ORDER_CREATED',
                sourceEventId: eventId
            });

            if (postCommitOrchestration) {
                await postCommitOrchestration();
            }
        });
    }
}
