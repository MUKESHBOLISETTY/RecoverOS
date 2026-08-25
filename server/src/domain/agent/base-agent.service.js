export class BaseAgentService {
    /**
     * @param {string} input
     * @param {Object} [options]
     * @returns {Promise<{ output: string, securityBlocked: boolean, traceId: string, redactedPiiTypes: string[], executionSummary: Object }>}
     */
    async processMessage(input, options = {}) {
        throw new Error('Method processMessage() must be implemented.');
    }
}

export default BaseAgentService;
