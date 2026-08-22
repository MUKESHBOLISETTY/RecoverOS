import { BaseWebhookHandler } from "./base-webhook.handler.js";

export class PaymentWebhookHandler extends BaseWebhookHandler {
    constructor() {
        super("payment");
    }

    async handle(webhook) {
        const data = webhook.body;
        console.log(data)
        return {
            data
        };
    }
}