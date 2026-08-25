export class PromptGuard {
    constructor(config = {}) {
        this.maxInputLength = config.maxInputLength || 4000;

        this.injectionPatterns = [
            /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
            /disregard\s+(all\s+)?prior\s+prompts/i,
            /you\s+are\s+now\s+in\s+DAN\s+mode/i,
            /system\s+override/i,
            /\[system\]/i,
            /<\/system_instruction>/i,
            /<system_context>/i,
            /bypass\s+safety\s+filter/i,
            /developer\s+mode\s+enabled/i,
            /forget\s+everything\s+you\s+were\s+told/i,
            /reveal\s+your\s+(system\s+prompt|hidden\s+instructions)/i,
            /print\s+the\s+initial\s+prompt/i,
            /output\s+the\s+secret\s+key/i
        ];
    }

    /**
     * @param {string} input
     * @returns {{ safe: boolean, reason?: string, sanitizedInput: string }}
     */
    inspect(input) {
        if (!input || typeof input !== 'string') {
            return { safe: false, reason: 'Invalid or empty input payload.', sanitizedInput: '' };
        }

        const trimmed = input.trim();

        if (trimmed.length > this.maxInputLength) {
            return {
                safe: false,
                reason: `Input exceeds maximum allowed length of ${this.maxInputLength} characters.`,
                sanitizedInput: trimmed.slice(0, this.maxInputLength)
            };
        }

        for (const pattern of this.injectionPatterns) {
            if (pattern.test(trimmed)) {
                return {
                    safe: false,
                    reason: 'Potential prompt injection / security violation detected in user query.',
                    sanitizedInput: '[BLOCKED_PROMPT_INJECTION]'
                };
            }
        }

        return {
            safe: true,
            sanitizedInput: this.wrapWithDelimiter(trimmed)
        };
    }

    /**
     * @param {string} input 
     * @returns {string}
     */
    wrapWithDelimiter(input) {
        const sanitized = input
            .replace(/<user_query>/gi, '&lt;user_query&gt;')
            .replace(/<\/user_query>/gi, '&lt;/user_query&gt;');

        return `<user_query>\n${sanitized}\n</user_query>`;
    }
}

export default new PromptGuard();
