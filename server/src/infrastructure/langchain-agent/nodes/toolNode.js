import { ToolNode as LangGraphToolNode } from '@langchain/langgraph/prebuilt';
import agentTools from '../tools/index.js';

export class ToolNode {
    constructor() {
        this.tools = agentTools.getToolsList();
        this.executor = new LangGraphToolNode(this.tools);
    }

    /**
     * @param {Object} state 
     * @param {Object} [config] 
     * @returns {Object} State update 
     */
    async execute(state, config) {
        try {
            return await this.executor.invoke(state, config);
        } catch (error) {
            console.error("ToolNode execution error:", error);
            return {
                messages: [
                    {
                        role: 'tool',
                        content: `Tool execution error: ${error.message}`,
                        tool_call_id: state.messages[state.messages.length - 1]?.tool_calls?.[0]?.id || 'error'
                    }
                ]
            };
        }
    }
}

export default new ToolNode();
