import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const AgentState = Annotation.Root({
    messages: Annotation({
        reducer: (state, update) => state.concat(update),
        default: () => [],
    }),

    executionId: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    agentData: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    skill: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    recoveryContext: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    policyContext: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    resolvedTools: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => [],
    }),
    activeConnections: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => [],
    }),

    securityBlocked: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => false,
    }),
    securityReason: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    decision: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
    })
});

export default AgentState;
