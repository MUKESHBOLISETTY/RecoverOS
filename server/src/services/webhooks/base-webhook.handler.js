export class BaseWebhookHandler {
    constructor(eventType) {
        this.eventType = eventType;
    }

    async handle(_webhook) {
        throw new Error(`${this.constructor.name} must implement handle()`);
    }
}