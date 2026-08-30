import { google } from 'googleapis';
import crypto from 'crypto';

class GoogleSheetsSimulationSink {
    constructor() { }

    /**
     * @param {Object} credentials 
     * @param {string} spreadsheetId 
     * @param {string} worksheetName 
     * @param {Object} rowData 
     */
    async appendRow(credentials, spreadsheetId, worksheetName, rowData) {
        const oauth2Client = new google.auth.OAuth2(
            credentials.clientId,
            credentials.clientSecret
        );

        oauth2Client.setCredentials({
            refresh_token: credentials.refreshToken
        });

        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

        const res = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });

        const sheetExists = res.data.sheets.some(s => s.properties.title === worksheetName);

        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: worksheetName
                            }
                        }
                    }]
                }
            });

            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: `${worksheetName}!A1:G1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['timestamp', 'executionId', 'recoveryCaseId', 'recipient', 'message', 'status', 'simulationId']]
                }
            });
        }

        const values = [
            [
                rowData.timestamp,
                rowData.executionId,
                rowData.recoveryCaseId,
                rowData.recipient,
                rowData.message,
                rowData.status,
                rowData.simulationId
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${worksheetName}!A:G`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values
            }
        });

        return true;
    }
}

export default GoogleSheetsSimulationSink;
