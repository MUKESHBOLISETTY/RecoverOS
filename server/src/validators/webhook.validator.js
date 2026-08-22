export function validateWebhook(req, res, next) {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            success: false,
            message: "Webhook payload must be a JSON object.",
        });
    }

    return next();
}