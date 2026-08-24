import express from "express";
import { rateLimit } from "express-rate-limit";
import { validateWebhook } from "../validators/webhook.validator.js";

/**
 * @param {import('../controllers/webhook.controller.js').WebhookController} webhookController 
 */
function createWebhookRouter(webhookController) {
    const router = express.Router();
    
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 15,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
    });

    router.post("/payment/:connectionId", limiter, validateWebhook, webhookController.ingestEvent);

    router.post("/payment_downtime/:connectionId", limiter, validateWebhook, webhookController.ingestEvent);

    return router;
}

export default createWebhookRouter;