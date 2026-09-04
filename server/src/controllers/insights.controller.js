/**
 * @typedef {import('../domain/insights/insights.service.js').InsightsService} InsightsService
 */

export class InsightsController {
    /**
     * @param {InsightsService} insightsService
     */
    constructor(insightsService) {
        this.insightsService = insightsService;
        this.getDashboardMetrics = this.getDashboardMetrics.bind(this);
    }

    async getDashboardMetrics(req, res, next) {
        try {
            const userId = req.user.id;
            const metrics = await this.insightsService.getDashboardMetrics(userId);
            return res.status(200).json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('[InsightsController] getDashboardMetrics Error:', error);
            next(error);
        }
    }
}

export default InsightsController;
