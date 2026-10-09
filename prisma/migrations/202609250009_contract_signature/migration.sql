-- CreateEnum
CREATE TYPE "ContractSignatureAttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'UNKNOWN', 'FAILED');

-- CreateTable
CREATE TABLE "contract_signature_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "ContractSignatureAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "externalId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_signature_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_signature_attempts_contractId_key" ON "contract_signature_attempts"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signature_attempts_eventId_key" ON "contract_signature_attempts"("eventId");

-- CreateIndex
CREATE INDEX "contract_signature_attempts_tenantId_status_idx" ON "contract_signature_attempts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signature_attempts_id_tenantId_key" ON "contract_signature_attempts"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "contract_signature_attempts" ADD CONSTRAINT "contract_signature_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_attempts" ADD CONSTRAINT "contract_signature_attempts_contractId_tenantId_fkey" FOREIGN KEY ("contractId", "tenantId") REFERENCES "contracts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_attempts" ADD CONSTRAINT "contract_signature_attempts_integrationId_tenantId_fkey" FOREIGN KEY ("integrationId", "tenantId") REFERENCES "tenant_integrations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contract_signature_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_signature_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contract_signature_attempts"
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
