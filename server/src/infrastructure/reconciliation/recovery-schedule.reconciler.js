export class RecoveryScheduleReconciler {
    /**
     * @param {import('../../domain/recovery/recovery-schedule.repository.js').RecoveryScheduleRepository} recoveryScheduleRepository
     * @param {import('../../domain/events/outbox-event.repository.js').OutboxEventRepository} outboxEventRepository
     * @param {import('../../domain/recovery/recovery-case.service.js').RecoveryCaseService} recoveryCaseService
     * @param {import('../queue/recovery-schedule.queue.js').RecoveryScheduleQueue} recoveryScheduleQueue
     */
    constructor(
        recoveryScheduleRepository,
        outboxEventRepository,
        recoveryCaseService,
        recoveryScheduleQueue
    ) {
        this.recoveryScheduleRepository = recoveryScheduleRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.recoveryCaseService = recoveryCaseService;
        this.recoveryScheduleQueue = recoveryScheduleQueue;

        this._running = false;
        this._timer = null;
    }

    start(config = {}) {
        if (this._running) return;
        this._running = true;

        const { intervalMs = 60000, batchSize = 100, queueLookupConcurrency = 10 } = config;
        this.config = { intervalMs, batchSize, queueLookupConcurrency };

        console.log(`[RecoveryScheduleReconciler] Started. interval=${intervalMs}ms`);
        this._scheduleNext();
    }

    stop() {
        this._running = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        console.log('[RecoveryScheduleReconciler] Stopped.');
    }

    _scheduleNext() {
        if (!this._running) return;
        this._timer = setTimeout(async () => {
            try {
                await this.reconcile();
            } catch (err) {
                console.error('[RecoveryScheduleReconciler] Unexpected error during reconciliation:', err.message);
            } finally {
                this._scheduleNext();
            }
        }, this.config.intervalMs);
    }

    async reconcile() {
        const batchSize = this.config?.batchSize || 100;
        const schedules = await this.recoveryScheduleRepository.findScheduledForReconciliation(batchSize);

        if (schedules.length === 0) {
            return; // Nothing to reconcile
        }

        const scheduleIds = schedules.map(s => s.id);
        const latestOutboxEvents = await this.outboxEventRepository.findLatestByAggregateIds('RecoverySchedule', scheduleIds);

        const summary = {
            scanned: schedules.length,
            healthy: 0,
            pending: 0,
            repaired: 0,
            skipped: 0,
            unknown: 0,
            errors: 0,
            redisLookups: 0,
            redisLookupFailures: 0,
            durationMs: 0
        };

        const startTime = Date.now();

        const concurrency = this.config?.queueLookupConcurrency || 10;
        for (let i = 0; i < schedules.length; i += concurrency) {
            const chunk = schedules.slice(i, i + concurrency);
            await Promise.all(chunk.map(schedule => this._reconcileSchedule(schedule, latestOutboxEvents.get(schedule.id), summary)));
        }

        summary.durationMs = Date.now() - startTime;

        if (summary.repaired > 0 || summary.unknown > 0 || summary.errors > 0 || summary.pending > 0) {
            console.log(
                `[RecoveryScheduleReconciler] scanned=${summary.scanned} healthy=${summary.healthy} ` +
                `pending=${summary.pending} repaired=${summary.repaired} skipped=${summary.skipped} ` +
                `unknown=${summary.unknown} errors=${summary.errors} redisLookups=${summary.redisLookups} ` +
                `redisLookupFailures=${summary.redisLookupFailures} durationMs=${summary.durationMs} concurrency=${concurrency}`
            );
        }
    }

    /**
     * @param {Object} schedule 
     * @param {Object} outboxEvent 
     * @param {Object} summary 
     */
    async _reconcileSchedule(schedule, outboxEvent, summary) {
        try {
            if (!this.recoveryCaseService.isEligibleForScheduledExecution(schedule.recoveryCase?.status)) {
                summary.skipped++;
                return;
            }

            if (!outboxEvent) {
                summary.skipped++;
                return;
            }

            if (outboxEvent.status === 'PENDING') {
                summary.pending++;
                return;
            }

            const canonicalJobId = `recovery-schedule-${schedule.id}`;
            const legacyJobId = `outbox-${outboxEvent.id}`;

            const checkCanonical = await this._safeGetJob(canonicalJobId, summary);
            if (checkCanonical === 'UNKNOWN') {
                summary.unknown++;
                return;
            }
            if (checkCanonical === 'EXISTS') {
                summary.healthy++;
                return;
            }

            const checkLegacy = await this._safeGetJob(legacyJobId, summary);
            if (checkLegacy === 'UNKNOWN') {
                summary.unknown++;
                return;
            }
            if (checkLegacy === 'EXISTS') {
                summary.healthy++;
                return;
            }

            const { delayMinutes } = outboxEvent.payload;

            const now = Date.now();
            const executeAt = new Date(schedule.executeAt).getTime();
            const delayMs = Math.max(0, executeAt - now);

            await this.recoveryScheduleQueue.addScheduleJob(schedule.id, delayMs, canonicalJobId);

            console.log(`[RecoveryScheduleReconciler] scheduleId=${schedule.id} caseId=${schedule.recoveryCaseId} outboxStatus=${outboxEvent.status} lookupState=MISSING action=REPAIRED jobId=${canonicalJobId}`);
            summary.repaired++;
        } catch (err) {
            console.error(`[RecoveryScheduleReconciler] Error reconciling schedule ${schedule.id}:`, err.message);
            summary.errors++;
        }
    }

    /**
     * @param {string} jobId 
     * @param {Object} summary
     * @returns {Promise<'EXISTS'|'MISSING'|'UNKNOWN'>}
     */
    async _safeGetJob(jobId, summary) {
        summary.redisLookups++;
        try {
            const job = await this.recoveryScheduleQueue.getJob(jobId);
            return job ? 'EXISTS' : 'MISSING';
        } catch (err) {
            summary.redisLookupFailures++;
            return 'UNKNOWN';
        }
    }
}

export default RecoveryScheduleReconciler;
