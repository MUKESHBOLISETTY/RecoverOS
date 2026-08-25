import outputValidator from '../security/outputValidator.js';
import piiSanitizer from '../security/piiSanitizer.js';

export class EvalNode {
    /**
     * @param {Object} state 
     * @returns {Object}
     */
    async execute(state) {
        const messages = state.messages || [];
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage || state.securityBlocked) {
            return {
                validatedOutput: state.messages[state.messages.length - 1]?.content || 'Security block enforced.'
            };
        }

        const rawOutput = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        const { sanitizedText: piiCleanOutput } = piiSanitizer.sanitize(rawOutput);

        const validation = outputValidator.validateAndClean(piiCleanOutput);

        return {
            validatedOutput: validation.cleanedText,
            outputValid: validation.valid
        };
    }
}

export default new EvalNode();
