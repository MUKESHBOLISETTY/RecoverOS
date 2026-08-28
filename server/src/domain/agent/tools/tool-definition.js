export class ToolDefinition {
    /**
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.category
     * @param {string} data.action
     * @param {string} data.requiresCapability
     * @param {string} data.riskLevel
     * @param {boolean} data.readOnly
     * @param {Object} data.inputSchema
     * @param {Object} data.outputSchema
     * @param {string} data.provider
     */
    constructor(data) {
        this.name = data.name;
        this.category = data.category;
        this.action = data.action;
        this.requiresCapability = data.requiresCapability;
        this.riskLevel = data.riskLevel || 'LOW';
        this.readOnly = data.readOnly ?? true;
        this.inputSchema = data.inputSchema;
        this.outputSchema = data.outputSchema;
        this.provider = data.provider;
    }
}

export default ToolDefinition;
