/*
  Warnings:

  - You are about to drop the `_AgentToConnectorCredential` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AgentToConnectorCredential" DROP CONSTRAINT "_AgentToConnectorCredential_A_fkey";

-- DropForeignKey
ALTER TABLE "_AgentToConnectorCredential" DROP CONSTRAINT "_AgentToConnectorCredential_B_fkey";

-- DropTable
DROP TABLE "_AgentToConnectorCredential";

-- CreateTable
CREATE TABLE "AgentConnector" (
    "agentId" UUID NOT NULL,
    "connectorId" UUID NOT NULL,
    "connectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConnector_pkey" PRIMARY KEY ("agentId","connectorId")
);

-- CreateIndex
CREATE INDEX "AgentConnector_agentId_idx" ON "AgentConnector"("agentId");

-- CreateIndex
CREATE INDEX "AgentConnector_connectorId_idx" ON "AgentConnector"("connectorId");

-- AddForeignKey
ALTER TABLE "AgentConnector" ADD CONSTRAINT "AgentConnector_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnector" ADD CONSTRAINT "AgentConnector_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "ConnectorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
