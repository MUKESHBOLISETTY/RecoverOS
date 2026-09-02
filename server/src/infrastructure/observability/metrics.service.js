export class MetricsService {
    /**
     * @param {string} metricName 
     * @param {Object} [tags={}] 
     */
    static increment(metricName, tags = {}) {
        const safeTags = { ...tags };
        delete safeTags.paymentId;
        delete safeTags.customerId;
        delete safeTags.recoveryCaseId;
        delete safeTags.webhookId;
        delete safeTags.checkoutToken;
        delete safeTags.cartToken;
        delete safeTags.email;
        delete safeTags.phone;

        const tagStr = Object.entries(safeTags)
            .map(([k, v]) => `${k}:${v}`)
            .join(',');

        console.log(`[METRIC] ${metricName}:1|c|#${tagStr}`);
    }
}
