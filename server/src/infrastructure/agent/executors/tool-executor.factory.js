export class ToolExecutorFactory {
    constructor() {
        /** @type {Map<string, import('../../../domain/agent/tools/tool-executor.interface.js').ToolExecutorInterface>} */
        this.executors = new Map();
    }

    /**
     * @param {string} action
     * @param {import('../../../domain/agent/tools/tool-executor.interface.js').ToolExecutorInterface} executor 
     */
    registerExecutor(action, executor) {
        this.executors.set(action, executor);
    }

    /**
     * @param {string} action 
     * @returns {import('../../../domain/agent/tools/tool-executor.interface.js').ToolExecutorInterface | undefined}
     */
    getExecutor(action) {
        return this.executors.get(action);
    }
}

export default ToolExecutorFactory;
