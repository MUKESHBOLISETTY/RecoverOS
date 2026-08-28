import dotenv from 'dotenv';
dotenv.config();

export class AgentConfig {
    constructor() {
        this.fireworksApiKey = process.env.FIREWORKS_API_KEY;
        this.modelName = process.env.FIREWORKS_MODEL;

        this.groqApiKey = process.env.GROQ_API_KEY;
        this.groqModelName = process.env.GROQ_MODEL;
        this.temperature = parseFloat(process.env.AGENT_TEMPERATURE || '0.2');
        this.maxTokens = parseInt(process.env.AGENT_MAX_TOKENS || '2048', 10);

        // Security Settings
        this.maxInputLength = parseInt(process.env.MAX_INPUT_LENGTH || '4000', 10);
        this.strictMode = process.env.SECURITY_STRICT_MODE !== 'false';

        // Tracing Settings
        this.enableConsoleTrace = process.env.ENABLE_CONSOLE_TRACE !== 'false';
        this.langsmithEnabled = process.env.LANGCHAIN_TRACING_V2 === 'true';

        // Eval Settings
        this.minEvalPassScore = parseFloat(process.env.MIN_EVAL_PASS_SCORE || '0.75');
    }

    getPrimaryLLMConfig() {
        return {
            apiKey: this.fireworksApiKey,
            configuration: {
                baseURL: 'https://api.fireworks.ai/inference/v1',
            },
            modelName: this.modelName,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
        };
    }

    getFallbackLLMConfig() {
        return {
            apiKey: this.groqApiKey,
            modelName: this.groqModelName,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
        };
    }
}

export default new AgentConfig();
