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
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('OPEN', 'WAITING', 'RECOVERED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecoveryActionType" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');

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
    "paymentId" UUID NOT NULL,
    "correlationId" UUID,
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'OPEN',
    "paymentSnapshot" JSONB,
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

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_idempotencyKey_key" ON "WebhookEvent"("source", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

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
CREATE UNIQUE INDEX "Outcome_recoveryCaseId_key" ON "Outcome"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

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
