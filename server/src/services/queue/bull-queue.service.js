import { Queue } from 'bullmq';
import { BaseQueueService } from './base-queue.service.js';
import { defaultRedisConfig } from '../../infrastructure/redis/redis-options.js';

export class BullQueueService extends BaseQueueService {
    constructor(queueName, connectionOptions = defaultRedisConfig.getBullMQConnectionOptions(), defaultJobOptions = {}) {
        super(queueName);
        this.queue = new Queue(queueName, {
            connection: connectionOptions,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: true,
                removeOnFail: false,
                ...defaultJobOptions
            }
        });
    }

    /**
     * @param {string} jobName
     * @param {any} data
     * @param {object} [options]
     */
    async addJob(jobName, data, options = {}) {
        try {
            return await this.queue.add(jobName, data, options);
        } catch (error) {
            console.error(`[BullQueueService:${this.queueName}] Failed to add job "${jobName}":`, error.message);
            throw error;
        }
    }

    /**
     * @param {string} jobId
     */
    async getJob(jobId) {
        return await this.queue.getJob(jobId);
    }

    async pause() {
        return await this.queue.pause();
    }

    async resume() {
        return await this.queue.resume();
    }

    async close() {
        return await this.queue.close();
    }

    getUnderlyingQueue() {
        return this.queue;
    }
}
