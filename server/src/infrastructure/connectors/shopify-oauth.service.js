import crypto from 'crypto';

class ShopifyOAuthService {
    /**
     * @param {Object} deps
     * @param {import('../../domain/connectors/connector.manager.js').default} deps.connectorManager
     * @param {import('../cache/base-cache.service.js').BaseCacheService} deps.cacheService
     */
    constructor({ connectorManager, cacheService }) {
        if (!connectorManager) throw new Error('ShopifyOAuthService: connectorManager is required');
        if (!cacheService) throw new Error('ShopifyOAuthService: cacheService is required');
        this.connectorManager = connectorManager;
        this.cacheService = cacheService;
    }

    normalizeShopDomain(shopDomain) {
        if (!shopDomain || typeof shopDomain !== 'string') {
            throw new Error('Invalid shop domain provided.');
        }
        let normalized = shopDomain.trim().toLowerCase();

        if (normalized.startsWith('http://')) normalized = normalized.substring(7);
        if (normalized.startsWith('https://')) normalized = normalized.substring(8);

        if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);

        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$/.test(normalized)) {
            throw new Error('Invalid shop domain format. Must be like store-name.myshopify.com');
        }
        return normalized;
    }

    /**
     * @param {string} userId
     * @param {string} clientId
     * @param {string} clientSecret
     * @param {string} redirectUri
     * @param {string} shopDomain
     * @returns {Promise<string>} Shopify Auth URL
     */
    async generateAuthUrl(userId, clientId, clientSecret, redirectUri, shopDomain) {
        if (!clientId || !clientSecret || !redirectUri || !shopDomain) {
            throw new Error('Missing required OAuth parameters');
        }

        const normalizedShop = this.normalizeShopDomain(shopDomain);
        const state = crypto.randomBytes(32).toString('hex');
        const stateKey = `oauth:shopify:state:${state}`;

        const saved = await this.cacheService.setJson(stateKey, {
            userId,
            clientId,
            clientSecret,
            redirectUri,
            shopDomain: normalizedShop
        }, 900); // 15 mins TTL

        if (!saved) {
            throw new Error('Failed to securely store OAuth state. Cache service is unavailable.');
        }

        const scopes = ['read_orders', 'read_customers', 'write_discounts'].join(',');

        const url = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
        url.searchParams.append('client_id', clientId);
        url.searchParams.append('scope', scopes);
        url.searchParams.append('redirect_uri', redirectUri);
        url.searchParams.append('state', state);

        return url.toString();
    }

    /**
     * @param {string} state
     * @param {string} code
     * @param {string} shop
     */
    async handleCallback(state, code, shop) {
        if (!state || !code || !shop) {
            throw new Error('Missing state, code, or shop in callback');
        }

        const stateKey = `oauth:shopify:state:${state}`;
        const tempData = await this.cacheService.getJson(stateKey);

        if (!tempData) {
            throw new Error('Invalid or expired OAuth state');
        }

        const { userId, clientId, clientSecret, redirectUri, shopDomain } = tempData;
        const normalizedCallbackShop = this.normalizeShopDomain(shop);

        if (normalizedCallbackShop !== shopDomain) {
            throw new Error('Callback shop domain does not match initiated state');
        }

        const exchangeUrl = `https://${shopDomain}/admin/oauth/access_token`;

        const response = await fetch(exchangeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Shopify Token Exchange Error:', errorData);
            throw new Error('Failed to exchange authorization code with Shopify');
        }

        const data = await response.json();
        const { access_token, scope, expires_in, refresh_token, refresh_token_expires_in } = data;

        if (!access_token) {
            throw new Error('Shopify did not return an access token');
        }

        const now = Date.now();
        const expiresAt = expires_in ? now + (expires_in * 1000) : undefined;
        const refreshTokenExpiresAt = refresh_token_expires_in ? now + (refresh_token_expires_in * 1000) : undefined;

        const rawCredentials = {
            shopDomain,
            accessToken: access_token,
            scope: scope,
            ...(refresh_token && { refreshToken: refresh_token }),
            ...(expiresAt && { expiresAt }),
            ...(refreshTokenExpiresAt && { refreshTokenExpiresAt })
        };

        const connectionName = `Shopify (${shopDomain})`;

        // Reconnect/Update logic
        const connections = await this.connectorManager.getUserConnections(userId);
        const existingConnection = connections.find(c => c.connectorId === 'shopify' && c.name === connectionName);

        let connection;
        if (existingConnection) {
            await this.connectorManager.updateConnection(existingConnection.id, rawCredentials);
            connection = { id: existingConnection.id, connectorId: 'shopify', name: connectionName, category: 'DATA_SOURCE' };
        } else {
            connection = await this.connectorManager.saveConnection(
                userId,
                'shopify',
                connectionName,
                rawCredentials
            );
        }

        await this.cacheService.del(stateKey);

        return {
            success: true,
            message: 'Shopify connected successfully.',
            connection,
            userId,
            isReconnect: !!existingConnection
        };
    }
}

export default ShopifyOAuthService;
