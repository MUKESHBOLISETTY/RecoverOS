/**
 * @typedef {import('./policy-context.js').default} PolicyContext
 * @typedef {import('../../infrastructure/langchain-agent/schemas/agent-decision.schema.js').AgentDecision} AgentDecision
 */

export class PolicyEvaluator {
    /**
     * @param {Object} params
     * @param {AgentDecision} params.decision LLM decision
     * @param {Object} params.recoveryContext
     * @param {PolicyContext} params.policyContext
     * @returns {'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK'}
     */
    evaluate({ decision, recoveryContext, policyContext }) {
        if (!decision || !decision.action) {
            return 'BLOCK';
        }

        const action = decision.action;

        if (policyContext.allowedActions.length > 0 && !policyContext.allowedActions.includes(action)) {
            console.warn(`[PolicyEvaluator] Action ${action} is not in allowedActions list.`);
            return 'BLOCK';
        }

        if (decision.requiresApproval) {
            return 'REQUIRE_APPROVAL';
        }

        if (action === 'payment_link.create' && decision.parameters && decision.parameters.discountPercent) {
            if (decision.parameters.discountPercent > policyContext.maxDiscountPercent) {
                console.warn(`[PolicyEvaluator] Discount ${decision.parameters.discountPercent} exceeds max allowed ${policyContext.maxDiscountPercent}`);
                return 'BLOCK';
            }
        }

        return 'ALLOW';
    }
}

export default PolicyEvaluator;
