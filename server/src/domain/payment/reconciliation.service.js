import { PaymentMapper } from './payment-mapper.js';

export class ReconciliationService {
    /**
     * @param {import('@prisma/client').PrismaClient} prisma
     * @param {import('../../infrastructure/razorpay/razorpay-payment.repository.js').RazorpayPaymentRepository} razorpayRepo
     * @param {import('../../services/cache/base-cache.service.js').BaseCacheService} [cacheService]
     */
    constructor(prisma, razorpayRepo, cacheService = null) {
        if (!prisma) throw new Error('ReconciliationService: prisma is required');
        if (!razorpayRepo) throw new Error('ReconciliationService: razorpayRepo is required');

        this.prisma = prisma;
        this.razorpayRepo = razorpayRepo;
        this.cacheService = cacheService;

        this.LOCK_KEY = 'reconciliation:lock';
        this.LOCK_TTL_SECS = 10 * 60;
        this.BATCH_SIZE = 50;
    }

    /**
     * @param {number} [windowHours=24]
     * @returns {Promise<ReconciliationResult>}
     */
    async reconcile(windowHours = 24) {
        const lockAcquired = await this._acquireLock();
        if (!lockAcquired) {
            console.log('[ReconciliationService] Another reconciliation is already running — skipping this run.');
            return { skipped: true, upserted: 0, missing: 0, windowHours };
        }

        try {
            return await this._runReconciliation(windowHours);
        } finally {
            await this._releaseLock();
        }
    }
    /**
     * @param {number} windowHours
     * @returns {Promise<ReconciliationResult>}
     */
    async _runReconciliation(windowHours) {
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - windowHours * 60 * 60 * 1000);

        const fromUnix = Math.floor(fromDate.getTime() / 1000);
        const toUnix = Math.floor(toDate.getTime() / 1000);

        console.log(
            `[ReconciliationService] Reconciling window: ` +
            `${fromDate.toISOString()} → ${toDate.toISOString()}`
        );

        const razorpayPayments = await this.razorpayRepo.fetchAllInWindow(fromUnix, toUnix);

        if (razorpayPayments.length === 0) {
            console.log('[ReconciliationService] No payments from Razorpay in window — nothing to reconcile.');
            return { skipped: false, upserted: 0, missing: 0, windowHours };
        }

        // absent or stale in DB
        const razorpayIds = razorpayPayments.map(p => p.id);
        const missingIds = await this._findMissingOrStale(razorpayPayments, razorpayIds);

        if (missingIds.size === 0) {
            console.log(`[ReconciliationService] All ${razorpayPayments.length} payments are already present — no gaps.`);
            return { skipped: false, upserted: 0, missing: 0, windowHours };
        }

        console.log(
            `[ReconciliationService] Found ${missingIds.size} missing/stale payment(s) out of ` +
            `${razorpayPayments.length} — upserting...`
        );

        const toUpsert = razorpayPayments.filter(p => missingIds.has(p.id));
        let upserted = 0;

        for (let i = 0; i < toUpsert.length; i += this.BATCH_SIZE) {
            const batch = toUpsert.slice(i, i + this.BATCH_SIZE);
            await this._upsertBatch(batch);
            upserted += batch.length;
        }

        console.log(`[ReconciliationService] Reconciliation complete — upserted ${upserted} payment(s).`);

        return { skipped: false, upserted, missing: missingIds.size, windowHours };
    }

    /**
     * @param {object[]} razorpayPayments
     * @param {string[]} razorpayIds
     * @returns {Promise<Set<string>>} Razorpay payment IDs
     */
    async _findMissingOrStale(razorpayPayments, razorpayIds) {
        const local = await this.prisma.payment.findMany({
            where: { razorpayPaymentId: { in: razorpayIds } },
            select: { razorpayPaymentId: true, status: true },
        });

        const localMap = new Map(local.map(p => [p.razorpayPaymentId, p.status]));

        const missing = new Set();
        for (const rp of razorpayPayments) {
            const localStatus = localMap.get(rp.id);
            if (localStatus === undefined || localStatus !== rp.status) {
                missing.add(rp.id);
            }
        }

        return missing;
    }

    /**
     * @param {object[]} entities
     */
    async _upsertBatch(entities) {
        await this.prisma.$transaction(
            async (tx) => {
                for (const entity of entities) {
                    await tx.payment.upsert({
                        where: { razorpayPaymentId: entity.id },
                        create: PaymentMapper.toCreateInput(entity),
                        update: PaymentMapper.toUpdateInput(entity),
                    });
                }
            },
            { timeout: 30_000 }
        );
    }

    async _acquireLock() {
        if (!this.cacheService) return true;
        return await this.cacheService.setNx(this.LOCK_KEY, 'locked', this.LOCK_TTL_SECS);
    }

    async _releaseLock() {
        if (!this.cacheService) return;
        await this.cacheService.del(this.LOCK_KEY);
    }
}

/**
 * @typedef {Object} ReconciliationResult
 * @property {boolean} skipped - True if a lock prevented this run
 * @property {number}  upserted - Number of payments written to DB
 * @property {number}  missing - Number of gaps found
 * @property {number}  windowHours - The reconciliation window used
 */
