import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import agentConfig from '../agent-options.js';

export class AgentNode {
    /**
     * @param {import('../tool-adapter.js').ToolAdapter} toolAdapter
     */
    constructor(toolAdapter) {
        this.toolAdapter = toolAdapter;
    }

    /**
     * @param {Object} state
     * @param {Object} [config]
     * @returns {Object}
     */
    async execute(state, config) {
        if (state.securityBlocked) {
            return {
                messages: [
                    new AIMessage({
                        content: `[SECURITY BLOCK] Request denied: ${state.securityReason || 'Security policy violation detected.'}`
                    })
                ]
            };
        }

        const {
            skill,
            recoveryContext,
            policyContext,
            resolvedTools,
            messages
        } = state;

        let systemPromptText = 'You are the autonomous Revenue Recovery Orchestrator.\n';
        systemPromptText += 'Your goal is to analyze the recovery context, select appropriate tools to gather information or take action, and finally call `finish_recovery` when done.\n';
        systemPromptText += 'You may call multiple tools in sequence. Only call `finish_recovery` once you are completely finished with this recovery attempt.\n';

        if (skill) {
            systemPromptText += `\n[SKILL: ${skill.purpose}]\n`;
            if (skill.instructions && skill.instructions.length > 0) {
                systemPromptText += `Instructions:\n`;
                skill.instructions.forEach(inst => {
                    systemPromptText += `- ${inst}\n`;
                });
            }
        }

        if (policyContext) {
            systemPromptText += `\n[POLICY CONSTRAINTS]\n`;
            systemPromptText += `- Max Retries: ${policyContext.maxRetry}\n`;

            const actionNames = resolvedTools ? resolvedTools.map(rt => rt.definition.action) : [];

            if (policyContext.channelLimits) {
                for (const [action, limit] of Object.entries(policyContext.channelLimits)) {
                    if (actionNames.includes(action)) {
                        const channelName = action.split('.').pop();
                        systemPromptText += `- Max ${channelName}/Day: ${limit}\n`;
                    }
                }
            }

            systemPromptText += `- Max Discount %: ${policyContext.maxDiscountPercent}\n`;
            
            const previousDiscount = recoveryContext?.recoveryCase?.previousDiscountPercent || 0;
            systemPromptText += `- Previous Discount %: ${previousDiscount}\n`;
            systemPromptText += `- Constraint: You may choose any discount such that Previous Discount % <= Chosen Discount % <= Max Discount %\n`;

            if (policyContext.stopConditions && policyContext.stopConditions.length > 0) {
                systemPromptText += `- Stop Conditions: ${policyContext.stopConditions.join(', ')}\n`;
            }
        }

        if (recoveryContext) {
            systemPromptText += `\n[RECOVERY CONTEXT]\n`;
            systemPromptText += JSON.stringify(recoveryContext, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n';
        }
        const systemInstruction = new SystemMessage(systemPromptText);

        const filteredMessages = messages.filter(m => m._getType() !== 'system');
        const conversation = [
            systemInstruction,
            ...filteredMessages
        ];

        const langchainTools = this.toolAdapter.createLangchainTools(resolvedTools || [], state);

        const primaryLlm = new ChatOpenAI(agentConfig.getPrimaryLLMConfig());

        let fallbackLlm = null;
        const fallbackConfig = agentConfig.getFallbackLLMConfig();
        if (fallbackConfig.apiKey) {
            fallbackLlm = new ChatGroq(fallbackConfig);
        }

        let boundLlm = primaryLlm;

        if (langchainTools.length > 0) {
            boundLlm = primaryLlm.bindTools(langchainTools);
        }


        const response = await boundLlm.invoke(conversation, config);

        return {
            messages: [response]
        };
    }
}

export default AgentNode;
