import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

export class LoggerTracer extends BaseCallbackHandler {
    name = "LoggerTracer";

    constructor(options = {}) {
        super();
        this.traceId = options.traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        this.verbose = options.verbose !== false;
        this.stepTimes = new Map();
        this.events = [];
    }

    logEvent(eventType, name, payload = {}) {
        const event = {
            traceId: this.traceId,
            timestamp: new Date().toISOString(),
            eventType,
            name,
            ...payload
        };
        this.events.push(event);

        if (this.verbose) {
            console.log(`[TRACER:${this.traceId}] [${event.timestamp}] [${eventType}] ${name}`,
                Object.keys(payload).length > 0 ? JSON.stringify(payload) : '');
        }
    }

    async handleLLMStart(llm, prompts, runId) {
        this.stepTimes.set(runId, Date.now());
        this.logEvent("LLM_START", llm.id ? llm.id.join('.') : "OllamaLLM", {
            promptCount: prompts.length,
            runId
        });
    }

    async handleLLMEnd(output, runId) {
        const startTime = this.stepTimes.get(runId);
        const durationMs = startTime ? Date.now() - startTime : null;
        this.stepTimes.delete(runId);

        const tokenUsage = output.llmOutput?.tokenUsage || {};

        this.logEvent("LLM_END", "OllamaLLM", {
            durationMs,
            tokenUsage,
            generationsCount: output.generations ? output.generations.length : 0,
            runId
        });
    }

    async handleLLMError(err, runId) {
        const startTime = this.stepTimes.get(runId);
        const durationMs = startTime ? Date.now() - startTime : null;
        this.stepTimes.delete(runId);

        this.logEvent("LLM_ERROR", "OllamaLLM", {
            durationMs,
            error: err.message || String(err),
            runId
        });
    }

    async handleChainStart(chain, inputs, runId) {
        this.stepTimes.set(runId, Date.now());
        this.logEvent("CHAIN_START", chain.id ? chain.id.join('.') : "Chain", { runId });
    }

    async handleChainEnd(outputs, runId) {
        const startTime = this.stepTimes.get(runId);
        const durationMs = startTime ? Date.now() - startTime : null;
        this.stepTimes.delete(runId);

        this.logEvent("CHAIN_END", "Chain", { durationMs, runId });
    }

    async handleToolStart(tool, input, runId) {
        this.stepTimes.set(runId, Date.now());
        this.logEvent("TOOL_START", tool.id ? tool.id.join('.') : "Tool", {
            input,
            runId
        });
    }

    async handleToolEnd(output, runId) {
        const startTime = this.stepTimes.get(runId);
        const durationMs = startTime ? Date.now() - startTime : null;
        this.stepTimes.delete(runId);

        this.logEvent("TOOL_END", "Tool", {
            outputLength: typeof output === 'string' ? output.length : JSON.stringify(output).length,
            durationMs,
            runId
        });
    }

    async handleToolError(err, runId) {
        const startTime = this.stepTimes.get(runId);
        const durationMs = startTime ? Date.now() - startTime : null;
        this.stepTimes.delete(runId);

        this.logEvent("TOOL_ERROR", "Tool", {
            error: err.message || String(err),
            durationMs,
            runId
        });
    }

    getSummary() {
        return {
            traceId: this.traceId,
            totalEvents: this.events.length,
            events: this.events
        };
    }
}
