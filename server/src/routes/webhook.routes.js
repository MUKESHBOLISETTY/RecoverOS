import express from "express";
import { rateLimit } from "express-rate-limit";
import { WebhookController } from "../controllers/webhook.controller.js";
import { WebhookService } from "../services/webhook.service.js";
import { PaymentWebhookHandler } from "../services/webhooks/payment-webhook.handler.js";
import { validateWebhook } from "../validators/webhook.validator.js";

const router = express.Router();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
});

const webhookService = new WebhookService([
    new PaymentWebhookHandler(),
]);
const webhookController = new WebhookController(webhookService);

router.post("/payment", limiter, validateWebhook, webhookController.handleEvent("payment"));

export default router;