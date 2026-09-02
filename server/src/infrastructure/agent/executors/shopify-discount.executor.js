import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';

export class ShopifyDiscountExecutor extends ToolExecutorInterface {
  constructor(webhookEventRepository, connectorManager) {
    super();
    this.webhookEventRepository = webhookEventRepository;
    this.connectorManager = connectorManager;
  }

  async execute({ parameters, recoveryContext, activeConnection, activeConnections, idempotencyKey }) {
    const candidates = activeConnections && activeConnections.length > 0 ? activeConnections : (activeConnection ? [activeConnection] : []);

    if (candidates.length === 0) {
      throw new Error('No active Shopify connection available');
    }

    const shopDomain = recoveryContext.recoveryCase?.contextSnapshot?.shopDomain;
    const checkoutToken = recoveryContext.recoveryCase?.subjectId;
    const caseId = recoveryContext.recoveryCase?.id;

    if (!shopDomain || !checkoutToken || !caseId) {
      throw new Error('Missing required recoveryContext parameters for ShopifyDiscountExecutor');
    }

    let accessToken = null;
    for (const conn of candidates) {
        const creds = await this.connectorManager.getDecryptedCredentialsById(conn.connectorId);
        if (creds && creds.shopDomain === shopDomain) {
            accessToken = creds.accessToken;
            break;
        }
    }

    if (!accessToken) {
        throw new Error(`No matching Shopify connection found for domain ${shopDomain}`);
    }

    const discountPercent = parameters.discountPercent;
    const validHours = parameters.validHours;

    if (typeof discountPercent !== 'number' || discountPercent <= 0 || discountPercent > 100) {
      throw new Error('Invalid discountPercent provided');
    }

    const latestWebhook = await this.webhookEventRepository.findLatestShopifyCheckoutUpdate(shopDomain, checkoutToken);
    if (!latestWebhook || !latestWebhook.payload) {
      throw new Error(`No webhook data found for checkoutToken ${checkoutToken}`);
    }

    const customerGid = latestWebhook.payload.customer?.admin_graphql_api_id
      || latestWebhook.payload.customer?.id ? `gid://shopify/Customer/${latestWebhook.payload.customer.id}` : null;

    if (!customerGid) {
      throw new Error('Customer ID not found in checkout payload, cannot target discount');
    }

    // Clamp expiration to max 72 hours
    const clampedHours = Math.min(validHours || 24, 72);
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + clampedHours * 3600000).toISOString();

    const code = `RRA-${caseId.split('-')[0].toUpperCase()}-${discountPercent}`;
    const title = code;

    const graphqlEndpoint = `https://${shopDomain}/admin/api/2026-07/graphql.json`;

    const mutation = `
            mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
              discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
                codeDiscountNode {
                  id
                  codeDiscount {
                    ... on DiscountCodeBasic {
                      title
                      startsAt
                      endsAt
                      appliesOncePerCustomer
                      usageLimit
                      codes(first: 1) {
                        nodes {
                          code
                        }
                      }
                      customerGets {
                        value {
                          ... on DiscountPercentage {
                            percentage
                          }
                        }
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
        `;

