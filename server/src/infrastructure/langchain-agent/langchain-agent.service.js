import { HumanMessage } from '@langchain/core/messages';
import { LoggerTracer } from './tracing/loggerTracer.js';
import agentConfig from './agent-options.js';
import BaseAgentService from '../../domain/agent/base-agent.service.js';

export class LangchainAgentService extends BaseAgentService {
    constructor(graph) {
        super();
        this.graph = graph.getRunnable ? graph.getRunnable() : graph;
        this.config = agentConfig;
    }

    /**
     * @param {string} input
     * @param {Object} [options]
     * @returns {Promise<{ output: string, securityBlocked: boolean, traceId: string, redactedPiiTypes: string[], executionSummary: Object }>}
     */
    async processMessage(input, options = {}) {
        const tracer = new LoggerTracer({
            traceId: options.traceId,
            verbose: this.config.enableConsoleTrace
        });

        tracer.logEvent('SERVICE_INVOKE', 'LangchainAgentService.processMessage', {
            model: this.config.modelName,
            inputLength: input ? input.length : 0
        });

        const initialState = {
            messages: [new HumanMessage(input)],
            agentData: options.agentData || null,
            executionId: options.executionId || null,
            recoveryContext: options.recoveryContext || null,
            activeConnections: options.activeConnections || []
        };

        const runnableConfig = {
            callbacks: [tracer],
            recursionLimit: 25
        };

        try {
            const finalState = await this.graph.invoke(initialState, runnableConfig);
            const summary = tracer.getSummary();

            const responsePayload = {
                output: finalState.validatedOutput || finalState.messages[finalState.messages.length - 1]?.content || '',
                securityBlocked: Boolean(finalState.securityBlocked),
                securityReason: finalState.securityReason || null,
                redactedPiiTypes: finalState.redactedPiiTypes || [],
                traceId: tracer.traceId,
                executionSummary: {
                    totalEvents: summary.totalEvents,
                    modelUsed: this.config.modelName,
                    langsmithStatus: 'disabled'
                },
                decision: finalState.decision || null
            };

            tracer.logEvent('SERVICE_COMPLETE', 'LangchainAgentService.processMessage', {
                securityBlocked: responsePayload.securityBlocked
            });

            return responsePayload;
        } catch (error) {
            tracer.logEvent('SERVICE_ERROR', 'LangchainAgentService.processMessage', {
                error: error.message || String(error)
            });

            throw error;
        }
    }
}

export default LangchainAgentService;
