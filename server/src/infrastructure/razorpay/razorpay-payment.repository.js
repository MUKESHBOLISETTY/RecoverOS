import "dotenv/config";

export class RazorpayPaymentRepository {
    /**
     * @param {object} [credentials]
     * @param {string} [credentials.keyId]
     * @param {string} [credentials.keySecret]
     */
    constructor(credentials = {}) {
        const keyId = credentials.keyId;
        const keySecret = credentials.keySecret;

        if (!keyId || !keySecret) {
            throw new Error(
                'RazorpayPaymentRepository: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.'
            );
        }

        this._authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        this._baseUrl = 'https://api.razorpay.com/v1';

        this.PAGE_SIZE = 100;

        this.MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

        this.REQUEST_DELAY_MS = 200; //delay for fetch
    }

    /**
     * @param {number} fromUnix - Start timestamp
     * @param {number} toUnix - End timestamp
     * @param {number} [skip=0]
     * @returns {Promise<{items: object[], count: number}>}
     */
    async fetchPage(fromUnix, toUnix, skip = 0) {
        const params = new URLSearchParams({
            from: String(fromUnix),
            to: String(toUnix),
            count: String(this.PAGE_SIZE),
            skip: String(skip),
        });

        const url = `${this._baseUrl}/payments?${params}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: this._authHeader,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(
                `RazorpayPaymentRepository: HTTP ${response.status} fetching payments. Body: ${body}`
            );
        }

        const data = await response.json();
        return {
            items: data.items || [],
            count: data.count || 0,
        };
    }

    /**
     * @param {number} fromUnix - Start timestamp
     * @param {number} toUnix- End timestamp
     * @returns {Promise<object[]>} Flat array of all payment entities
     */
    async fetchAllInWindow(fromUnix, toUnix) {
        const all = [];
        let skip = 0;

        while (true) {
            const { items } = await this.fetchPage(fromUnix, toUnix, skip);

            if (items.length === 0) break;

            all.push(...items);
            skip += items.length;

            if (items.length < this.PAGE_SIZE) break;

            await this._delay(this.REQUEST_DELAY_MS);
        }

        console.log(
            `[RazorpayPaymentRepository] Fetched ${all.length} payments ` +
            `from ${new Date(fromUnix * 1000).toISOString()} ` +
            `to ${new Date(toUnix * 1000).toISOString()}`
        );

        return all;
    }

    /**
     * @param {string} paymentId
     * @returns {Promise<object>}
     */
    async fetchById(paymentId) {
        const url = `${this._baseUrl}/payments/${paymentId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: this._authHeader,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(
                `RazorpayPaymentRepository: HTTP ${response.status} fetching payment ${paymentId}. Body: ${body}`
            );
        }

        return await response.json();
    }

    /**
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {{ fromUnix: number, toUnix: number }[]}
     */
    buildTimeWindows(startDate, endDate) {
        const windows = [];
        let current = startDate.getTime();
        const end = endDate.getTime();

        while (current < end) {
            const windowEnd = Math.min(current + this.MAX_WINDOW_MS, end);
            windows.push({
                fromUnix: Math.floor(current / 1000),
                toUnix: Math.floor(windowEnd / 1000),
            });
            current = windowEnd + 1;
        }

        return windows;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
