import { BaseWebhookHandler } from "./base-webhook.handler.js";

export class PaymentDowntimeWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment_downtime");
    }

    async handle(webhook) {
        const data = webhook.body;
        console.log(data)
        return {
            data
        };
    }
}