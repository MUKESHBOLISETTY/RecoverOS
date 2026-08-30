const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

export class OutboxPublisher {
    /**
     * @param {import('../db/outbox/prisma-outbox-event.repository.js').PrismaOutboxEventRepository} outboxEventRepository
     * @param {import('../queue/recovery-schedule.queue.js').RecoveryScheduleQueue} recoveryScheduleQueue
     */
    constructor(outboxEventRepository, recoveryScheduleQueue) {
        if (!outboxEventRepository) throw new Error('OutboxPublisher: outboxEventRepository is required');
        if (!recoveryScheduleQueue) throw new Error('OutboxPublisher: recoveryScheduleQueue is required');
        this.outboxEventRepository = outboxEventRepository;
        this.recoveryScheduleQueue = recoveryScheduleQueue;
        this._timer = null;
        this._running = false;
    }

    start() {
        if (this._running) return;
        this._running = true;
        console.log('[OutboxPublisher] Started polling for pending outbox events.');
        this._schedule();
    }

    async stop() {
        this._running = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        console.log('[OutboxPublisher] Stopped.');
    }

    _schedule() {
        this._timer = setTimeout(async () => {
            try {
                await this._poll();
            } catch (err) {
                console.error('[OutboxPublisher] Poll error:', err.message);
            } finally {
                if (this._running) this._schedule();
            }
        }, POLL_INTERVAL_MS);
    }

    async _poll() {
        const events = await this.outboxEventRepository.findPending(MAX_ATTEMPTS, BATCH_SIZE);

        if (events.length === 0) return;
        console.log(`[OutboxPublisher] Processing ${events.length} pending outbox event(s).`);

        for (const event of events) {
            await this._publishEvent(event);
        }
    }

    /**
     * @param {Object} event - OutboxEvent record
     */
    async _publishEvent(event) {
        try {
            await this._dispatch(event);

            await this.outboxEventRepository.markPublished(event.id);

            console.log(`[OutboxPublisher] Published outbox event ${event.id} (${event.eventType}).`);
        } catch (err) {
            console.error(`[OutboxPublisher] Failed to publish event ${event.id}:`, err.message);

            const nextAttempts = event.attempts + 1;
            const nextStatus = nextAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

            await this.outboxEventRepository.updateStatus(event.id, nextStatus, nextAttempts, err.message);
        }
    }

    /**
     * @param {Object} event - OutboxEvent record
     */
    async _dispatch(event) {
        if (event.eventType === 'RECOVERY_SCHEDULE_CREATED') {
            const { scheduleId, delayMinutes } = event.payload;
            const delayMs = delayMinutes * 60 * 1000;
            const canonicalJobId = `recovery-schedule-${scheduleId}`;

            await this.recoveryScheduleQueue.addScheduleJob(scheduleId, delayMs, canonicalJobId);
            return;
        }

        console.warn(`[OutboxPublisher] Unknown eventType "${event.eventType}" — skipping dispatch.`);
    }
}

export default OutboxPublisher;
