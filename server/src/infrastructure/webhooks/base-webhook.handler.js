export class BaseWebhookHandler {
    constructor(eventCategory) {
        this.eventCategory = eventCategory;
    }

    async handle(_webhook) {
        throw new Error(`${this.constructor.name} must implement handle()`);
    }
}