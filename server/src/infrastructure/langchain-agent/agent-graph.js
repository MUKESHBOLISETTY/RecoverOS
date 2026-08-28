import { StateGraph, END } from '@langchain/langgraph';
import { ToolMessage } from '@langchain/core/messages';
import { AgentState } from './agent-state.js';

/**
 * @param {import('./nodes/agentNode.js').AgentNode} agentNode 
 * @param {import('./tool-adapter.js').ToolAdapter} toolAdapter 
 * @param {import('../../domain/agent/policy/policy-evaluator.js').PolicyEvaluator} policyEvaluator 
 * @param {import('../../domain/agent/agent-execution.repository.js').AgentExecutionRepository} agentExecutionRepository 
 */
export function createAgentGraph(agentNode, toolAdapter, policyEvaluator, agentExecutionRepository) {

    const callAgent = async (state, config) => {
        return await agentNode.execute(state, config);
    };

    const executeTools = async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const toolCalls = lastMessage.tool_calls || [];

        const langchainTools = toolAdapter.createLangchainTools(state.resolvedTools || [], state);
        const toolMap = new Map(langchainTools.map(t => [t.name, t]));

        const toolMessages = [];

        for (const toolCall of toolCalls) {
            if (toolCall.name === 'finish_recovery') {
                const tool = toolMap.get(toolCall.name);
                const result = await tool.invoke(toolCall.args);
                toolMessages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));

                const decision = {
                    action: 'finish_recovery',
                    rationale: toolCall.args.rationale,
                    parameters: toolCall.args,
                    finalStatus: toolCall.args.finalStatus
                };

                return { messages: toolMessages, decision };
            }

            const originalAction = state.resolvedTools?.find(rt => rt.definition.action.replace(/\./g, '_') === toolCall.name)?.definition.action || toolCall.name;

            const decision = {
                action: originalAction,
                parameters: toolCall.args,
                requiresApproval: false
            };

            const policyResult = policyEvaluator.evaluate({
                decision,
                recoveryContext: state.recoveryContext,
                policyContext: state.policyContext
            });

            if (policyResult === 'BLOCK') {
                toolMessages.push(new ToolMessage({
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                    content: `[POLICY BLOCK] Action ${originalAction} was blocked by security policy.`
                }));
                await agentExecutionRepository.markBlocked(state.executionId, decision);
                continue;
            }

            if (policyResult === 'REQUIRE_APPROVAL') {
                toolMessages.push(new ToolMessage({
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                    content: `[REQUIRE_APPROVAL] Action ${originalAction} requires human approval. Pausing execution.`
                }));
                await agentExecutionRepository.markBlocked(state.executionId, decision);
                continue;
            }

            const tool = toolMap.get(toolCall.name);
            if (!tool) {
                toolMessages.push(new ToolMessage({
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                    content: `Error: Tool ${toolCall.name} not found.`
                }));
                continue;
            }

            try {
                const result = await tool.invoke(toolCall.args);
                toolMessages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: result }));
            } catch (error) {
                toolMessages.push(new ToolMessage({ tool_call_id: toolCall.id, name: toolCall.name, content: `Error executing tool: ${error.message}` }));
            }
        }

        return { messages: toolMessages };
    };

    const shouldContinue = (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            const isFinishing = lastMessage.tool_calls.some(tc => tc.name === 'finish_recovery');
            return isFinishing ? "tools" : "tools";
        }
        return END;
    };

    const toolsRouter = (state) => {
        const lastMessages = state.messages.slice(-10);
        const finished = lastMessages.some(m => m._getType() === 'tool' && m.name === 'finish_recovery');
        if (finished) {
            return "finalize";
        }
        return "agent";
    };

    const finalizeExecution = async (state) => {
        const currentExecution = await agentExecutionRepository.findById(state.executionId);
        if (currentExecution && currentExecution.status !== 'BLOCKED' && currentExecution.status !== 'FAILED') {
            await agentExecutionRepository.markCompleted(state.executionId, {
                status: 'FINISHED',
                messages_length: state.messages.length
            });
        }
        return state;
    };

    const workflow = new StateGraph(AgentState)
        .addNode("agent", callAgent)
        .addNode("tools", executeTools)
        .addNode("finalize", finalizeExecution)
        .addConditionalEdges("tools", toolsRouter, {
            "finalize": "finalize",
            "agent": "agent"
        })
        .addConditionalEdges("agent", shouldContinue, {
            "tools": "tools",
            [END]: "finalize"
        })
        .addEdge("finalize", END)
        .setEntryPoint("agent");

    return workflow.compile();
}

export default createAgentGraph;
