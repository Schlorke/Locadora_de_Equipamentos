BEGIN;

DO $$ BEGIN
 IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.tenant_integrations'::regclass) THEN RAISE EXCEPTION 'Preflight credentialsRef: global table required. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030105_payment_accounts_vault then pnpm exec prisma migrate deploy.'; END IF;
 IF EXISTS(SELECT 1 FROM tenant_integrations WHERE "credentialsRef" IS NULL OR "credentialsRef" !~ '^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$') THEN RAISE EXCEPTION 'Preflight credentialsRef: invalid environment reference. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030105_payment_accounts_vault then pnpm exec prisma migrate deploy.'; END IF;
 IF EXISTS(SELECT 1 FROM tenant_integrations WHERE provider='ASAAS' AND status<>'DISABLED' GROUP BY "tenantId" HAVING count(*)>1) THEN RAISE EXCEPTION 'Preflight single_asaas: multiple enabled integrations. Reconcile with approval. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030105_payment_accounts_vault then pnpm exec prisma migrate deploy.'; END IF;
END $$;
CREATE TYPE "PaymentAccountMode" AS ENUM ('ASAAS_SUBACCOUNT', 'ASAAS_CONNECTED_ACCOUNT');

CREATE TYPE "SubaccountModel" AS ENUM ('STANDARD', 'BAAS');

CREATE TYPE "PaymentAccountStatus" AS ENUM ('DRAFT', 'PROVISIONING', 'UNKNOWN', 'KEY_RECOVERY_REQUIRED', 'AWAITING_OWNER', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESTRICTED', 'BLOCKED', 'DISCONNECTED');

CREATE TYPE "CredentialSource" AS ENUM ('ENV_REF', 'VAULT');

CREATE TYPE "SecretPurpose" AS ENUM ('ASAAS_API_KEY', 'PROVIDER_API_KEY', 'PROVIDER_SIGNING_SECRET', 'PROVIDER_VERIFY_TOKEN');

CREATE TYPE "SecretState" AS ENUM ('PENDING', 'ACTIVE', 'PREVIOUS', 'RETIRED', 'DESTROYED');

CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'SUBMITTING', 'SUBMITTED', 'DONE', 'REFUSED', 'FAILED');

ALTER TABLE "tenant_integrations" ADD COLUMN     "credentialSource" "CredentialSource" NOT NULL DEFAULT 'ENV_REF',
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "webhookTokenHash" TEXT,
ADD COLUMN     "webhookTokenPreviousHash" TEXT,
ADD COLUMN     "webhookTokenPreviousUntil" TIMESTAMP(3),
ALTER COLUMN "credentialsRef" DROP NOT NULL;

CREATE TABLE "payment_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "mode" "PaymentAccountMode" NOT NULL,
    "subaccountModel" "SubaccountModel",
    "status" "PaymentAccountStatus" NOT NULL DEFAULT 'DRAFT',
    "environment" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "walletId" TEXT,
    "incomeRange" TEXT,
    "commercialInfoStatus" TEXT,
    "bankAccountInfoStatus" TEXT,
    "documentationStatus" TEXT,
    "generalStatus" TEXT,
    "commercialInfoExpiresAt" TIMESTAMP(3),
    "commercialInfoExpired" BOOLEAN NOT NULL DEFAULT false,
    "keyIdleExpiresAt" TIMESTAMP(3),
    "lastKeyUseAt" TIMESTAMP(3),
    "healthIssue" TEXT,
    "provisioningAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "requestedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_secrets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "purpose" "SecretPurpose" NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "SecretState" NOT NULL DEFAULT 'PENDING',
    "environment" TEXT,
    "kekProvider" TEXT NOT NULL,
    "kekId" TEXT NOT NULL,
    "wrappedDek" BYTEA,
    "iv" BYTEA,
    "ciphertext" BYTEA,
    "authTag" BYTEA,
    "aadVersion" INTEGER NOT NULL DEFAULT 1,
    "fingerprint" TEXT NOT NULL,
    "providerCredentialId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "destroyedAt" TIMESTAMP(3),

    CONSTRAINT "integration_secrets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "providerTransferId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "bankAccountRef" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_accounts_integrationId_key" ON "payment_accounts"("integrationId");

CREATE UNIQUE INDEX "payment_accounts_providerAccountId_key" ON "payment_accounts"("providerAccountId");

CREATE UNIQUE INDEX "payment_accounts_walletId_key" ON "payment_accounts"("walletId");

CREATE INDEX "payment_accounts_status_nextAttemptAt_idx" ON "payment_accounts"("status", "nextAttemptAt");

CREATE UNIQUE INDEX "payment_accounts_integrationId_tenantId_key" ON "payment_accounts"("integrationId", "tenantId");

