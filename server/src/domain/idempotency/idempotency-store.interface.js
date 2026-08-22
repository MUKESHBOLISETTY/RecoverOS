export class IdempotencyStoreInterface {
    /**
     * @param {string} key
     * @param {number} ttlSeconds
     * @returns {Promise<boolean>} True if lock acquired, false if it already exists
     */
    async acquireLock(key, ttlSeconds) {
        throw new Error(`${this.constructor.name} must implement acquireLock()`);
    }
}
