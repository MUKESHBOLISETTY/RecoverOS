import { BasePubSubService } from './base-pubsub.service.js';

export class RedisPubSubService extends BasePubSubService {
    /**
     * @param {import('ioredis').Redis} publisherClient
     * @param {import('ioredis').Redis} subscriberClient
     */
    constructor(publisherClient, subscriberClient) {
        super();
        if (!publisherClient || !subscriberClient) {
            throw new Error('RedisPubSubService requires both publisher and subscriber Redis client instances.');
        }

        this.publisher = publisherClient;
        this.subscriber = subscriberClient;
        this.channelListeners = new Map();

        this._setupSubscriberRouting();
    }

    /**
     * @param {string} channel
     * @param {any} message
     * @returns {Promise<number>} Number of clients that received the message
     */
    async publish(channel, message) {
        try {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            return await this.publisher.publish(channel, payload);
        } catch (error) {
            console.error(`[RedisPubSubService] Error publishing to channel "${channel}":`, error.message);
            throw error;
        }
    }

    /**
     * @param {string} channel
     * @param {(data: any, channel: string) => void} listener
     */
    async subscribe(channel, listener) {
        if (!this.channelListeners.has(channel)) {
            this.channelListeners.set(channel, new Set());
            await this.subscriber.subscribe(channel);
        }

        this.channelListeners.get(channel).add(listener);
    }

    /**
     * @param {string} channel
     * @param {Function} [listener]
     */
    async unsubscribe(channel, listener) {
        if (!this.channelListeners.has(channel)) return;

        const listeners = this.channelListeners.get(channel);
        if (listener) {
            listeners.delete(listener);
        } else {
            listeners.clear();
        }

        if (listeners.size === 0) {
            this.channelListeners.delete(channel);
            await this.subscriber.unsubscribe(channel);
        }
    }

    _setupSubscriberRouting() {
        this.subscriber.on('message', (channel, message) => {
            const listeners = this.channelListeners.get(channel);
            if (!listeners || listeners.size === 0) return;

            let parsedData = message;
            try {
                parsedData = JSON.parse(message);
            } catch {
            }

            listeners.forEach((listener) => {
                try {
                    listener(parsedData, channel);
                } catch (err) {
                    console.error(`[RedisPubSubService] Listener error on channel "${channel}":`, err);
                }
            });
        });
    }

    async close() {
        this.channelListeners.clear();
        await this.subscriber.unsubscribe();
    }
}
