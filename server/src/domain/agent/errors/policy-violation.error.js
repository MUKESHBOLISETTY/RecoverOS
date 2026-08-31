export class PolicyViolationError extends Error {
    constructor({ action, limitType, currentCount, maxAllowed, reason, code = 'POLICY_LIMIT_EXCEEDED' }) {
        super(reason);
        this.name = 'PolicyViolationError';
        this.code = code;
        this.action = action;
        this.limitType = limitType;
        this.currentCount = currentCount;
        this.maxAllowed = maxAllowed;
        this.reason = reason;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PolicyViolationError);
        }
    }
}
