export class PolicyContext {
    /**
     * @param {Object} data
     * @param {number} data.maxRetry
     * @param {Record<string, number>} data.channelLimits
     * @param {number} data.maxDiscountPercent
     * @param {number} data.approvalThreshold
     * @param {string[]} data.allowedActions
     * @param {string[]} data.stopConditions
     */
    constructor(data) {
        this.maxRetry = data.maxRetry || 3;
        this.maxContactAttempts = data.maxContactAttempts !== undefined ? data.maxContactAttempts : 3;
        this.channelLimits = data.channelLimits || {};
        this.maxDiscountPercent = data.maxDiscountPercent || 0;
        this.approvalThreshold = data.approvalThreshold || 0;
        this.allowedActions = data.allowedActions || [];
        this.stopConditions = data.stopConditions || [];
    }
}

export default PolicyContext;
