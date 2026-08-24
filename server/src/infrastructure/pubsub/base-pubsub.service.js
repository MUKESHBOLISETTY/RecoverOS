export class BasePubSubService {
    async publish(_channel, _message) {
        throw new Error(`${this.constructor.name} must implement publish()`);
    }

    async subscribe(_channel, _listener) {
        throw new Error(`${this.constructor.name} must implement subscribe()`);
    }

    async unsubscribe(_channel, _listener) {
        throw new Error(`${this.constructor.name} must implement unsubscribe()`);
    }

    async close() {
        throw new Error(`${this.constructor.name} must implement close()`);
    }
}
