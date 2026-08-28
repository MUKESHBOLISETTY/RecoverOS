export class ResolvedTool {
    /**
     * @param {Object} data
     * @param {import('./tool-definition.js').default} data.definition
     * @param {string} data.connectorId
     * @param {string} data.provider
     */
    constructor(data) {
        this.definition = data.definition;
        this.connectorId = data.connectorId;
        this.provider = data.provider;
    }
}

export default ResolvedTool;
