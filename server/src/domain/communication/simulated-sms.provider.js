import crypto from 'crypto';

class SimulatedSmsProvider {
    /**
     * @param {import('../../infrastructure/google/google-sheets-simulation.sink.js').default} simulationSink 
     */
    constructor(simulationSink) {
        this.simulationSink = simulationSink;
    }

    /**
     * @param {Object} credentials 
     * @param {string} spreadsheetId 
     * @param {string} worksheetName 
     * @param {Object} params 
     * @param {string} params.to 
     * @param {string} params.body 
     * @param {string} params.executionId 
     * @param {string} params.recoveryCaseId 
     */
    async sendSms(credentials, spreadsheetId, worksheetName, params) {
        const simulationId = `sim_sms_${crypto.randomUUID()}`;
        const timestamp = new Date().toISOString();

        const rowData = {
            timestamp,
            executionId: params.executionId || 'unknown',
            recoveryCaseId: params.recoveryCaseId || 'unknown',
            recipient: params.to,
            message: params.body,
            status: 'SIMULATED',
            simulationId
        };

        await this.simulationSink.appendRow(credentials, spreadsheetId, worksheetName, rowData);

        return {
            status: 'SIMULATED',
            channel: 'SMS',
            messageId: simulationId
        };
    }
}

export default SimulatedSmsProvider;
