import { RecoveryEventPublisherInterface } from '../../domain/recovery/recovery-event-publisher.interface.js';
import crypto from 'crypto';

export class RecoveryEventPublisher extends RecoveryEventPublisherInterface {
    /**
     * @param {import('./base-pubsub.service.js').BasePubSubService} pubsubService
     */
    constructor(pubsubService) {
        super();
        this.pubsub = pubsubService;
    }

    _generateEventId() {
        return crypto.randomUUID();
    }

    _getChannel(userId) {
        return `recoveros:recovery-events:user:${userId}`;
    }

    _sanitizePayload(payload) {
        if (!payload) return undefined;
        const safePayload = JSON.parse(JSON.stringify(payload));

        const removeSensitiveKeys = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;

            const sensitiveKeys = ['accessToken', 'refreshToken', 'secret', 'password', 'cvv', 'cardNumber', 'hmac', 'token', 'key'];
            for (const key in obj) {
                if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                    delete obj[key];
                } else if (typeof obj[key] === 'object') {
                    removeSensitiveKeys(obj[key]);
                }
            }
        };

        removeSensitiveKeys(safePayload);
        return safePayload;
    }

    async _publish(type, caseId, recoveryType, provider, userId, step, additionalData = {}) {
        if (!userId) {
            console.warn(`[RecoveryEventPublisher] Cannot publish event ${type} for case ${caseId} without a trusted userId.`);
            return;
        }

        const event = {
            eventId: this._generateEventId(),
            type,
            caseId,
            recoveryType,
            provider,
            step,
            timestamp: new Date().toISOString(),
            ...this._sanitizePayload(additionalData)
        };

        const channel = this._getChannel(userId);
        try {
            console.log(`[RecoveryEventPublisher] Publishing ${type} to ${channel} for case ${caseId} (userId: ${userId})`);
            const numClients = await this.pubsub.publish(channel, JSON.stringify(event));
            console.log(`[RecoveryEventPublisher] Publish succeeded for ${type} (clients: ${numClients})`);
        } catch (error) {
            console.error(`[RecoveryEventPublisher] Best-effort publish failed for ${type} (case: ${caseId}, channel: ${channel}):`, error.message);
        }
    }

    async publishCaseCreated(caseId, recoveryType, provider, userId) {
        return this._publish('RECOVERY_CASE_CREATED', caseId, recoveryType, provider, userId, 'INITIALIZATION');
    }

    async publishCaseStatusChanged(caseId, recoveryType, provider, status, userId) {
        return this._publish('RECOVERY_CASE_STATUS_CHANGED', caseId, recoveryType, provider, userId, 'STATUS_UPDATE', { status });
    }

    async publishVerificationStarted(caseId, recoveryType, provider, userId) {
        return this._publish('RECOVERY_VERIFICATION_STARTED', caseId, recoveryType, provider, userId, 'VERIFICATION');
    }

    async publishVerificationCompleted(caseId, recoveryType, provider, verificationResult, userId) {
        return this._publish('RECOVERY_VERIFICATION_COMPLETED', caseId, recoveryType, provider, userId, 'VERIFICATION', {
            status: verificationResult?.state
        });
    }

    async publishAgentStarted(caseId, recoveryType, provider, executionId, userId) {
        return this._publish('RECOVERY_AGENT_STARTED', caseId, recoveryType, provider, userId, 'AGENT_EXECUTION', { executionId });
    }

    async publishActionStarted(caseId, recoveryType, provider, action, userId) {
        return this._publish('RECOVERY_ACTION_STARTED', caseId, recoveryType, provider, userId, 'ACTION_EXECUTION', { action });
    }

    async publishActionCompleted(caseId, recoveryType, provider, action, result, userId) {
        return this._publish('RECOVERY_ACTION_COMPLETED', caseId, recoveryType, provider, userId, 'ACTION_EXECUTION', { action, result });
    }

    async publishActionBlocked(caseId, recoveryType, provider, action, reason, userId) {
        return this._publish('RECOVERY_ACTION_BLOCKED', caseId, recoveryType, provider, userId, 'ACTION_EXECUTION', { action, reason });
    }

    async publishCaseRecovered(caseId, recoveryType, provider, userId) {
        return this._publish('RECOVERY_CASE_RECOVERED', caseId, recoveryType, provider, userId, 'COMPLETION', { status: 'RECOVERED' });
    }

    async publishCaseFailed(caseId, recoveryType, provider, userId) {
        return this._publish('RECOVERY_CASE_FAILED', caseId, recoveryType, provider, userId, 'COMPLETION', { status: 'FAILED' });
    }

    async publishPaymentAttemptFailed(caseId, recoveryType, provider, userId, paymentId) {
        return this._publish('RECOVERY_PAYMENT_ATTEMPT_FAILED', caseId, recoveryType, provider, userId, 'PAYMENT_EVENT', { paymentId });
    }
}
