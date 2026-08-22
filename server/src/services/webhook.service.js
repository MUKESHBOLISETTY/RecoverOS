export class WebhookService {
    constructor(handlers) {
        this.handlers = new Map(handlers.map(handler => [handler.eventCategory, handler]));
    }

    async process(eventCategory, webhook) {
        const handler = this.handlers.get(eventCategory);

        if (!handler) {
            const error = new Error(`Unsupported webhook event category: ${eventCategory}`);
            error.statusCode = 400;
            throw error;
        }

        return handler.handle(webhook);
    }
}