export class OrderContextService {
    /**
     * @param {import('./order.repository.js').OrderRepository} orderRepository
     * @param {import('../../infrastructure/cache/base-cache.service.js').BaseCacheService} cacheService
     */
    constructor(orderRepository, cacheService) {
        this.orderRepository = orderRepository;
        this.cacheService = cacheService;
        this.CACHE_TTL_SECONDS = 300; // 5 minutes
    }

    /**
     * @param {string} orderId 
     * @returns {Promise<Object>}
     */
    async getOrderContext(orderId) {
        if (!orderId) return null;

        const cacheKey = `order_context:${orderId}`;

        const rawOrder = await this.cacheService.remember(cacheKey, this.CACHE_TTL_SECONDS, async () => {
            try {
                return await this.orderRepository.findById(orderId);
            } catch (error) {
                console.error(`[OrderContextService] Failed to fetch order ${orderId}`, error);
                return null;
            }
        });

        if (!rawOrder) return null;

        return {
            id: rawOrder.id,
            amount: rawOrder.amount,
            amountPaid: rawOrder.amount_paid,
            amountDue: rawOrder.amount_due,
            currency: rawOrder.currency,
            status: rawOrder.status,
            attempts: rawOrder.attempts,
            notes: rawOrder.notes || {}
        };
    }
}
