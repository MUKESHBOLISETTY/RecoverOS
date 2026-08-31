import { PolicyContext } from './policy-context.js';

export class PolicyContextBuilder {
    /**
     * @param {Object} agentData
     * @returns {PolicyContext}
     */
    build(agentData) {
        if (!agentData) {
            return new PolicyContext({});
        }

        const rules = agentData.rules || {};
        const allowedActions = agentData.actions || [];
        const stopConditions = agentData.stopConditions || [];

        return new PolicyContext({
            maxRetry: this._parseNumber(rules.maxRetry, 3),
            maxContactAttempts: this._parseNumber(rules.maxContactAttempts, 3),
            channelLimits: rules.channelLimits || {},
            maxDiscountPercent: this._parseNumber(rules.maxDiscountPercent, 0),
            approvalThreshold: this._parseNumber(rules.approvalThreshold, 0),
            allowedActions,
            stopConditions
        });
    }

    _parseNumber(val, defaultVal) {
        if (val === undefined || val === null) {
            return defaultVal;
        }
        const parsed = Number(val);
        return Number.isNaN(parsed) ? defaultVal : parsed;
    }
}

export default PolicyContextBuilder;
