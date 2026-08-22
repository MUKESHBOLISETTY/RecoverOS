export class BaseQueueService {
    constructor(queueName) {
        if (!queueName) {
            throw new Error('BaseQueueService requires a queueName.');
        }
        this.queueName = queueName;
    }

    async addJob(_jobName, _data, _options = {}) {
        throw new Error(`${this.constructor.name} must implement addJob()`);
    }

    async getJob(_jobId) {
        throw new Error(`${this.constructor.name} must implement getJob()`);
    }

    async pause() {
        throw new Error(`${this.constructor.name} must implement pause()`);
    }

    async resume() {
        throw new Error(`${this.constructor.name} must implement resume()`);
    }

    async close() {
        throw new Error(`${this.constructor.name} must implement close()`);
    }
}