CREATE UNIQUE INDEX "payment_accounts_id_tenantId_key" ON "payment_accounts"("id", "tenantId");

CREATE INDEX "integration_secrets_tenantId_purpose_state_idx" ON "integration_secrets"("tenantId", "purpose", "state");

CREATE INDEX "integration_secrets_kekId_idx" ON "integration_secrets"("kekId");

CREATE UNIQUE INDEX "integration_secrets_integrationId_purpose_version_key" ON "integration_secrets"("integrationId", "purpose", "version");

CREATE UNIQUE INDEX "integration_secrets_id_tenantId_key" ON "integration_secrets"("id", "tenantId");

CREATE UNIQUE INDEX "payout_requests_idempotencyKey_key" ON "payout_requests"("idempotencyKey");

CREATE UNIQUE INDEX "payout_requests_providerTransferId_key" ON "payout_requests"("providerTransferId");

CREATE INDEX "payout_requests_tenantId_createdAt_idx" ON "payout_requests"("tenantId", "createdAt");

CREATE INDEX "payout_requests_status_submittedAt_idx" ON "payout_requests"("status", "submittedAt");

ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_integrationId_tenantId_fkey" FOREIGN KEY ("integrationId", "tenantId") REFERENCES "tenant_integrations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "integration_secrets" ADD CONSTRAINT "integration_secrets_integrationId_tenantId_fkey" FOREIGN KEY ("integrationId", "tenantId") REFERENCES "tenant_integrations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_paymentAccountId_tenantId_fkey" FOREIGN KEY ("paymentAccountId", "tenantId") REFERENCES "payment_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tenant_integrations ADD CONSTRAINT tenant_integrations_credential_source CHECK (("credentialSource"='ENV_REF' AND "credentialsRef" ~ '^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$' AND "credentialsRef" IS NOT NULL) OR ("credentialSource"='VAULT' AND "credentialsRef" IS NULL)), ADD CONSTRAINT tenant_integrations_environment CHECK (environment IS NULL OR environment IN ('sandbox','production')), ADD CONSTRAINT tenant_integrations_token_hash CHECK (("webhookTokenHash" IS NULL OR "webhookTokenHash" ~ '^[a-f0-9]{64}$') AND ("webhookTokenPreviousHash" IS NULL OR "webhookTokenPreviousHash" ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX tenant_integrations_single_asaas ON tenant_integrations("tenantId") WHERE provider='ASAAS' AND status<>'DISABLED';
CREATE UNIQUE INDEX payment_accounts_one_current ON payment_accounts("tenantId") WHERE "disconnectedAt" IS NULL;
ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_model CHECK ((mode='ASAAS_SUBACCOUNT')=("subaccountModel" IS NOT NULL)), ADD CONSTRAINT payment_accounts_environment CHECK (environment IN ('sandbox','production'));
CREATE UNIQUE INDEX integration_secrets_one_active ON integration_secrets("integrationId",purpose) WHERE state='ACTIVE';
CREATE UNIQUE INDEX integration_secrets_api_key_fingerprint ON integration_secrets(fingerprint) WHERE purpose='ASAAS_API_KEY' AND state IN ('PENDING','ACTIVE','PREVIOUS');
ALTER TABLE integration_secrets ADD CONSTRAINT integration_secrets_shred CHECK ((state='DESTROYED' AND ciphertext IS NULL AND "wrappedDek" IS NULL AND iv IS NULL AND "authTag" IS NULL AND "destroyedAt" IS NOT NULL) OR (state<>'DESTROYED' AND ciphertext IS NOT NULL AND octet_length(ciphertext)>0 AND "wrappedDek" IS NOT NULL AND octet_length("wrappedDek")>0 AND iv IS NOT NULL AND octet_length(iv)=12 AND "authTag" IS NOT NULL AND octet_length("authTag")=16)), ADD CONSTRAINT integration_secrets_version CHECK (version>0 AND "aadVersion">0), ADD CONSTRAINT integration_secrets_fingerprint CHECK (fingerprint ~ '^[a-f0-9]{64}$');
ALTER TABLE payout_requests ADD CONSTRAINT payout_requests_amount CHECK (amount>0);
ALTER TABLE "payment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "payment_accounts" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "payment_accounts" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "payment_accounts" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER payment_accounts_no_delete BEFORE DELETE ON "payment_accounts" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "integration_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_secrets" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "integration_secrets" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "integration_secrets" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "integration_secrets" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER integration_secrets_no_delete BEFORE DELETE ON "integration_secrets" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "payout_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payout_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "payout_requests" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "payout_requests" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "payout_requests" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER payout_requests_no_delete BEFORE DELETE ON "payout_requests" FOR EACH ROW EXECUTE FUNCTION forbid_delete();


COMMIT;
