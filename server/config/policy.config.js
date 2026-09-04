import { prisma } from './database.config.js';
import { MerchantPolicyService } from '../src/domain/policy/merchant-policy.service.js';
import { PolicyController } from '../src/controllers/policy.controller.js';
import { createPolicyRoutes } from '../src/routes/policy.routes.js';

export const policyService = new MerchantPolicyService(prisma);
export const policyController = new PolicyController(policyService);
export const policyRouter = createPolicyRoutes(policyController);
