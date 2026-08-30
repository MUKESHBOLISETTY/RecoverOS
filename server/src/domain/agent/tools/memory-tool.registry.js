import { z } from 'zod';
import { ToolRegistryInterface } from './tool-registry.interface.js';
import ToolDefinition from './tool-definition.js';

export class MemoryToolRegistry extends ToolRegistryInterface {
    constructor() {
        super();
        /** @type {Map<string, ToolDefinition>} */
        this.tools = new Map();
        this._initializeDefaultTools();
    }

    _initializeDefaultTools() {
        const defaultTools = [
            new ToolDefinition({
                name: 'getPayment',
                category: 'payment.read',
                action: 'payment.read',
                requiresCapability: 'payment.read',
                riskLevel: 'LOW',
                readOnly: true,
                inputSchema: z.object({
                    paymentId: z.string().describe('The ID of the payment to retrieve')
                }),
                outputSchema: z.object({
                    id: z.string(),
                    amount: z.number(),
                    currency: z.string(),
                    status: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'getOrder',
                category: 'order.read',
                action: 'order.read',
                requiresCapability: 'order.read',
                riskLevel: 'LOW',
                readOnly: true,
                inputSchema: z.object({
                    orderId: z.string().describe('The ID of the order to retrieve')
                }),
                outputSchema: z.object({
                    id: z.string(),
                    amount: z.number(),
                    status: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'createRecoveryPaymentLink',
                category: 'payment.recovery',
                action: 'payment_link.create',
                requiresCapability: 'payment_link.create',
                riskLevel: 'MEDIUM',
                readOnly: false,
                inputSchema: z.object({
                    paymentId: z.string().describe('The ID of the failed payment'),
                    amount: z.number().describe('The amount to recover in minor units (e.g. for INR, 47900 means ₹479.00)'),
                    customerId: z.string().optional(),
                    notes: z.record(z.string()).optional()
                }),
                outputSchema: z.object({
                    linkId: z.string(),
                    shortUrl: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'sendWhatsApp',
                category: 'communication',
                action: 'communication.whatsapp',
                requiresCapability: 'communication.whatsapp',
                riskLevel: 'MEDIUM',
                readOnly: false,
                inputSchema: z.object({
                    customerPhone: z.string().describe('The phone number of the customer'),
                    messageTemplate: z.string().describe('The WhatsApp template name'),
                    parameters: z.record(z.string()).optional()
                }),
                outputSchema: z.object({
                    messageId: z.string(),
                    status: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'sendEmail',
                category: 'communication',
                action: 'communication.email',
                requiresCapability: 'email_send',
                riskLevel: 'LOW',
                readOnly: false,
                inputSchema: z.object({
                    toEmail: z.string().describe('The email address of the customer'),
                    subject: z.string().describe('The subject of the email'),
                    body: z.string().describe('The body content of the email'),
                }),
                outputSchema: z.object({
                    messageId: z.string(),
                    status: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'sendSms',
                category: 'communication',
                action: 'communication.sms',
                requiresCapability: 'communication.sms',
                riskLevel: 'LOW',
                readOnly: false,
                inputSchema: z.object({
                    to: z.string().describe('The phone number of the customer'),
                    body: z.string().describe('The text content of the SMS message')
                }),
                outputSchema: z.object({
                    messageId: z.string(),
                    status: z.string(),
                    channel: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'scheduleRecovery',
                category: 'system.internal',
                action: 'recovery.schedule',
                requiresCapability: 'system.internal',
                riskLevel: 'LOW',
                readOnly: false,
                inputSchema: z.object({
                    delayMinutes: z.number().describe('The number of minutes to wait before retrying/following up.'),
                    reason: z.string().describe('The reason for scheduling.')
                }),
                outputSchema: z.object({
                    status: z.string(),
                    scheduledAt: z.string()
                }).passthrough()
            }),
            new ToolDefinition({
                name: 'escalateRecovery',
                category: 'system.internal',
                action: 'recovery.escalate',
                requiresCapability: 'system.internal',
                riskLevel: 'LOW',
                readOnly: false,
                inputSchema: z.object({
                    reason: z.string().describe('The reason for escalation.'),
                }),
                outputSchema: z.object({
                    status: z.string()
                }).passthrough()
            })
        ];

        for (const tool of defaultTools) {
            this.tools.set(tool.name, tool);
        }
    }

    /**
     * @param {string} toolName
     * @returns {Promise<ToolDefinition|null>}
     */
    async getTool(toolName) {
        return this.tools.get(toolName) || null;
    }

    /**
     * @param {string} category
     * @returns {Promise<ToolDefinition[]>}
     */
    async getToolsByCategory(category) {
        const results = [];
        for (const tool of this.tools.values()) {
            if (tool.category === category) {
                results.push(tool);
            }
        }
        return results;
    }

    /**
     * @returns {Promise<ToolDefinition[]>}
     */
    async getAllTools() {
        return Array.from(this.tools.values());
    }
}

export default MemoryToolRegistry;
