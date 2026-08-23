import express from "express";
import { rateLimit } from "express-rate-limit";
import { WebhookController } from "../controllers/webhook.controller.js";
import { validateWebhook } from "../validators/webhook.validator.js";
import { idempotencyStore, webhookEventQueueService } from "../../config/redis.config.js";

const router = express.Router();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
});

const webhookController = new WebhookController(idempotencyStore, webhookEventQueueService);

router.post("/payment", limiter, validateWebhook, webhookController.ingestEvent);

router.post("/payment_downtime", limiter, validateWebhook, webhookController.ingestEvent);

export default router;