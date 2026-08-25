import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import guardNode from './nodes/guardNode.js';
import agentNode from './nodes/agentNode.js';
import toolNode from './nodes/toolNode.js';
import evalNode from './nodes/evalNode.js';

export const AgentState = Annotation.Root({
    messages: Annotation({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    agentData: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? null),
        default: () => null,
    }),
    securityBlocked: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? false),
        default: () => false,
    }),
    securityReason: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? ''),
        default: () => '',
    }),
    sanitizedQuery: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? ''),
        default: () => '',
    }),
    redactedPiiTypes: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? []),
        default: () => [],
    }),
    validatedOutput: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? ''),
        default: () => '',
    }),
    outputValid: Annotation({
        reducer: (x, y) => (y !== undefined ? y : x ?? true),
        default: () => true,
    })
});


export class AgentGraph {
    constructor() {
        this.graph = this.buildGraph();
    }

    buildGraph() {
        const workflow = new StateGraph(AgentState)
            .addNode("guard", (state) => guardNode.execute(state))
            .addNode("agent", (state, config) => agentNode.execute(state, config))
            .addNode("tools", (state, config) => toolNode.execute(state, config))
            .addNode("eval", (state) => evalNode.execute(state));

        workflow.addEdge(START, "guard");

        workflow.addConditionalEdges("guard", (state) => {
            if (state.securityBlocked) {
                return "agent";
            }
            return "agent";
        });

        workflow.addConditionalEdges("agent", (state) => {
            const messages = state.messages || [];
            const lastMessage = messages[messages.length - 1];

            if (state.securityBlocked) {
                return "eval";
            }

            if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
                return "tools";
            }
            return "eval";
        });

        workflow.addEdge("tools", "agent");

        workflow.addEdge("eval", END);

        return workflow.compile();
    }

    getRunnable() {
        return this.graph;
    }
}

export default new AgentGraph();
