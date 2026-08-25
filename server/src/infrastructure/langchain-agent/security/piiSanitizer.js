export class PIISanitizer {
    constructor() {
        this.patterns = [
            { type: 'CREDIT_CARD', regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, replacement: '[REDACTED_CREDIT_CARD]' },

            { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },

            { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },

            { type: 'PHONE', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },

            { type: 'JWT', regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, replacement: '[REDACTED_JWT_TOKEN]' },

            { type: 'API_KEY', regex: /\b(?:sk-[a-zA-Z0-9]{32,}|api[_-]?key[_-]?[a-zA-Z0-9]{16,})\b/gi, replacement: '[REDACTED_API_KEY]' }
        ];
    }

    /**
     * @param {string} text 
     * @returns {{ sanitizedText: string, redactedTypes: string[] }}
     */
    sanitize(text) {
        if (!text || typeof text !== 'string') {
            return { sanitizedText: '', redactedTypes: [] };
        }

        let result = text;
        const redactedTypes = [];

        for (const { type, regex, replacement } of this.patterns) {
            if (regex.test(result)) {
                redactedTypes.push(type);
                result = result.replace(regex, replacement);
            }
        }

        return {
            sanitizedText: result,
            redactedTypes
        };
    }
}

export default new PIISanitizer();
