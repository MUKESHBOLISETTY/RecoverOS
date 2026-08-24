/*
  Warnings:

  - You are about to drop the column `connections` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConnectorCategory" AS ENUM ('DATA_SOURCE', 'COMMUNICATION_SOURCE');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "connections";

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

-- CreateIndex
CREATE INDEX "ConnectorCredential_userId_idx" ON "ConnectorCredential"("userId");

-- CreateIndex
CREATE INDEX "ConnectorCredential_category_idx" ON "ConnectorCredential"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorCredential_userId_connectorId_name_key" ON "ConnectorCredential"("userId", "connectorId", "name");

-- AddForeignKey
ALTER TABLE "ConnectorCredential" ADD CONSTRAINT "ConnectorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
