-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "connectionId" UUID,
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "PaymentDowntime" ADD COLUMN     "connectionId" UUID,
ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_connectionId_idx" ON "Payment"("connectionId");

-- CreateIndex
CREATE INDEX "PaymentDowntime_userId_idx" ON "PaymentDowntime"("userId");

-- CreateIndex
CREATE INDEX "PaymentDowntime_connectionId_idx" ON "PaymentDowntime"("connectionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ConnectorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDowntime" ADD CONSTRAINT "PaymentDowntime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDowntime" ADD CONSTRAINT "PaymentDowntime_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ConnectorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
