export class BaseCacheService {
    async get(_key) {
        throw new Error(`${this.constructor.name} must implement get()`);
    }

    async set(_key, _value, _ttlSeconds) {
        throw new Error(`${this.constructor.name} must implement set()`);
    }

    async del(_key) {
        throw new Error(`${this.constructor.name} must implement del()`);
    }

    async has(_key) {
        throw new Error(`${this.constructor.name} must implement has()`);
    }

    async getJson(_key) {
        throw new Error(`${this.constructor.name} must implement getJson()`);
    }

    async setJson(_key, _value, _ttlSeconds) {
        throw new Error(`${this.constructor.name} must implement setJson()`);
    }

    async remember(_key, _ttlSeconds, _callback) {
        throw new Error(`${this.constructor.name} must implement remember()`);
    }

    async expire(_key, _ttlSeconds) {
        throw new Error(`${this.constructor.name} must implement expire()`);
    }

    async flush() {
        throw new Error(`${this.constructor.name} must implement flush()`);
    }
}
