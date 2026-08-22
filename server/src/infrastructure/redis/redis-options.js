import dotenv from 'dotenv';
dotenv.config();

export class RedisConfig {
    constructor(options = {}) {
        this.host = options.host || process.env.REDIS_HOST || '127.0.0.1';
        this.port = parseInt(options.port || process.env.REDIS_PORT || '6379', 10);
        this.password = options.password || process.env.REDIS_PASSWORD || undefined;
        this.db = options.db !== undefined ? options.db : parseInt(process.env.REDIS_DB || '0', 10);
        this.keyPrefix = options.keyPrefix || process.env.REDIS_PREFIX || '';
        this.enableOfflineQueue = options.enableOfflineQueue ?? false;
        this.maxRetriesPerRequest = options.maxRetriesPerRequest !== undefined ? options.maxRetriesPerRequest : 20;
    }

    static defaultRetryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }

    getClientOptions(overrides = {}) {
        return {
            host: this.host,
            port: this.port,
            password: this.password,
            db: this.db,
            enableOfflineQueue: this.enableOfflineQueue,
            retryStrategy: RedisConfig.defaultRetryStrategy,
            lazyConnect: true,
            ...overrides
        };
    }

    getPubSubOptions(overrides = {}) {
        return {
            host: this.host,
            port: this.port,
            password: this.password,
            db: this.db,
            retryStrategy: RedisConfig.defaultRetryStrategy,
            lazyConnect: true,
            ...overrides
        };
    }

    getBullMQConnectionOptions(overrides = {}) {
        return {
            host: this.host,
            port: this.port,
            password: this.password,
            db: this.db,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            ...overrides
        };
    }
}

export const defaultRedisConfig = new RedisConfig();
