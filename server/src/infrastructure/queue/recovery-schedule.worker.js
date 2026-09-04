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
     * @param {import('../../domain/agent/execution/trigger-context.resolver.js').TriggerContextResolver} triggerContextResolver
     * @param {import('../db/agent/prisma-agent.repository.js').PrismaAgentRepository} agentRepository
     */
    constructor(
        recoveryScheduleRepository,
        recoveryCaseRepository,
        agentExecutionRepository,
        recoveryCaseService,
        agentExecutionQueue,
        recoveryVerificationService,
        recoveryPolicyValidator,
        triggerContextResolver,
        agentRepository
    ) {
        super('recovery-schedule');
        this.recoveryScheduleRepository = recoveryScheduleRepository;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.agentExecutionRepository = agentExecutionRepository;
        this.recoveryCaseService = recoveryCaseService;
        this.agentExecutionQueue = agentExecutionQueue;
        this.recoveryVerificationService = recoveryVerificationService;
        this.recoveryPolicyValidator = recoveryPolicyValidator;
        this.triggerContextResolver = triggerContextResolver;
        this.agentRepository = agentRepository;
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

        if (!recoveryCase.activeSkillId) {
            console.log(`[RecoveryScheduleWorker] Case ${recoveryCase.id} missing activeSkillId. Attempting backfill.`);
            try {
                const agentConfig = await this.agentRepository.findById(origExecution.agentId);
                if (agentConfig) {
                    const mockExecution = {
                        triggerType: 'recovery.schedule',
                        inputContext: { recoveryCaseId: recoveryCase.id }
                    };
                    const resolvedContext = await this.triggerContextResolver.resolveContext(
                        mockExecution,
                        agentConfig
                    );
                    if (resolvedContext && resolvedContext.recoveryCase && resolvedContext.recoveryCase.activeSkillId) {
                        recoveryCase.activeSkillId = resolvedContext.recoveryCase.activeSkillId;
                        recoveryCase.activeSkillVersion = resolvedContext.recoveryCase.activeSkillVersion;
                        console.log(`[RecoveryScheduleWorker] Successfully backfilled activeSkillId ${recoveryCase.activeSkillId} for Case ${recoveryCase.id}.`);
                    }
                }
            } catch (err) {
                console.error(`[RecoveryScheduleWorker] Error attempting backfill for Case ${recoveryCase.id}:`, err);
            }

            if (!recoveryCase.activeSkillId) {
                console.error(`[RecoveryScheduleWorker] Case ${recoveryCase.id} still missing activeSkillId after backfill attempt. State error. Aborting.`);
                await this.recoveryScheduleRepository.markFailed(scheduleId);
                return;
            }
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

        if (verificationResult.state === 'VERIFICATION_UNAVAILABLE') {
            console.log(`[RecoveryScheduleWorker] Case ${recoveryCase.id} verification unavailable. Failing job to trigger retry.`);
            throw new Error(`Verification unavailable: ${verificationResult.evidence?.reason || verificationResult.evidence?.error || 'Unknown error'}`);
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
