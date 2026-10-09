-- DropIndex
DROP INDEX "zoho_mail_tokens_userId_key";

-- DropIndex
DROP INDEX "webhook_inbox_provider_eventKey_key";

-- AlterTable
ALTER TABLE "webhook_inbox" ADD COLUMN     "integrationId" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "payloadHash" TEXT,
ADD COLUMN     "processingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "zoho_mail_tokens_tenantId_userId_key" ON "zoho_mail_tokens"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_inbox_integrationId_eventKey_key" ON "webhook_inbox"("integrationId", "eventKey");

-- AddForeignKey
ALTER TABLE "webhook_inbox" ADD CONSTRAINT "webhook_inbox_integrationId_tenantId_fkey" FOREIGN KEY ("integrationId", "tenantId") REFERENCES "tenant_integrations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
