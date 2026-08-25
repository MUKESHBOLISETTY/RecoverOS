-- CreateEnum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'CANCELLED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "agentVersion" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID,
    "eventType" TEXT NOT NULL,
    "provider" TEXT,
    "externalEventId" TEXT,
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

-- CreateIndex
CREATE INDEX "AgentExecution_userId_status_idx" ON "AgentExecution"("userId", "status");

-- CreateIndex
CREATE INDEX "AgentExecution_agentId_status_idx" ON "AgentExecution"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentExecution_eventType_idx" ON "AgentExecution"("eventType");

-- CreateIndex
CREATE INDEX "AgentExecution_recoveryCaseId_idx" ON "AgentExecution"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "AgentExecution_externalEventId_idx" ON "AgentExecution"("externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExecution_agentId_eventId_key" ON "AgentExecution"("agentId", "eventId");

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
