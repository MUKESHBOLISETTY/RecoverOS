export class WebhookController {
    constructor(webhookService) {
        this.webhookService = webhookService;
    }

    handleEvent = eventType => async (req, res, next) => {
        try {
            const result = await this.webhookService.process(eventType, {
                headers: req.headers,
                body: req.body,
            });

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            return next(error);
        }
    };
}