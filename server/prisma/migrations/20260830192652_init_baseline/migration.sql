-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "PaymentDowntimeStatus" AS ENUM ('SCHEDULED', 'STARTED', 'UPDATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymentFailureCorrelationStatus" AS ENUM ('CANDIDATE', 'MATCHED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PaymentFailureCorrelationConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PaymentFailureCorrelationMatchType" AS ENUM ('TIME_OVERLAP', 'METHOD_MATCH', 'BANK_MATCH', 'ISSUER_MATCH', 'NETWORK_MATCH', 'PSP_MATCH', 'VPA_MATCH', 'MULTI_SIGNAL');

-- CreateEnum
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED', 'ESCALATED', 'RECOVERED', 'STOPPED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecoveryCaseType" AS ENUM ('PAYMENT_FAILURE', 'CART_ABANDONMENT', 'SUBSCRIPTION_DUE');

-- CreateEnum
CREATE TYPE "RecoveryActionType" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'VOICE', 'IN_APP', 'INTERNAL_SYSTEM_ACTION');

-- CreateEnum
CREATE TYPE "ConnectorCategory" AS ENUM ('DATA_SOURCE', 'COMMUNICATION_SOURCE');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "RecoveryScheduleStatus" AS ENUM ('SCHEDULED', 'FIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "userId" UUID,
    "connectionId" UUID,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "bank" TEXT,
    "vpa" TEXT,
    "email" TEXT,
    "contact" TEXT,
    "errorCode" TEXT,
    "errorDescription" TEXT,
    "errorSource" TEXT,
    "errorStep" TEXT,
    "errorReason" TEXT,
    "acquirerData" JSONB,
    "notes" JSONB,
    "paymentCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "customerId" TEXT,
    "captured" BOOLEAN,
    "description" TEXT,
    "international" BOOLEAN,
    "tokenId" TEXT,
    "offerId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDowntime" (
    "id" UUID NOT NULL,
    "razorpayId" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'payment.downtime',
    "userId" UUID,
    "connectionId" UUID,
    "method" TEXT NOT NULL,
    "begin" TIMESTAMPTZ(3) NOT NULL,
    "end" TIMESTAMPTZ(3),
    "status" "PaymentDowntimeStatus" NOT NULL,
    "scheduled" BOOLEAN NOT NULL,
    "severity" TEXT,
    "instrument" JSONB,
    "instrumentSchema" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rawPayload" JSONB,

    CONSTRAINT "PaymentDowntime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFailureCorrelation" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "downtimeId" UUID NOT NULL,
    "status" "PaymentFailureCorrelationStatus" NOT NULL DEFAULT 'CANDIDATE',
    "confidence" "PaymentFailureCorrelationConfidence" NOT NULL,
    "explanation" TEXT,
    "score" DECIMAL(5,4),
    "matchedSignals" JSONB,
    "paymentContext" JSONB,
    "downtimeContext" JSONB,
    "correlatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentFailureCorrelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" UUID NOT NULL,
    "type" "RecoveryCaseType" NOT NULL DEFAULT 'PAYMENT_FAILURE',
    "subjectType" TEXT,
    "subjectId" TEXT,
    "activeSkillId" TEXT,
    "activeSkillVersion" INTEGER,
    "paymentId" UUID,
    "cartId" UUID,
    "correlationId" UUID,
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'OPEN',
    "contextSnapshot" JSONB,
    "strategyApplied" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAction" (
    "id" UUID NOT NULL,
    "recoveryCaseId" UUID NOT NULL,
    "type" "RecoveryActionType" NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" UUID NOT NULL,
    "recoveryCaseId" UUID NOT NULL,
    "successful" BOOLEAN NOT NULL,
    "amountRecovered" BIGINT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "actor" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceName" TEXT NOT NULL DEFAULT 'Unknown Device',
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorCredential" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "connectorId" TEXT NOT NULL,
    "category" "ConnectorCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConnectorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "purpose" TEXT NOT NULL,
    "triggers" TEXT[],
    "requiredCapabilities" TEXT[],
    "rules" JSONB NOT NULL,
    "actions" TEXT[],
    "stopConditions" TEXT[],
    "spec" JSONB NOT NULL,
    "installedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "agentVersion" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerId" UUID,
    "externalTriggerId" TEXT,
    "provider" TEXT,
    "status" "AgentExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "recoveryCaseId" UUID,
    "inputContext" JSONB,
    "decision" JSONB,
    "result" JSONB,
    "error" JSONB,
    "jobId" TEXT,
    "queuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConnector" (
    "agentId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "connectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConnector_pkey" PRIMARY KEY ("agentId","connectorId")
);

-- CreateTable
CREATE TABLE "RecoverySchedule" (
    "id" UUID NOT NULL,
    "recoveryCaseId" UUID NOT NULL,
    "executeAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "status" "RecoveryScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "jobId" TEXT,
    "createdByExecutionId" UUID,
    "triggeredExecutionId" UUID,
    "firedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecoverySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_idempotencyKey_key" ON "WebhookEvent"("source", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_connectionId_idx" ON "Payment"("connectionId");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_contact_status_idx" ON "Payment"("contact", "status");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_errorSource_idx" ON "Payment"("errorSource");

-- CreateIndex
CREATE INDEX "Payment_errorReason_idx" ON "Payment"("errorReason");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDowntime_razorpayId_key" ON "PaymentDowntime"("razorpayId");

-- CreateIndex
CREATE INDEX "PaymentDowntime_userId_idx" ON "PaymentDowntime"("userId");

-- CreateIndex
CREATE INDEX "PaymentDowntime_connectionId_idx" ON "PaymentDowntime"("connectionId");

-- CreateIndex
CREATE INDEX "PaymentDowntime_method_idx" ON "PaymentDowntime"("method");

-- CreateIndex
CREATE INDEX "PaymentDowntime_status_idx" ON "PaymentDowntime"("status");

-- CreateIndex
CREATE INDEX "PaymentDowntime_begin_idx" ON "PaymentDowntime"("begin");

-- CreateIndex
CREATE INDEX "PaymentDowntime_end_idx" ON "PaymentDowntime"("end");

-- CreateIndex
CREATE INDEX "PaymentDowntime_method_status_idx" ON "PaymentDowntime"("method", "status");

-- CreateIndex
CREATE INDEX "PaymentFailureCorrelation_paymentId_idx" ON "PaymentFailureCorrelation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentFailureCorrelation_downtimeId_idx" ON "PaymentFailureCorrelation"("downtimeId");

-- CreateIndex
CREATE INDEX "PaymentFailureCorrelation_status_idx" ON "PaymentFailureCorrelation"("status");

-- CreateIndex
CREATE INDEX "PaymentFailureCorrelation_confidence_idx" ON "PaymentFailureCorrelation"("confidence");

-- CreateIndex
CREATE INDEX "PaymentFailureCorrelation_correlatedAt_idx" ON "PaymentFailureCorrelation"("correlatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFailureCorrelation_paymentId_downtimeId_key" ON "PaymentFailureCorrelation"("paymentId", "downtimeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAction_idempotencyKey_key" ON "RecoveryAction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_recoveryCaseId_key" ON "Outcome"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");

-- CreateIndex
CREATE INDEX "ConnectorCredential_userId_idx" ON "ConnectorCredential"("userId");

-- CreateIndex
CREATE INDEX "ConnectorCredential_category_idx" ON "ConnectorCredential"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorCredential_userId_connectorId_name_key" ON "ConnectorCredential"("userId", "connectorId", "name");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_userId_status_idx" ON "Agent"("userId", "status");

-- CreateIndex
CREATE INDEX "AgentExecution_userId_status_idx" ON "AgentExecution"("userId", "status");

-- CreateIndex
CREATE INDEX "AgentExecution_agentId_status_idx" ON "AgentExecution"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentExecution_triggerType_idx" ON "AgentExecution"("triggerType");

-- CreateIndex
CREATE INDEX "AgentExecution_recoveryCaseId_idx" ON "AgentExecution"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "AgentExecution_externalTriggerId_idx" ON "AgentExecution"("externalTriggerId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExecution_agentId_triggerType_triggerId_key" ON "AgentExecution"("agentId", "triggerType", "triggerId");

-- CreateIndex
CREATE INDEX "AgentConnector_agentId_idx" ON "AgentConnector"("agentId");

-- CreateIndex
CREATE INDEX "AgentConnector_connectorId_idx" ON "AgentConnector"("connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoverySchedule_triggeredExecutionId_key" ON "RecoverySchedule"("triggeredExecutionId");

-- CreateIndex
CREATE INDEX "RecoverySchedule_recoveryCaseId_status_idx" ON "RecoverySchedule"("recoveryCaseId", "status");

-- CreateIndex
CREATE INDEX "RecoverySchedule_executeAt_status_idx" ON "RecoverySchedule"("executeAt", "status");

-- CreateIndex
CREATE INDEX "RecoverySchedule_jobId_idx" ON "RecoverySchedule"("jobId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ConnectorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDowntime" ADD CONSTRAINT "PaymentDowntime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDowntime" ADD CONSTRAINT "PaymentDowntime_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ConnectorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFailureCorrelation" ADD CONSTRAINT "PaymentFailureCorrelation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFailureCorrelation" ADD CONSTRAINT "PaymentFailureCorrelation_downtimeId_fkey" FOREIGN KEY ("downtimeId") REFERENCES "PaymentDowntime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_correlationId_fkey" FOREIGN KEY ("correlationId") REFERENCES "PaymentFailureCorrelation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorCredential" ADD CONSTRAINT "ConnectorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnector" ADD CONSTRAINT "AgentConnector_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnector" ADD CONSTRAINT "AgentConnector_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "ConnectorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoverySchedule" ADD CONSTRAINT "RecoverySchedule_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
