import { PaymentMapper } from './payment-mapper.js';

export class HistoricalBackfillService {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     * @param {import('../../infrastructure/razorpay/razorpay-payment.repository.js').RazorpayPaymentRepository} razorpayRepo
     */
    constructor(prisma, razorpayRepo) {
        if (!prisma) throw new Error('HistoricalBackfillService: prisma is required');
        if (!razorpayRepo) throw new Error('HistoricalBackfillService: razorpayRepo is required');

        this.prisma = prisma;
        this.razorpayRepo = razorpayRepo;

        this.BATCH_SIZE = 50;
    }

    /**
     * @param {Date} fromDate - Start
     * @param {Date} toDate - End
     * @returns {Promise<BackfillResult>}
     */
    async run(fromDate, toDate) {
        if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
            throw new Error('HistoricalBackfillService.run: fromDate and toDate must be Date objects');
        }
        if (fromDate >= toDate) {
            throw new Error('HistoricalBackfillService.run: fromDate must be before toDate');
        }

        console.log(
            `[HistoricalBackfillService] Starting backfill: ` +
            `${fromDate.toISOString()} → ${toDate.toISOString()}`
        );

        const windows = this.razorpayRepo.buildTimeWindows(fromDate, toDate);
        console.log(`[HistoricalBackfillService] Processing ${windows.length} time window(s)`);

        const result = {
            windowsProcessed: 0,
            totalFetched: 0,
            totalUpserted: 0,
            errors: [],
        };

        for (const window of windows) {
            try {
                const upserted = await this._processWindow(window.fromUnix, window.toUnix);
                result.windowsProcessed++;
                result.totalFetched += upserted.fetched;
                result.totalUpserted += upserted.upserted;
            } catch (error) {
                const msg = `Window ${new Date(window.fromUnix * 1000).toISOString()} failed: ${error.message}`;
                console.error(`[HistoricalBackfillService] ${msg}`);
                result.errors.push(msg);
            }
        }

        console.log(
            `[HistoricalBackfillService] Backfill complete. ` +
            `Windows: ${result.windowsProcessed}/${windows.length}, ` +
            `Fetched: ${result.totalFetched}, Upserted: ${result.totalUpserted}, ` +
            `Errors: ${result.errors.length}`
        );

        return result;
    }

    /**
     * @param {number} fromUnix
     * @param {number} toUnix
     * @returns {Promise<{fetched: number, upserted: number}>}
     */
    async _processWindow(fromUnix, toUnix) {
        const payments = await this.razorpayRepo.fetchAllInWindow(fromUnix, toUnix);

        if (payments.length === 0) {
            console.log(`[HistoricalBackfillService] No payments in window — skipping`);
            return { fetched: 0, upserted: 0 };
        }

        let upserted = 0;

        for (let i = 0; i < payments.length; i += this.BATCH_SIZE) {
            const batch = payments.slice(i, i + this.BATCH_SIZE);
            await this._upsertBatch(batch);
            upserted += batch.length;
            console.log(
                `[HistoricalBackfillService] Upserted batch ${Math.ceil((i + 1) / this.BATCH_SIZE)} ` +
                `(${upserted}/${payments.length})`
            );
        }

        return { fetched: payments.length, upserted };
    }

    /**
     * @param {object[]} entities
     */
    async _upsertBatch(entities) {
        await this.prisma.$transaction(
            async (tx) => {
                for (const entity of entities) {
                    const createData = PaymentMapper.toCreateInput(entity);
                    const updateData = PaymentMapper.toUpdateInput(entity);

                    await tx.payment.upsert({
                        where: { razorpayPaymentId: entity.id },
                        create: createData,
                        update: updateData,
                    });
                }
            },
            { timeout: 30_000 }
        );
    }
}

/**
 * @typedef {Object} BackfillResult
 * @property {number}   windowsProcessed
 * @property {number}   totalFetched
 * @property {number}   totalUpserted
 * @property {string[]} errors
 */
