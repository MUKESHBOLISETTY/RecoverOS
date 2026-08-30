export class AgentRepository {
    /**
     * @param {string} userId 
     * @returns {Promise<Array<Object>>}
     */
    async findActiveByUserId(userId) {
        throw new Error("Method not implemented.");
    }

    async findById(id) {
        throw new Error('Method not implemented.');
    }

    /**
     * @param {string} userId 
     * @param {string} credentialId 
     */
    async attachCredentialToActiveAgents(userId, credentialId) {
        throw new Error('Method not implemented.');
    }
}

export default AgentRepository;
