export class EventHandlerInterface {
    async handle(eventPayload) {
        throw new Error(`${this.constructor.name} must implement handle()`);
    }
}