    const variables = {
      basicCodeDiscount: {
        title: title,
        code: code,
        startsAt: startsAt,
        endsAt: endsAt,
        usageLimit: 1,
        appliesOncePerCustomer: true,
        customerGets: {
          value: { percentage: discountPercent / 100 },
          items: { all: true }
        },
        context: {
          customers: {
            add: [customerGid]
          }
        }
      }
    };

    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401 || response.status === 403) {
        const e = new Error(`Shopify API unauthorized: ${response.status} ${errBody}`);
        e.isPermanent = true;
        throw e;
      }
      if (response.status === 429) {
        const e = new Error('Shopify API Rate Limit Exceeded');
        e.code = 'RATE_LIMIT';
        throw e;
      }
      throw new Error(`Shopify API Error: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(`Shopify GraphQL Error: ${JSON.stringify(data.errors)}`);
    }

    const userErrors = data.data?.discountCodeBasicCreate?.userErrors || [];
    const hasAlreadyExistsError = userErrors.some(e =>
      e.message.toLowerCase().includes('already been taken') ||
      e.message.toLowerCase().includes('already exists') ||
      e.message.toLowerCase().includes('must be unique')
    );

    if (hasAlreadyExistsError) {
      return await this._handleIdempotencyLookup(graphqlEndpoint, accessToken, code, caseId, discountPercent, endsAt);
    }

    if (userErrors.length > 0) {
      const err = new Error(`Shopify Discount Error: ${userErrors.map(e => e.message).join(', ')}`);
      err.isPermanent = true;
      throw err;
    }

    const node = data.data?.discountCodeBasicCreate?.codeDiscountNode;
    if (!node) {
      throw new Error('Failed to extract codeDiscountNode from response');
    }

    const actualCode = node.codeDiscount?.codes?.nodes?.[0]?.code || title;

    const metafieldMutation = `
            mutation setMetafield($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
        `;
    const mfVariables = {
      metafields: [{
        ownerId: node.id,
        namespace: "recoveros",
        key: "recovery_case_id",
        type: "single_line_text_field",
        value: caseId
      }]
    };

    const mfResponse = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query: metafieldMutation, variables: mfVariables })
    });

    if (!mfResponse.ok) {
      throw new Error(`Shopify Metafield API Error: ${mfResponse.status}`);
    }

    const mfData = await mfResponse.json();
    const mfUserErrors = mfData.data?.metafieldsSet?.userErrors || [];
    if (mfUserErrors.length > 0) {
      throw new Error(`Shopify Metafield Error: ${mfUserErrors.map(e => e.message).join(', ')}`);
    }

    return {
      success: true,
      discountId: node.id,
      discountCode: actualCode,
      discountPercent: discountPercent,
      expiresAt: endsAt
    };
  }

  async _handleIdempotencyLookup(graphqlEndpoint, accessToken, code, caseId, expectedPercent, expectedEndsAt) {
    const query = `
            query getDiscount($code: String!) {
              codeDiscountNodeByCode(code: $code) {
                id
                codeDiscount {
                  ... on DiscountCodeBasic {
                    title
                    endsAt
                    usageLimit
                    appliesOncePerCustomer
                    codes(first: 1) {
                      nodes {
                        code
                      }
                    }
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                      }
                    }
                  }
                }
                metafield(namespace: "recoveros", key: "recovery_case_id") {
                  value
                }
              }
            }
        `;

    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables: { code } })
    });

    if (!response.ok) {
      throw new Error(`Failed to lookup duplicate code. Status: ${response.status}`);
    }

    const data = await response.json();
    const node = data.data?.codeDiscountNodeByCode;

    if (!node || !node.codeDiscount) {
      const e = new Error('Ownership verification failed: Discount code already exists but cannot be retrieved.');
      e.isPermanent = true;
      throw e;
    }

    const discount = node.codeDiscount;

    const ownershipMetafield = node.metafield?.value;
    if (ownershipMetafield !== caseId) {
      const e = new Error('Ownership verification failed: Metafield missing or mismatch.');
      e.isPermanent = true;
      throw e;
    }

    const actualPercent = discount.customerGets?.value?.percentage * 100;
    if (Math.abs(actualPercent - expectedPercent) > 0.01) {
      const e = new Error(`Ownership verification failed: Percent mismatch (${actualPercent} vs ${expectedPercent}).`);
      e.isPermanent = true;
      throw e;
    }

    const actualCode = discount.codes?.nodes?.[0]?.code || code;

    return {
      success: true,
      discountId: node.id,
      discountCode: actualCode,
      discountPercent: expectedPercent,
      expiresAt: discount.endsAt || expectedEndsAt
    };
  }
}

export default ShopifyDiscountExecutor;
