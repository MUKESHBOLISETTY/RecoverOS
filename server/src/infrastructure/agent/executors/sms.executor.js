import { ToolExecutorInterface } from '../../../domain/agent/tools/tool-executor.interface.js';

export class SmsExecutor extends ToolExecutorInterface {
    /**
     * @param {import('../../../domain/communication/simulated-sms.provider.js').default} smsProvider 
     * @param {import('../../../domain/connectors/connector.manager.js').default} connectorManager 
     * @param {import('../../../domain/recovery/recovery-action.repository.js').default} recoveryActionRepository 
     */
    constructor(smsProvider, connectorManager, recoveryActionRepository) {
        super();
        if (!smsProvider) throw new Error('SmsExecutor: smsProvider is required');
        if (!connectorManager) throw new Error('SmsExecutor: connectorManager is required');
        if (!recoveryActionRepository) throw new Error('SmsExecutor: recoveryActionRepository is required');

        this.smsProvider = smsProvider;
        this.connectorManager = connectorManager;
        this.recoveryActionRepository = recoveryActionRepository;
    }

    /**
     * @param {Object} params 
     * @param {Object} params.parameters 
     * @param {Object} params.recoveryContext 
     * @param {string} params.executionId 
     * @param {Object} params.agentData 
     */
    async execute({ parameters, recoveryContext, executionId, activeConnection, reservedActionId, idempotencyKey }) {
        const recoveryCase = recoveryContext.recoveryCase;
        if (!recoveryCase) {
            throw new Error('SmsExecutor: Missing recoveryCase in context');
        }

        if (!parameters.to || !parameters.body) {
            throw new Error('SmsExecutor: Missing required parameters "to" or "body"');
        }

        if (!activeConnection) {
            throw new Error('SmsExecutor: No active connection provided');
        }

        const credentials = await this.connectorManager.getDecryptedCredentialsById(activeConnection.connectorId);
        if (!credentials) {
            throw new Error('SmsExecutor: Could not retrieve decrypted credentials');
        }

        const smsConfig = credentials.channels?.sms;
        if (!smsConfig) {
            throw new Error('SmsExecutor: Google Sheets connection does not have SMS configured');
        }

        const { spreadsheetId, worksheetName } = smsConfig;
        if (!spreadsheetId || !worksheetName) {
            throw new Error('SmsExecutor: Missing spreadsheet config in credentials.channels.sms');
        }

        const result = await this.smsProvider.sendSms(credentials, spreadsheetId, worksheetName, {
            to: parameters.to,
            body: parameters.body,
            executionId,
            recoveryCaseId: recoveryCase.id
        });

        if (!reservedActionId) {
            await this.recoveryActionRepository.create({
                recoveryCaseId: recoveryCase.id,
                type: 'SMS',
                status: result.status,
                payload: {
                    to: parameters.to,
                    body: parameters.body,
                    messageId: result.messageId,
                    channel: result.channel
                },
                idempotencyKey: idempotencyKey || `sms:${recoveryCase.id}:${executionId}`
            });
        }

        return result;
    }
}
