import { PaymentMapper } from './payment-mapper.js';

export class HistoricalBackfillService {
    /**
     * @param {import('../connectors/connector-credential.repository.js').ConnectorCredentialRepository} connectorCredentialRepository
     * @param {import('./payment.repository.js').PaymentRepository} paymentRepository
     * @param {import('../connectors/connector.manager.js').default} connectorManager
     * @param {function(Object): Object} razorpayRepoFactory
     */
    constructor(connectorCredentialRepository, paymentRepository, connectorManager, razorpayRepoFactory) {
        if (!connectorCredentialRepository) throw new Error('HistoricalBackfillService: connectorCredentialRepository is required');
        if (!paymentRepository) throw new Error('HistoricalBackfillService: paymentRepository is required');
        if (!connectorManager) throw new Error('HistoricalBackfillService: connectorManager is required');
        if (!razorpayRepoFactory) throw new Error('HistoricalBackfillService: razorpayRepoFactory is required');

        this.connectorCredentialRepository = connectorCredentialRepository;
        this.paymentRepository = paymentRepository;
        this.connectorManager = connectorManager;
        this.razorpayRepoFactory = razorpayRepoFactory;

        this.BATCH_SIZE = 50;
    }

    /**
     * @param {string} connectionId
     * @param {Date} fromDate - Start
     * @param {Date} toDate - End
     * @returns {Promise<BackfillResult>}
     */
    async run(connectionId, fromDate, toDate) {
        if (!connectionId) throw new Error('HistoricalBackfillService.run: connectionId is required');
        if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
            throw new Error('HistoricalBackfillService.run: fromDate and toDate must be Date objects');
        }
        if (fromDate >= toDate) {
            throw new Error('HistoricalBackfillService.run: fromDate must be before toDate');
        }

        const credentialsObj = await this.connectorManager.getDecryptedCredentialsById(connectionId);
        if (!credentialsObj) {
            throw new Error(`HistoricalBackfillService.run: Invalid connectionId ${connectionId}`);
        }

        const record = await this.connectorCredentialRepository.findById(connectionId);
        if (!record || record.connectorId !== 'razorpay') {
            throw new Error(`HistoricalBackfillService.run: Connection ${connectionId} is not a valid razorpay connection`);
        }

        const razorpayRepo = this.razorpayRepoFactory(credentialsObj);

        console.log(
            `[HistoricalBackfillService] Starting backfill for conn: ${connectionId}: ` +
            `${fromDate.toISOString()} → ${toDate.toISOString()}`
        );

        const windows = razorpayRepo.buildTimeWindows(fromDate, toDate);
        console.log(`[HistoricalBackfillService] Processing ${windows.length} time window(s)`);

        const result = {
            windowsProcessed: 0,
            totalFetched: 0,
            totalUpserted: 0,
            errors: [],
        };

        const connContext = { id: connectionId, userId: record.userId };

        for (const window of windows) {
            try {
                const upserted = await this._processWindow(razorpayRepo, connContext, window.fromUnix, window.toUnix);
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
     * @param {RazorpayPaymentRepository} razorpayRepo
     * @param {object} connContext
     * @param {number} fromUnix
     * @param {number} toUnix
     * @returns {Promise<{fetched: number, upserted: number}>}
     */
    async _processWindow(razorpayRepo, connContext, fromUnix, toUnix) {
        const payments = await razorpayRepo.fetchAllInWindow(fromUnix, toUnix);

        if (payments.length === 0) {
            console.log(`[HistoricalBackfillService] No payments in window — skipping`);
            return { fetched: 0, upserted: 0 };
        }

        let upserted = 0;

        for (let i = 0; i < payments.length; i += this.BATCH_SIZE) {
            const batch = payments.slice(i, i + this.BATCH_SIZE);
            await this._upsertBatch(batch, connContext);
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
     * @param {object} connContext
     */
    async _upsertBatch(entities, connContext) {
        await this.paymentRepository.upsertBatch(
            entities,
            (entity) => PaymentMapper.toCreateInput(entity, { userId: connContext.userId, connectionId: connContext.id }),
            (entity) => PaymentMapper.toUpdateInput(entity)
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
