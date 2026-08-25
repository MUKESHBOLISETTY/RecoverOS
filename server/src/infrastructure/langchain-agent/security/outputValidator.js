export class OutputValidator {
    constructor() {
        this.forbiddenSubstrings = [
            '<system_instruction>',
            'SYSTEM_PROMPT_KEY',
            'INTERNAL_CONFIDENTIAL'
        ];
    }

    /**
     * @param {string} text
     * @returns {{ valid: boolean, cleanedText: string, reason?: string }}
     */
    validateAndClean(text) {
        if (!text || typeof text !== 'string') {
            return { valid: false, cleanedText: '', reason: 'Empty or invalid model output.' };
        }

        let cleaned = text;

        cleaned = cleaned
            .replace(/<user_query>/gi, '')
            .replace(/<\/user_query>/gi, '')
            .trim();

        for (const forbidden of this.forbiddenSubstrings) {
            if (cleaned.includes(forbidden)) {
                return {
                    valid: false,
                    cleanedText: 'Response withheld due to security validation policy violation.',
                    reason: `Model output contained forbidden pattern: ${forbidden}`
                };
            }
        }

        return {
            valid: true,
            cleanedText: cleaned
        };
    }
}

export default new OutputValidator();
