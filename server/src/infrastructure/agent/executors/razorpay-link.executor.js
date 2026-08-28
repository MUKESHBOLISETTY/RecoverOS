import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';
import Razorpay from 'razorpay';

export class RazorpayLinkExecutor extends ToolExecutorInterface {
    /**
     * @param {Object} params
     * @param {Object} params.parameters
     * @param {Object} params.recoveryContext
     * @param {Object} params.activeConnection
     */
    async execute({ parameters, recoveryContext, activeConnection }) {
        if (!activeConnection || !activeConnection.decryptedData) {
            console.warn('[RazorpayLinkExecutor] No active connection or decrypted credentials provided.');
        }

        const { key_id, key_secret } = activeConnection.decryptedData;

        if (!key_id || !key_secret) {
            throw new Error('Razorpay credentials missing key_id or key_secret');
        }

        const razorpay = new Razorpay({
            key_id,
            key_secret
        });

        let amount = parameters.amount;
        if (!amount && recoveryContext && recoveryContext.paymentSnapshot) {
            amount = recoveryContext.paymentSnapshot.amount;
        }

        if (!amount) {
            throw new Error('Amount is required to create a payment link');
        }

        if (parameters.discountPercent) {
            const discountMultiplier = (100 - parameters.discountPercent) / 100;
            amount = Math.floor(amount * discountMultiplier);
        }

        const payload = {
            amount: amount,
            currency: parameters.currency || 'INR',
            accept_partial: false,
            description: parameters.description || '',
            customer: {
                name: parameters.customerName || '',
                email: parameters.customerEmail || '',
                contact: parameters.customerContact || ''
            },
            notify: {
                sms: true,
                email: true
            },
            reminder_enable: true,
            notes: {
                recoveryContext: recoveryContext.diagnosisCode || 'UNKNOWN',
                discountApplied: parameters.discountPercent ? `${parameters.discountPercent}%` : '0%'
            }
        };

        try {
            console.log('[RazorpayLinkExecutor] Calling Razorpay SDK with payload:', JSON.stringify(payload));
            const paymentLink = await razorpay.paymentLink.create(payload);

            return {
                id: paymentLink.id,
                short_url: paymentLink.short_url,
                status: paymentLink.status,
                amount: paymentLink.amount
            };
        } catch (error) {
            console.error('[RazorpayLinkExecutor] Failed to create payment link:', error);
            throw error;
        }
    }
}

export default RazorpayLinkExecutor;
