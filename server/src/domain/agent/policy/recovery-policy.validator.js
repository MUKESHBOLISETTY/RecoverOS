export class RecoveryPolicyValidator {
    static ACTION_TYPE_MAP = {
        'communication.email': 'EMAIL',
        'communication.sms': 'SMS',
        'communication.whatsapp': 'WHATSAPP',
        'communication.voice': 'VOICE',
        'commerce.discount.create': 'DISCOUNT'
    };

    static CONTACT_ACTION_TYPES = ['EMAIL', 'SMS', 'WHATSAPP', 'VOICE'];

    static TRACKED_ACTION_TYPES = [...this.CONTACT_ACTION_TYPES, 'SCHEDULE', 'DISCOUNT', 'IN_APP', 'INTERNAL_SYSTEM_ACTION'];

    static TERMINAL_STATES = ['RECOVERED', 'STOPPED', 'ESCALATED', 'CLOSED', 'CANCELLED'];

    /**
     * @param {Object} params
     * @param {string} params.action -eg: 'communication.sms'
     * @param {Object} params.parameters
     * @param {import('./policy-context.js').PolicyContext} params.policy
     * @param {Object} params.recoveryCase
     * @param {Array} params.recoveryActions
     * @returns {Object} { allowed: true } or { allowed: false, code, action, limitType, currentCount, maxAllowed, reason }
     */
    static validate({ action, parameters = {}, policy, recoveryCase, recoveryActions = [], verificationResult = null }) {
        if (verificationResult) {
            const { allowedActions, blockedActions } = this.getAllowedActionsFromVerification(verificationResult);
            if (blockedActions.includes(action)) {
                return this._reject({
                    action,
                    limitType: 'VERIFICATION_STATE',
                    currentCount: 0,
                    maxAllowed: 0,
                    reason: `Action ${action} is blocked because recovery case is in verification state: ${verificationResult.state}.`
                });
            }
        }

        if (!policy) {
            return { allowed: true };
        }

        const actionType = this.ACTION_TYPE_MAP[action];
        const isContactAction = actionType && this.CONTACT_ACTION_TYPES.includes(actionType);

        if (isContactAction && recoveryCase) {
            if (this.TERMINAL_STATES.includes(recoveryCase.status)) {
                return this._reject({
                    action,
                    limitType: 'TERMINAL_STATE',
                    currentCount: 0,
                    maxAllowed: 0,
                    reason: `Cannot communicate with customer. Recovery case is in terminal state: ${recoveryCase.status}.`
                });
            }
        }

        if (action === 'commerce.discount.create' && recoveryCase) {
            if (this.TERMINAL_STATES.includes(recoveryCase.status)) {
                return this._reject({
                    action,
                    limitType: 'TERMINAL_STATE',
                    currentCount: 0,
                    maxAllowed: 0,
                    reason: `Cannot create discount. Recovery case is in terminal state: ${recoveryCase.status}.`
                });
            }
        }

        if ((action === 'payment_link.create' || action === 'commerce.discount.create') && typeof parameters.discountPercent === 'number') {
            const maxDiscountPercent = policy.maxDiscountPercent || 0;
            if (parameters.discountPercent > maxDiscountPercent) {
                return this._reject({
                    action,
                    limitType: 'DISCOUNT_LIMIT',
                    currentCount: parameters.discountPercent,
                    maxAllowed: maxDiscountPercent,
                    reason: `Discount of ${parameters.discountPercent}% exceeds maximum allowed discount of ${maxDiscountPercent}%.`
                });
            }
        }

        if (isContactAction) {
            const successfulContactActions = recoveryActions.filter(a =>
                this.CONTACT_ACTION_TYPES.includes(a.type) && a.status !== 'FAILED'
            );

            const maxContactAttempts = policy.maxContactAttempts !== undefined ? policy.maxContactAttempts : 3;
            if (successfulContactActions.length >= maxContactAttempts) {
                return this._reject({
                    action,
                    limitType: 'TOTAL_CONTACT_LIMIT',
                    currentCount: successfulContactActions.length,
                    maxAllowed: maxContactAttempts,
                    reason: `Total contact limit of ${maxContactAttempts} has been reached.`
                });
            }

            const channelLimits = policy.channelLimits || {};
            if (channelLimits[action] !== undefined) {
                const maxChannelAttempts = channelLimits[action];
                const channelActions = successfulContactActions.filter(a => a.type === actionType);

                if (channelActions.length >= maxChannelAttempts) {
                    return this._reject({
                        action,
                        limitType: 'CHANNEL_LIMIT',
                        currentCount: channelActions.length,
                        maxAllowed: maxChannelAttempts,
                        reason: `Channel limit of ${maxChannelAttempts} for ${action} has been reached.`
                    });
                }
            }
        }

        return { allowed: true };
    }

    static _reject(details) {
        return {
            allowed: false,
            code: 'POLICY_LIMIT_EXCEEDED',
            ...details
        };
    }

    /**
     * @param {Object} verificationResult 
     * @returns {{ allowedActions: string[], blockedActions: string[] }}
     */
    static getAllowedActionsFromVerification(verificationResult) {
        if (!verificationResult) return { allowedActions: [], blockedActions: [] };

        const state = verificationResult.state;
        const blockedActions = [];
        const allowedActions = [];

        if (state === 'UNKNOWN') {
            blockedActions.push(
                'communication.email',
                'communication.sms',
                'communication.whatsapp',
                'communication.voice',
                'recovery.schedule',
                'payment_link.create',
                'payment.retry',
                'commerce.discount.create'
            );
        } else if (state === 'RECOVERED' || state === 'BLOCKED') {
            blockedActions.push(
                'communication.email',
                'communication.sms',
                'communication.whatsapp',
                'communication.voice',
                'recovery.schedule',
                'payment_link.create',
                'payment.retry',
                'commerce.discount.create'
            );
        }

        return { allowedActions, blockedActions };
    }
}

export default RecoveryPolicyValidator;

