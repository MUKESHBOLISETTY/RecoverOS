import { Redis } from 'ioredis';
import { defaultRedisConfig } from './redis-options.js';

export class RedisConnectionManager {
    constructor(config = defaultRedisConfig) {
        this.config = config;
        this.connections = new Map();
        this.isConnected = false;
    }

    /**
     * @param {string} name - Connection name (e.g. 'default', 'pub', 'sub')
     * @param {object} options - Optional connection overrides
     * @returns {Redis}
     */
    getConnection(name = 'default', options = {}) {
        if (this.connections.has(name)) {
            return this.connections.get(name);
        }

        const connectionOptions = this.config.getClientOptions(options);
        const client = new Redis(connectionOptions);

        this._attachEventListeners(client, name);
        this.connections.set(name, client);

        return client;
    }

    getPublisherConnection(name = 'publisher') {
        if (this.connections.has(name)) {
            return this.connections.get(name);
        }
        const options = this.config.getPubSubOptions();
        const client = new Redis(options);
        this._attachEventListeners(client, name);
        this.connections.set(name, client);
        return client;
    }

    getSubscriberConnection(name = 'subscriber') {
        if (this.connections.has(name)) {
            return this.connections.get(name);
        }
        const options = this.config.getPubSubOptions();
        const client = new Redis(options);
        this._attachEventListeners(client, name);
        this.connections.set(name, client);
        return client;
    }

    getBullConnectionOptions() {
        return this.config.getBullMQConnectionOptions();
    }

    async ping(name = 'default') {
        const client = this.getConnection(name);
        return await client.ping();
    }

    _attachEventListeners(client, name) {
        client.on('connect', () => {
            this.isConnected = true;
            console.log(`[Redis:${name}] Successfully connected to Redis server.`);
        });

        client.on('ready', () => {
            console.log(`[Redis:${name}] Connection ready.`);
        });

        client.on('error', (err) => {
            this.isConnected = false;
            const failureTime = new Date().toISOString();
            console.warn(`[Redis:${name}][${failureTime}] Connection error: ${err.message}. Continuing...`);
        });

        client.on('close', () => {
            this.isConnected = false;
            console.warn(`[Redis:${name}] Connection closed.`);
        });

        client.on('reconnecting', (time) => {
            console.log(`[Redis:${name}] Reconnecting in ${time}ms...`);
        });
    }

    async disconnectAll() {
        const closePromises = [];
        for (const [name, client] of this.connections.entries()) {
            console.log(`[Redis:${name}] Closing connection...`);
            closePromises.push(client.quit().catch(() => client.disconnect()));
        }
        await Promise.all(closePromises);
        this.connections.clear();
        this.isConnected = false;
    }
}

export const redisConnectionManager = new RedisConnectionManager();
