export class RecoveryActionRepository {
    async findByCase(recoveryCaseId) {
        throw new Error('Method not implemented.');
    }

    async findByIdempotencyKey(key, tx = null) {
        throw new Error('Method not implemented.');
    }

    async create(data, tx = null) {
        throw new Error('Method not implemented.');
    }
}

export default RecoveryActionRepository;
