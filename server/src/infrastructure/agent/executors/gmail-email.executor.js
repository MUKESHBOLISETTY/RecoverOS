import ToolExecutor from '../../../domain/agent/tools/tool-executor.interface.js';
import { google } from 'googleapis';

class GmailEmailExecutor extends ToolExecutor {
    /**
     * @param {Object} params 
     * @param {Object} params.parameters
     * @param {string} params.parameters.toEmail
     * @param {string} params.parameters.subject
     * @param {string} params.parameters.body
     * @param {Object} params.activeConnection
     * @returns {Promise<Object>}
     */
    async execute({ parameters, activeConnection }) {
        const { toEmail, subject, body } = parameters;

        if (!activeConnection || !activeConnection.decryptedData) {
            console.warn('[GmailEmailExecutor] No active connection or decrypted credentials provided.');
            return {
                status: 'failed',
                error: 'No active connection credentials found for Gmail.'
            };
        }

        const { clientId, clientSecret, refreshToken } = activeConnection.decryptedData;

        if (!clientId || !clientSecret || !refreshToken) {
            return {
                status: 'failed',
                error: 'Invalid Gmail connection credentials.'
            };
        }

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

            return {
                status: 'success',
                messageId: res.data.id,
                threadId: res.data.threadId
            };

        } catch (error) {
            console.error('[GmailEmailExecutor] Failed to send email:', error);
            return {
                status: 'failed',
                error: error.message || 'Unknown error occurred while sending email'
            };
        }
    }
}

export default GmailEmailExecutor;
