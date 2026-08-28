export class ToolExecutorInterface {
    /**
     * @param {Object} params
     * @param {Object} params.parameters
     * @param {Object} params.recoveryContext
     * @param {Object} params.activeConnection
     * @returns {Promise<Object>}
     */
    async execute({ parameters, recoveryContext, activeConnection }) {
        throw new Error('Not implemented');
    }
}

export default ToolExecutorInterface;
