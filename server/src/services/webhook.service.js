export class WebhookService {
    constructor(handlers) {
        this.handlers = new Map(handlers.map(handler => [handler.eventType, handler]));
    }

    async process(eventType, webhook) {
        const handler = this.handlers.get(eventType);

        if (!handler) {
            const error = new Error(`Unsupported webhook event type: ${eventType}`);
            error.statusCode = 400;
            throw error;
        }

        return handler.handle(webhook);
    }
}