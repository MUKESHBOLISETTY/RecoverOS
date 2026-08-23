import { Worker } from 'bullmq';
import { defaultRedisConfig } from '../../infrastructure/redis/redis-options.js';

export class BaseWorkerService {
    constructor(queueName, workerOptions = {}) {
        if (!queueName) {
            throw new Error('BaseWorkerService requires a queueName.');
        }
        this.queueName = queueName;

        const connection = workerOptions.connection || defaultRedisConfig.getBullMQConnectionOptions();
        const limiter = workerOptions.limiter || undefined;
        const concurrency = workerOptions.concurrency || 1;

        this.worker = new Worker(
            this.queueName,
            this.handleJob.bind(this),
            {
                connection,
                limiter,
                concurrency,
                autorun: false,
                ...workerOptions
            }
        );

        this._setupWorkerEvents();
    }

    async start() {
        console.log(`[Worker:${this.queueName}] Starting worker...`);
        return await this.worker.run();
    }

    async handleJob(job) {
        return await this.process(job);
    }

    /**
     * @param {import('bullmq').Job} _job
     */
    async process(_job) {
        throw new Error(`${this.constructor.name} must implement process(job)`);
    }

    /**
     * @param {import('bullmq').Job} job
     * @param {any} result
     */
    onCompleted(job, result) {
        console.log(`[Worker:${this.queueName}] Job ${job.id} completed successfully.`);
    }

    /**
     * @param {import('bullmq').Job} job
     * @param {Error} error
     */
    onFailed(job, error) {
        console.error(`[Worker:${this.queueName}] Job ${job?.id} failed with error:`, error.message);
    }

    /**
     * @param {Error} error
     */
    onError(error) {
        console.error(`[Worker:${this.queueName}] Worker encountered an error:`, error.message);
    }

    _setupWorkerEvents() {
        this.worker.on('completed', (job, result) => this.onCompleted(job, result));
        this.worker.on('failed', (job, err) => this.onFailed(job, err));
        this.worker.on('error', (err) => this.onError(err));
    }

    async pause() {
        return await this.worker.pause();
    }

    async resume() {
        return await this.worker.resume();
    }

    async close() {
        return await this.worker.close();
    }

    getUnderlyingWorker() {
        return this.worker;
    }
}
