import ToolExecutor from '../../../domain/agent/tools/tool-executor.interface.js';
import { ToolExecutionError } from '../../../domain/agent/errors/tool-execution.error.js';
import { google } from 'googleapis';

class GmailEmailExecutor extends ToolExecutor {
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
     * @param {string} params.parameters.toEmail
     * @param {string} params.parameters.subject
     * @param {string} params.parameters.body
     * @param {Object} params.activeConnection
     * @param {Object} params.recoveryContext
     * @param {string} params.executionId
     * @returns {Promise<Object>}
     */
    async execute({ parameters, activeConnection, recoveryContext, executionId }) {
        const { toEmail, subject, body } = parameters;

        if (!activeConnection || !activeConnection.connectorId) {
            throw new Error('[GmailEmailExecutor] No active connection connectorId provided.');
        }

        const credentials = await this.connectorManager.getDecryptedCredentialsById(activeConnection.connectorId);

        const fieldsPresent = credentials ? Object.keys(credentials).filter(k => ['clientId', 'clientSecret', 'refreshToken'].includes(k)) : [];
        console.log(`credentialFieldsPresent:\n${JSON.stringify(fieldsPresent, null, 2)}`);

        if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
            throw new ToolExecutionError({
                code: 'CONNECTOR_CREDENTIAL_INVALID',
                message: 'The connected Gmail credentials are invalid or unavailable.',
                retryable: false,
                recoverable: false,
                requiresConfiguration: true,
                requiresHumanReview: false
            });
        }

        const { clientId, clientSecret, refreshToken } = credentials;

        try {
            const oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret
            );

            oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${toEmail}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                body
            ];

            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const res = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });

            const result = {
                status: 'success',
                messageId: res.data.id,
                threadId: res.data.threadId
            };

            const caseId = recoveryContext?.recoveryCase?.id;
            if (caseId) {
                await this.recoveryActionRepository.create({
                    recoveryCaseId: caseId,
                    type: 'EMAIL',
                    status: 'COMPLETED',
                    payload: result,
                    idempotencyKey: `email:${caseId}:${executionId}`
                });
            }

            return result;

        } catch (error) {
            console.error('[GmailEmailExecutor] Failed to send email:', error);

            const isAuthError = error.code === 401 || error.message?.toLowerCase().includes('auth') || error.message?.toLowerCase().includes('credential');

            throw new ToolExecutionError({
                code: isAuthError ? 'CONNECTOR_CREDENTIAL_INVALID' : 'PROVIDER_API_ERROR',
                message: isAuthError ? 'Gmail authentication failed. Credentials may be revoked.' : 'Failed to send email due to a provider error.',
                retryable: !isAuthError,
                recoverable: false,
                requiresConfiguration: isAuthError,
                requiresHumanReview: false
            });
        }
    }
}

export default GmailEmailExecutor;
