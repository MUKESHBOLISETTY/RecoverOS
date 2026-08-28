export class RecoveryCaseRepository {
    /**
     * @param {string} type - 'PAYMENT_FAILURE', 'CART_ABANDONMENT'
     * @param {Object} identity - { paymentId: '...' } or { cartId: '...' }
     * @returns {Promise<Object|null>}
     */
    async findByEntity(type, identity) {
        throw new Error('RecoveryCaseRepository.findByEntity() not implemented');
    }

    /**
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        throw new Error('RecoveryCaseRepository.findById() not implemented');
    }

    /**
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async create(data) {
        throw new Error('Method not implemented.');
    }

    async update(id, data) {
        throw new Error('RecoveryCaseRepository.update() not implemented');
    }
}

export default RecoveryCaseRepository;
