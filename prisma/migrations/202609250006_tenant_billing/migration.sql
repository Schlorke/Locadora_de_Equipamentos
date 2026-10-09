-- DropIndex
DROP INDEX "quotes_quoteCode_key";

-- DropIndex
DROP INDEX "payment_attempts_provider_externalId_key";

-- AlterTable
ALTER TABLE "payment_attempts" ADD COLUMN     "integrationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quotes_tenantId_quoteCode_key" ON "quotes"("tenantId", "quoteCode");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_integrationId_externalId_key" ON "payment_attempts"("integrationId", "externalId");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "tenant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
