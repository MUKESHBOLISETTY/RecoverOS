export class RecoveryScheduleRepository {
    async findById(id) {
        throw new Error('Method not implemented.');
    }

    async cancel(id, tx = null) {
        throw new Error('Method not implemented.');
    }

    async cancelManyForCase(caseId, tx = null) {
        throw new Error('Method not implemented.');
    }

    async markFailed(id, tx = null) {
        throw new Error('Method not implemented.');
    }

    async atomicFire(scheduleId, executionId) {
        throw new Error('Method not implemented.');
    }

    async create(data, tx = null) {
        throw new Error('Method not implemented.');
    }

    async findScheduledForReconciliation(batchSize) {
        throw new Error('Method not implemented.');
    }
}

export default RecoveryScheduleRepository;
