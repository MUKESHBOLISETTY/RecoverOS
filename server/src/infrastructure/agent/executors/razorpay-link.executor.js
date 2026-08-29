import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';
import { ToolExecutionError } from '../../../domain/agent/errors/tool-execution.error.js';
import Razorpay from 'razorpay';
import { MoneyFormatter } from '../../../domain/payment/money-formatter.js';

export class RazorpayLinkExecutor extends ToolExecutorInterface {
    /**
     * @param {import('../../connectors/connector.manager.js').ConnectorManager} connectorManager
     * @param {import('../../db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     */
    constructor(connectorManager, recoveryActionRepository) {
        super();
        this.connectorManager = connectorManager;
        this.recoveryActionRepository = recoveryActionRepository;
    }

    /**
     * @param {Object} params
     * @param {Object} params.parameters
     * @param {Object} params.recoveryContext
     * @param {Object} params.activeConnection
     * @param {string} params.executionId
     */
    async execute({ parameters, recoveryContext, activeConnection, executionId }) {
        if (!activeConnection || !activeConnection.connectorId) {
            throw new Error('[RazorpayLinkExecutor] No active connection connectorId provided.');
        }

        const caseId = recoveryContext?.recoveryCase?.id;
        if (!caseId) {
            throw new Error('RazorpayLinkExecutor: recoveryCase.id is missing.');
        }

        const idempotencyKey = `payment_link_create:${caseId}:${executionId}`;
        const existingAction = await this.recoveryActionRepository.findByIdempotencyKey(idempotencyKey);

        if (existingAction) {
            console.log('[RazorpayLinkExecutor] Action already completed. Returning existing link.');
            return existingAction.payload;
        }

        console.log(`[CredentialResolver] Resolving credentials for connectorId: ${activeConnection.connectorId}, provider: razorpay`);
        const credentials = await this.connectorManager.getDecryptedCredentialsById(activeConnection.connectorId);

        const keyId = credentials?.keyId || credentials?.key_id;
        const keySecret = credentials?.keySecret || credentials?.key_secret;

        console.log(`[CredentialResolver] credentialResolved: ${!!credentials}, credentialFieldsPresent: ["${keyId ? 'keyId' : ''}", "${keySecret ? 'keySecret' : ''}"]`);

        if (!keyId || !keySecret) {
            throw new ToolExecutionError({
                code: 'CONNECTOR_CREDENTIAL_INVALID',
                message: 'The connected Razorpay credentials are invalid or incomplete.',
                retryable: false,
                recoverable: false,
                requiresConfiguration: true
            });
        }

        const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
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

        const notes = {
            recoveryContext: recoveryContext.diagnosisCode || 'UNKNOWN',
            discountApplied: parameters.discountPercent ? `${parameters.discountPercent}%` : '0%',
            recoveryCaseId: caseId,
            subjectType: recoveryContext.recoveryCase?.subjectType || 'UNKNOWN',
            subjectId: recoveryContext.recoveryCase?.subjectId || 'UNKNOWN'
        };

        if (recoveryContext.paymentSnapshot?.notes) {
            const originalNotes = recoveryContext.paymentSnapshot.notes;
            if (originalNotes.gid) notes.gid = originalNotes.gid;
            if (originalNotes.shopify_order_id) notes.shopify_order_id = originalNotes.shopify_order_id;
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
            notes: notes
        };

        try {
            console.log('[RazorpayLinkExecutor] Calling Razorpay SDK with payload:', JSON.stringify(payload));
            const paymentLink = await razorpay.paymentLink.create(payload);

            const result = {
                id: paymentLink.id,
                short_url: paymentLink.short_url,
                status: paymentLink.status,
                amount: paymentLink.amount,
                displayAmount: MoneyFormatter.format(paymentLink.amount, payload.currency)
            };

            await this.recoveryActionRepository.create({
                recoveryCaseId: caseId,
                type: 'IN_APP',
                status: 'COMPLETED',
                payload: result,
                idempotencyKey
            });

            return result;
        } catch (error) {
            console.error('[RazorpayLinkExecutor] Failed to create payment link:', error);
            throw error;
        }
    }
}

export default RazorpayLinkExecutor;
