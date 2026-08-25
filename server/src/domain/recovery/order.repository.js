export class OrderRepository {
    /**
     * @param {string} orderId 
     * @returns {Promise<Object>}
     */
    async findById(_orderId) {
        throw new Error(`${this.constructor.name} must implement findById()`);
    }
}
