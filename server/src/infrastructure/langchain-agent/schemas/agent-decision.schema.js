import { z } from 'zod';

export const AgentDecisionSchema = z.object({
    action: z.string().describe('The selected action to execute.'),
    rationale: z.string().describe('The reasoning behind why this action was chosen.'),
    parameters: z.record(z.string(), z.unknown()).describe('Parameters required to execute the action.'),
    requiresApproval: z.boolean().describe('Whether this action should be paused for human approval based on the policy.')
});

/**
 * @typedef {z.infer<typeof AgentDecisionSchema>} AgentDecision
 */
