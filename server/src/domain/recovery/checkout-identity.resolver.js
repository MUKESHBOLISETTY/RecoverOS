export const IDENTITY_TYPES = {
    CHECKOUT_TOKEN: 'CHECKOUT_TOKEN',
    CART_TOKEN: 'CART_TOKEN',
    ORDER_ID: 'ORDER_ID'
};

export const CONFIDENCE_LEVELS = {
    DETERMINISTIC: 'DETERMINISTIC',
    UNKNOWN: 'UNKNOWN'
};

export class CheckoutIdentityResolver {
    /**
     * @param {string} provider -'SHOPIFY', 'RAZORPAY'
     * @param {Object} eventBody
     * @param {Object} [headers] - HTTP headers
     * @param {Object} [context] - Execution context (e.g: trusted connectionId)
     * @returns {{ platform: string, storeId: string|null, checkoutId: string|null, identityType: string|null, confidence: string }}
     */
    static resolve(provider, eventBody, headers = {}, context = {}) {
        if (!provider || !eventBody) {
            return {
                platform: provider || 'UNKNOWN',
                storeId: null,
                checkoutId: null,
                identityType: null,
                confidence: CONFIDENCE_LEVELS.UNKNOWN
            };
        }

        const normalizedProvider = provider.toUpperCase();

        if (normalizedProvider === 'SHOPIFY') {
            return this._resolveShopify(eventBody, headers);
        } else if (normalizedProvider === 'RAZORPAY') {
            return this._resolveRazorpay(eventBody, context);
        }

        return {
            platform: normalizedProvider,
            storeId: null,
            checkoutId: null,
            identityType: null,
            confidence: CONFIDENCE_LEVELS.UNKNOWN
        };
    }

    /**
     * @private
     */
    static _resolveShopify(eventBody, headers) {
        const storeId = headers['x-shopify-shop-domain'] || eventBody._shopifyHeaders?.shopDomain || null;

        if (eventBody.checkout_token) {
            return {
                platform: 'SHOPIFY',
                storeId,
                checkoutId: eventBody.checkout_token,
                identityType: IDENTITY_TYPES.CHECKOUT_TOKEN,
                confidence: CONFIDENCE_LEVELS.DETERMINISTIC
            };
        }

        if (eventBody.cart_token) {
            return {
                platform: 'SHOPIFY',
                storeId,
                checkoutId: eventBody.cart_token,
                identityType: IDENTITY_TYPES.CART_TOKEN,
                confidence: CONFIDENCE_LEVELS.DETERMINISTIC
            };
        }

        if (eventBody.token) {
            return {
                platform: 'SHOPIFY',
                storeId,
                checkoutId: eventBody.token,
                identityType: IDENTITY_TYPES.CHECKOUT_TOKEN,
                confidence: CONFIDENCE_LEVELS.DETERMINISTIC
            };
        }

        return {
            platform: 'SHOPIFY',
            storeId,
            checkoutId: null,
            identityType: null,
            confidence: CONFIDENCE_LEVELS.UNKNOWN
        };
    }

    /**
     * @private
     */
    static _resolveRazorpay(eventBody, context) {
        const notes = eventBody?.payload?.payment?.entity?.notes || {};

        const storeId = context.connectionId || notes.domain || null;

        if (!storeId) {
            return {
                platform: 'RAZORPAY',
                storeId: null,
                checkoutId: null,
                identityType: null,
                confidence: CONFIDENCE_LEVELS.UNKNOWN
            };
        }

        if (notes.checkout_token) {
            return {
                platform: 'SHOPIFY',
                storeId,
                checkoutId: notes.checkout_token,
                identityType: IDENTITY_TYPES.CHECKOUT_TOKEN,
                confidence: CONFIDENCE_LEVELS.DETERMINISTIC
            };
        }

        if (notes.cart_token) {
            return {
                platform: 'SHOPIFY',
                storeId,
                checkoutId: notes.cart_token,
                identityType: IDENTITY_TYPES.CART_TOKEN,
                confidence: CONFIDENCE_LEVELS.DETERMINISTIC
            };
        }

        return {
            platform: 'RAZORPAY',
            storeId,
            checkoutId: null,
            identityType: null,
            confidence: CONFIDENCE_LEVELS.UNKNOWN
        };
    }
}
