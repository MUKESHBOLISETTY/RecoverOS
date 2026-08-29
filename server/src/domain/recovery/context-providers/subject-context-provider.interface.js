export class SubjectContextProviderInterface {
    /**
     * @param {Object} params
     * @param {string} params.subjectId
     * @param {Object} params.execution
     * @param {Object} params.recoveryCase
     * @param {Object} params.agentConfig
     * @param {Array<string>} params.availableCapabilities
     * @param {Object} params.credentials
     * @returns {Promise<Object>} The resolved context
     */
    async buildContext(params) {
        throw new Error('Method not implemented.');
    }
}
