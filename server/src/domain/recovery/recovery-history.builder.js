export class RecoveryHistoryBuilder {
    /**
     * @param {import('../../infrastructure/db/agent/prisma-recovery-action.repository.js').PrismaRecoveryActionRepository} recoveryActionRepository
     */
    constructor(recoveryActionRepository) {
        this.recoveryActionRepository = recoveryActionRepository;
    }

    /**
     * @param {string} recoveryCaseId
     * @returns {Promise<Object>}
     */
    async buildHistory(recoveryCaseId) {
        if (!recoveryCaseId) {
            throw new Error('[RecoveryHistoryBuilder] recoveryCaseId is required');
        }

        const previousRecoveryActions = await this.recoveryActionRepository.findByCase(recoveryCaseId);

        const contactAttempts = previousRecoveryActions.filter(a => {
            const contactTypes = ['EMAIL', 'SMS', 'WHATSAPP', 'VOICE'];
            return contactTypes.includes(a.type) && a.status !== 'FAILED';
        }).length;

        const automatedRecoveryActions = previousRecoveryActions.filter(a => 
            a.type === 'INTERNAL_SYSTEM_ACTION'
        ).length;

        const actions = previousRecoveryActions.map(a => ({
            action: a.type,
            status: a.status,
            payload: a.payload || null,
            occurredAt: a.createdAt
        }));

        return {
            contactAttempts,
            automatedRecoveryActions,
            actions
        };
    }
}

export default RecoveryHistoryBuilder;
