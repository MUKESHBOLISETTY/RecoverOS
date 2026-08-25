import promptGuard from '../security/promptGuard.js';
import piiSanitizer from '../security/piiSanitizer.js';


export class GuardNode {
    /**
     * @param {Object} state - Current StateGraph
     * @returns {Object} Updated state payload
     */
    async execute(state) {
        const messages = state.messages || [];
        const lastMessage = messages[messages.length - 1];
        const rawContent = typeof lastMessage?.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage?.content || '');

        const { sanitizedText: piiCleanText, redactedTypes } = piiSanitizer.sanitize(rawContent);

        const inspection = promptGuard.inspect(piiCleanText);

        if (!inspection.safe) {
            return {
                securityBlocked: true,
                securityReason: inspection.reason,
                redactedPiiTypes: redactedTypes,
                sanitizedQuery: inspection.sanitizedInput
            };
        }

        return {
            securityBlocked: false,
            redactedPiiTypes: redactedTypes,
            sanitizedQuery: inspection.sanitizedInput
        };
    }
}

export default new GuardNode();
