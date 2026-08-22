import { BaseCacheService } from './base-cache.service.js';

export class RedisCacheService extends BaseCacheService {
    /**
     * @param {import('ioredis').Redis} redisClient - Injected Redis client instance
     */
    constructor(redisClient) {
        super();
        if (!redisClient) {
            throw new Error('RedisCacheService requires a valid redisClient instance.');
        }
        this.client = redisClient;
    }

    /**
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    async get(key) {
        try {
            return await this.client.get(key);
        } catch (error) {
            console.warn(`[RedisCacheService] Error getting key "${key}":`, error.message);
            return null;
        }
    }

    /**
     * @param {string} key
     * @param {string} value
     * @param {number} [ttlSeconds]
     * @returns {Promise<boolean>}
     */
    async set(key, value, ttlSeconds) {
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await this.client.set(key, value, 'EX', ttlSeconds);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error) {
            console.warn(`[RedisCacheService] Error setting key "${key}":`, error.message);
            return false;
        }
    }

    /**
     * @param {string|string[]} keys
     * @returns {Promise<number>}
     */
    async del(keys) {
        try {
            const keyList = Array.isArray(keys) ? keys : [keys];
            if (keyList.length === 0) return 0;
            return await this.client.del(...keyList);
        } catch (error) {
            console.warn(`[RedisCacheService] Error deleting keys:`, error.message);
            return 0;
        }
    }

    /**
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async has(key) {
        try {
            const count = await this.client.exists(key);
            return count > 0;
        } catch (error) {
            console.warn(`[RedisCacheService] Error checking existence of key "${key}":`, error.message);
            return false;
        }
    }

    /**
     * @param {string} key
     * @returns {Promise<any|null>}
     */
    async getJson(key) {
        const raw = await this.get(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn(`[RedisCacheService] Failed to parse JSON for key "${key}":`, err.message);
            return null;
        }
    }

    /**
     * @param {string} key
     * @param {any} value
     * @param {number} [ttlSeconds]
     * @returns {Promise<boolean>}
     */
    async setJson(key, value, ttlSeconds) {
        try {
            const serialized = JSON.stringify(value);
            return await this.set(key, serialized, ttlSeconds);
        } catch (err) {
            console.warn(`[RedisCacheService] Failed to serialize JSON for key "${key}":`, err.message);
            return false;
        }
    }

    /**
     * @param {string} key
     * @param {number} ttlSeconds
     * @param {Function} callback - Async function that produces the value if cache misses
     * @returns {Promise<any>}
     */
    async remember(key, ttlSeconds, callback) {
        const cached = await this.getJson(key);
        if (cached !== null) {
            return cached;
        }

        const freshValue = await callback();
        if (freshValue !== undefined && freshValue !== null) {
            await this.setJson(key, freshValue, ttlSeconds);
        }
        return freshValue;
    }

    /**
     * @param {string} key
     * @param {number} ttlSeconds
     * @returns {Promise<boolean>}
     */
    async expire(key, ttlSeconds) {
        try {
            const res = await this.client.expire(key, ttlSeconds);
            return res === 1;
        } catch (error) {
            console.warn(`[RedisCacheService] Error setting expire on key "${key}":`, error.message);
            return false;
        }
    }

    /**
     * @returns {Promise<boolean>}
     */
    async flush() {
        try {
            await this.client.flushdb();
            return true;
        } catch (error) {
            console.warn(`[RedisCacheService] Error flushing db:`, error.message);
            return false;
        }
    }
}
