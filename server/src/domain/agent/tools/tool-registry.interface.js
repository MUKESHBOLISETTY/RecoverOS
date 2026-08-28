/**
 * @typedef {import('./tool-definition.js').default} ToolDefinition
 */

export class ToolRegistryInterface {
    /**
     * @param {string} toolName
     * @returns {Promise<ToolDefinition|null>}
     */
    async getTool(toolName) {
        throw new Error('Method not implemented.');
    }

    /**
     * @param {string} category
     * @returns {Promise<ToolDefinition[]>}
     */
    async getToolsByCategory(category) {
        throw new Error('Method not implemented.');
    }

    /**
     * @returns {Promise<ToolDefinition[]>}
     */
    async getAllTools() {
        throw new Error('Method not implemented.');
    }
}

export default ToolRegistryInterface;
