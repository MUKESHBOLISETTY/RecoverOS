/*
  Warnings:

  - You are about to drop the column `connectionIds` on the `Agent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "connectionIds";

-- CreateTable
CREATE TABLE "_AgentToConnectorCredential" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AgentToConnectorCredential_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AgentToConnectorCredential_B_index" ON "_AgentToConnectorCredential"("B");

-- AddForeignKey
ALTER TABLE "_AgentToConnectorCredential" ADD CONSTRAINT "_AgentToConnectorCredential_A_fkey" FOREIGN KEY ("A") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToConnectorCredential" ADD CONSTRAINT "_AgentToConnectorCredential_B_fkey" FOREIGN KEY ("B") REFERENCES "ConnectorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
