import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';

export class WhatsAppMessageExecutor extends ToolExecutorInterface {
    /**
     * @param {Object} params
     * @param {Object} params.parameters
     * @param {Object} params.recoveryContext
     * @param {Object} params.activeConnection
     */
    async execute({ parameters, recoveryContext, activeConnection }) {
        if (!activeConnection || !activeConnection.decryptedData) {
            console.warn('[WhatsAppMessageExecutor] No active connection or decrypted credentials provided. Using mock mode.');
        }

        const { api_key, phone_number_id } = activeConnection.decryptedData;

        if (!api_key || !phone_number_id) {
            throw new Error('WhatsApp credentials missing api_key or phone_number_id');
        }

        console.log(`[WhatsAppMessageExecutor] Sending WhatsApp template to ${parameters.customerContact}`);

        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            message_id: `wamid.mock.${Date.now()}`,
            status: 'sent',
            recipient: parameters.customerContact
        };
    }
}

export default WhatsAppMessageExecutor;
