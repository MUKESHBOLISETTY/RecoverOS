import { BaseWorkerService } from './base-worker.service.js';
import crypto from 'crypto';

export class RecoveryScheduleWorker extends BaseWorkerService {
    /**
     * @param {import('../db/schedule/prisma-recovery-schedule.repository.js').PrismaRecoveryScheduleRepository} recoveryScheduleRepository
     * @param {import('../db/recovery/prisma-recovery-case.repository.js').PrismaRecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../db/agent/prisma-agent-execution.repository.js').PrismaAgentExecutionRepository} agentExecutionRepository
     * @param {import('../../domain/recovery/recovery-case.service.js').RecoveryCaseService} recoveryCaseService
     * @param {import('./agent-execution.queue.js').AgentExecutionQueue} agentExecutionQueue
     * @param {import('../../domain/recovery/verification/recovery-verification.service.js').RecoveryVerificationService} recoveryVerificationService
     * @param {import('../../domain/agent/policy/recovery-policy.validator.js').RecoveryPolicyValidator} recoveryPolicyValidator
     */
    constructor(
        recoveryScheduleRepository,
        recoveryCaseRepository,
        agentExecutionRepository,
        recoveryCaseService,
        agentExecutionQueue,
        recoveryVerificationService,
        recoveryPolicyValidator
    ) {
        super('recovery-schedule');
        this.recoveryScheduleRepository = recoveryScheduleRepository;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.agentExecutionRepository = agentExecutionRepository;
        this.recoveryCaseService = recoveryCaseService;
        this.agentExecutionQueue = agentExecutionQueue;
        this.recoveryVerificationService = recoveryVerificationService;
        this.recoveryPolicyValidator = recoveryPolicyValidator;
    }

    /**
     * @param {import('bullmq').Job} job
     */
    async process(job) {
        if (job.name !== 'fire-recovery-schedule') return;

        const { scheduleId } = job.data;
        console.log(`[RecoveryScheduleWorker] Processing schedule ${scheduleId}`);

        const schedule = await this.recoveryScheduleRepository.findById(scheduleId);

        if (!schedule) {
            console.warn(`[RecoveryScheduleWorker] Schedule ${scheduleId} not found. Skipping.`);
            return;
        }

        const recoveryCase = await this.recoveryCaseRepository.findById(schedule.recoveryCaseId);

        if (!recoveryCase) {
            console.warn(`[RecoveryScheduleWorker] RecoveryCase ${schedule.recoveryCaseId} not found. Skipping.`);
            return;
        }

        if (!this.recoveryCaseService.isEligibleForScheduledExecution(recoveryCase.status)) {
            console.log(`[RecoveryScheduleWorker] Case ${recoveryCase.id} has status "${recoveryCase.status}" — not eligible. Cancelling schedule.`);
            await this.recoveryScheduleRepository.cancel(scheduleId);
            return;
        }

        const origExecution = schedule.createdByExecutionId
            ? await this.agentExecutionRepository.findById(schedule.createdByExecutionId)
            : null;

        if (!origExecution) {
            console.error(`[RecoveryScheduleWorker] Cannot find original execution for schedule ${scheduleId}. Aborting.`);
            await this.recoveryScheduleRepository.markFailed(scheduleId);
            return;
        }

        const verificationResult = await this.recoveryVerificationService.verify(recoveryCase, { userId: origExecution.userId });
        console.log(`[RecoveryScheduleWorker] Fresh verification for schedule ${scheduleId}: ${verificationResult.state}`);

        const policyResult = this.recoveryPolicyValidator.getAllowedActionsFromVerification(verificationResult);
        const safeActions = policyResult.allowedActions || [];

        if (verificationResult.state === 'RECOVERED' || verificationResult.state === 'BLOCKED') {
            console.log(`[RecoveryScheduleWorker] Case ${recoveryCase.id} is ${verificationResult.state}. Cancelling schedule.`);
            await this.recoveryScheduleRepository.cancel(scheduleId);
            return;
        }

        if (verificationResult.state === 'UNKNOWN' && safeActions.length === 0) {
            console.log(`[RecoveryScheduleWorker] Case ${recoveryCase.id} is UNKNOWN with no safe actions. Pausing automation by cancelling schedule.`);
            await this.recoveryScheduleRepository.cancel(scheduleId);
            return;
        }

        await this.recoveryCaseRepository.update(recoveryCase.id, {
            contextSnapshot: {
                ...recoveryCase.contextSnapshot,
                verificationResult
            }
        });

        const newExecutionId = crypto.randomUUID();

        const updateResult = await this.recoveryScheduleRepository.atomicFire(scheduleId, newExecutionId);

        if (updateResult === 0) {
            console.log(`[RecoveryScheduleWorker] Schedule ${scheduleId} was already fired or cancelled. Skipping.`);
            return;
        }

        const newExecution = await this.agentExecutionRepository.create({
            id: newExecutionId,
            agentId: origExecution.agentId,
            agentVersion: origExecution.agentVersion,
            userId: origExecution.userId,
            triggerType: 'recovery.schedule',
            triggerId: scheduleId,
            provider: 'system.scheduled',
            status: 'QUEUED',
            recoveryCaseId: recoveryCase.id,
            inputContext: {
                scheduledReason: schedule.reason,
                scheduleId,
                verificationResult
            }
        });

        await this.agentExecutionQueue.addJob(
            'execute-agent',
            { executionId: newExecution.id },
            {
                jobId: `agent-execution-${newExecution.id}`,
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
            }
        );

        console.log(`[RecoveryScheduleWorker] Fired schedule ${scheduleId} → new execution ${newExecution.id}`);
    }
}

export default RecoveryScheduleWorker;
