/**
 * @typedef {import('../domain/policy/merchant-policy.service.js').MerchantPolicyService} MerchantPolicyService
 */

export class PolicyController {
    /**
     * @param {MerchantPolicyService} policyService
     */
    constructor(policyService) {
        this.policyService = policyService;
        this.getPolicy = this.getPolicy.bind(this);
        this.updatePolicy = this.updatePolicy.bind(this);
    }

    async getPolicy(req, res, next) {
        try {
            const userId = req.user.id;
            const policy = await this.policyService.getPolicy(userId);
            return res.status(200).json({
                success: true,
                data: policy
            });
        } catch (error) {
            console.error('[PolicyController] getPolicy Error:', error);
            next(error);
        }
    }

    async updatePolicy(req, res, next) {
        try {
            const userId = req.user.id;
            const updates = req.body;
            
            const policy = await this.policyService.updatePolicy(userId, updates);
            return res.status(200).json({
                success: true,
                data: policy
            });
        } catch (error) {
            console.error('[PolicyController] updatePolicy Error:', error);
            if (error.message.includes('must be')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }
}

export default PolicyController;
