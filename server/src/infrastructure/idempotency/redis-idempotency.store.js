import { IdempotencyStoreInterface } from '../../domain/idempotency/idempotency-store.interface.js';

export class RedisIdempotencyStore extends IdempotencyStoreInterface {
    /**
     * @param {import('../../services/cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(cacheService) {
        super();
        this.cacheService = cacheService;
    }

    /**
     * @param {string} key
     * @param {number} ttlSeconds
     * @returns {Promise<boolean>} True if lock acquired, false if it already exists
     */
    async acquireLock(key, ttlSeconds) {
        const fullKey = `idempotency:${key}`;
        const acquired = await this.cacheService.setNx(fullKey, 'locked', ttlSeconds);
        return acquired;
    }
}
