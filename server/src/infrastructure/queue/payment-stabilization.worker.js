import { BaseWorkerService } from './base-worker.service.js';

export class PaymentStabilizationWorker extends BaseWorkerService {
    /**
     * @param {import('../../domain/recovery/verification/recovery-verification.service.js').RecoveryVerificationService} verificationService
     * @param {import('../../domain/agent/policy/recovery-policy.validator.js').RecoveryPolicyValidator} policyValidator
     * @param {import('../../domain/agent/agent-execution.service.js').AgentExecutionService} agentExecutionService
     * @param {import('../../domain/recovery/recovery-case.repository.js').RecoveryCaseRepository} recoveryCaseRepository
     * @param {import('../../domain/agent/agent-trigger.service.js').AgentTriggerService} agentTriggerService
     * @param {import('../../domain/payment/payment.repository.js').PaymentRepository} paymentRepository
     */
    constructor(verificationService, policyValidator, agentExecutionService, recoveryCaseRepository, agentTriggerService, paymentRepository) {
        super('payment-stabilization', { concurrency: 10 });

        this.worker.on('failed', (job, err) => {
            console.error(`[PaymentStabilizationWorker] Job ${job.id} failed:`, err);
        });

        this.verificationService = verificationService;
        this.policyValidator = policyValidator;
        this.agentExecutionService = agentExecutionService;
        this.recoveryCaseRepository = recoveryCaseRepository;
        this.agentTriggerService = agentTriggerService;
        this.paymentRepository = paymentRepository;
    }

    async process(job) {
        const { recoveryCaseId, paymentId } = job.data;
        console.log(`[PaymentStabilizationWorker] Processing stabilization for case ${recoveryCaseId}, payment ${paymentId}`);

        const recoveryCase = await this.recoveryCaseRepository.findById(recoveryCaseId);
        if (!recoveryCase) {
            throw new Error(`RecoveryCase ${recoveryCaseId} not found`);
        }

        if (recoveryCase.status !== 'OPEN' && recoveryCase.status !== 'WAITING') {
            console.log(`[PaymentStabilizationWorker] Case ${recoveryCaseId} is already in status ${recoveryCase.status}, skipping execution.`);
            return;
        }

        const verificationResult = await this.verificationService.verify(recoveryCase);
        console.log(`[PaymentStabilizationWorker] Case ${recoveryCaseId} verified as ${verificationResult.state}`);

        await this.recoveryCaseRepository.update(recoveryCaseId, {
            contextSnapshot: {
                ...recoveryCase.contextSnapshot,
                verificationResult
            }
        });

        const payment = await this.paymentRepository.findById(paymentId);
        if (!payment || !payment.userId) {
            console.log(`[PaymentStabilizationWorker] Missing payment/userId for payment ${paymentId}, skipping.`);
            return;
        }

        const triggeredAgents = await this.agentTriggerService.evaluateTriggers(payment.userId, 'payment.failed', { payload: { payment: { entity: payment } } });

        for (const agent of triggeredAgents) {
            const policyResult = this.policyValidator.getAllowedActionsFromVerification(verificationResult);
            const safeActions = policyResult.allowedActions || [];

            if (verificationResult.state === 'UNKNOWN' && safeActions.length === 0) {
                console.log(`[PaymentStabilizationWorker] Execution safely paused for Agent ${agent.id} on Case ${recoveryCaseId} due to UNKNOWN state with no safe actions.`);
                continue;
            }

            if (verificationResult.state === 'RECOVERED' || verificationResult.state === 'BLOCKED') {
                console.log(`[PaymentStabilizationWorker] Stopping automation for Agent ${agent.id} on Case ${recoveryCaseId}, state: ${verificationResult.state}`);
                continue;
            }

            const execution = await this.agentExecutionService.createExecution({
                agent,
                userId: payment.userId,
                triggerType: 'payment.failed',
                triggerId: payment.id,
                eventType: 'payment.failed',
                inputContext: {
                    paymentId,
                    recoveryCaseId,
                    verificationResult
                }
            });

            await this.agentExecutionService.enqueueExecution(execution);
            console.log(`[PaymentStabilizationWorker] Enqueued AgentExecution ${execution.id} for Case ${recoveryCaseId}`);
        }
    }
}
