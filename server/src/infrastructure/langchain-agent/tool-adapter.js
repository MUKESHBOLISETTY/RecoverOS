import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export class ToolAdapter {
    /**
     * @param {import('../../domain/agent/tools/tool-execution.service.js').ToolExecutionService} toolExecutionService
     */
    constructor(toolExecutionService) {
        this.toolExecutionService = toolExecutionService;
    }

    /**
     * @param {Array<import('../../domain/agent/tools/resolved-tool.js').ResolvedTool>} resolvedTools
     * @param {Object} executionContext
     * @returns {Array<import('@langchain/core/tools').StructuredTool>}
     */
    createLangchainTools(resolvedTools, executionContext) {
        const langchainTools = [];

        for (const rt of resolvedTools) {
            const safeName = rt.definition.action.replace(/\./g, '_');

            const langchainTool = tool(
                async (input) => {
                    const decision = {
                        action: rt.definition.action,
                        parameters: input
                    };

                    try {
                        const matchingConnections = executionContext.activeConnections?.filter(
                            conn => conn.capabilities.includes(rt.definition.requiresCapability)
                        );

                        const result = await this.toolExecutionService.executeDecision({
                            executionId: executionContext.executionId,
                            decision: decision,
                            recoveryContext: executionContext.recoveryContext,
                            policyContext: executionContext.policyContext,
                            activeConnection: matchingConnections?.[0],
                            activeConnections: matchingConnections
                        });

                        return JSON.stringify({ success: true, data: result });
                    } catch (error) {
                        if (error.name === 'PolicyViolationError') {
                            return JSON.stringify({
                                success: false,
                                error: {
                                    code: error.code,
                                    message: error.message,
                                    policyContext: {
                                        action: error.action,
                                        limitType: error.limitType,
                                        currentCount: error.currentCount,
                                        maxAllowed: error.maxAllowed
                                    },
                                    retryable: false,
                                    recoverable: true
                                }
                            });
                        }

                        if (error.name === 'ToolExecutionError') {
                            return JSON.stringify({
                                success: false,
                                error: {
                                    code: error.code,
                                    message: error.message,
                                    retryable: error.retryable,
                                    recoverable: error.recoverable,
                                    requiresConfiguration: error.requiresConfiguration
                                }
                            });
                        }
                        
                        return JSON.stringify({
                            success: false,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: error.message,
                                retryable: false,
                                recoverable: false,
                                requiresConfiguration: false
                            }
                        });
                    }
                },
                {
                    name: safeName,
                    description: `Provider: ${rt.provider}. Execute the ${rt.definition.action} action.`,
                    schema: rt.definition.inputSchema || z.object({})
                }
            );

            langchainTools.push(langchainTool);
        }

        const finishTool = tool(
            async (input) => {
                return JSON.stringify({ status: 'Agent marked execution as finished', result: input });
            },
            {
                name: 'finish_recovery',
                description: 'Call this tool ONLY when you have completed all necessary actions for this recovery case or if no further actions are possible.',
                schema: z.object({
                    rationale: z.string().describe('Explain why the recovery process is considered finished.'),
                    finalStatus: z.enum(['SUCCESS', 'FAILED', 'ESCALATED', 'NO_ACTION_NEEDED']).describe('The final determined state of this recovery attempt.')
                })
            }
        );

        langchainTools.push(finishTool);

        return langchainTools;
    }
}

export default ToolAdapter;
