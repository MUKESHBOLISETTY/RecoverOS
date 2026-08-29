export class ToolExecutionError extends Error {
    /**
     * @param {Object} options
     * @param {string} options.code
     * @param {string} options.message
     * @param {boolean} [options.retryable]
     * @param {boolean} [options.recoverable]
     * @param {boolean} [options.requiresConfiguration]
     */
    constructor({ code, message, retryable = false, recoverable = false, requiresConfiguration = false }) {
        super(message);
        this.name = 'ToolExecutionError';
        this.code = code;
        this.retryable = retryable;
        this.recoverable = recoverable;
        this.requiresConfiguration = requiresConfiguration;
    }
}

export default ToolExecutionError;
