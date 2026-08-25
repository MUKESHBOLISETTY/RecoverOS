import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export class AgentTools {
    constructor() {
        // testing tool
        this.calculatorTool = tool(
            async ({ expression }) => {
                try {
                    const sanitizedExpr = expression.replace(/[^0-9+\-*/().\s]/g, '');
                    if (!sanitizedExpr) return 'Invalid math expression.';

                    const result = Function(`"use strict"; return (${sanitizedExpr})`)();
                    return `Calculation Result: ${result}`;
                } catch (e) {
                    return `Calculation Error: ${e.message}`;
                }
            },
            {
                name: 'calculate_arithmetic',
                description: 'Evaluates basic mathematical and arithmetic expressions safely.',
                schema: z.object({
                    expression: z.string().describe('The math expression to evaluate, e.g. "25 * 4 + 10".')
                })
            }
        );
    }

    getToolsList() {
        return [
            this.calculatorTool
        ];
    }
}

export default new AgentTools();
