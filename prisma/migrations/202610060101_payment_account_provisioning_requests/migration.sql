-- Wave 134 (S9): receiving-account creation request, platform-only, and removal of the never-written
-- "payment_accounts"."incomeRange". The declared monthly income and the mobile phone live here only while a
-- POST /accounts is still possible; every transition to a state without a possible POST purges both values.
--
-- Failure and recovery: prisma migrate deploy runs this script in one transaction (no BEGIN/COMMIT here, as in
-- 202609260004, so the deploy reports the real cause). Whatever stops it (a busy "payment_accounts", 55P03; the
-- preflight, P0001) rolls the whole script back, so nothing changed; but the deploy stops with P3018, records the
-- migration as failed and every later deploy refuses to run (P3009) until it is marked rolled back. Once the
-- cause is gone ("payment_accounts" is quiet, or the ranges were reconciled as the preflight message asks), run:
--     pnpm exec prisma migrate resolve --rolled-back 202610060101_payment_account_provisioning_requests
--     pnpm exec prisma migrate deploy
--
-- Locks: a lock not granted within 5 s aborts the migration instead of queueing every later query on
-- "payment_accounts" behind the ACCESS EXCLUSIVE of ALTER TABLE; statement_timeout bounds each statement.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Preflight under FORCE ROW LEVEL SECURITY: validating a CHECK constraint reads every row whatever the policies
-- of the migrator (a SELECT by the owner without BYPASSRLS would count zero rows). A declared range is never
-- converted into a monthly value (owner decision of 2026-10-06).
DO $$
BEGIN
  ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_income_range_absent" CHECK ("incomeRange" IS NULL);
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'Preflight payment_accounts.incomeRange: declared income ranges exist and are never converted into a monthly value. No data changed. The owner declares the exact monthly income through the receiving-account flow; clear the range with authorized reconciliation, then: pnpm exec prisma migrate resolve --rolled-back 202610060101_payment_account_provisioning_requests then pnpm exec prisma migrate deploy.';
END $$;
ALTER TABLE "payment_accounts" DROP CONSTRAINT "payment_accounts_income_range_absent";
ALTER TABLE "payment_accounts" DROP COLUMN "incomeRange";

CREATE TABLE "payment_account_provisioning_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "incomeValue" DECIMAL(12,2),
    "mobilePhone" TEXT,
    "companyDataVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),
    "purgeReason" TEXT,

    CONSTRAINT "payment_account_provisioning_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_account_provisioning_requests_paymentAccountId_key" ON "payment_account_provisioning_requests"("paymentAccountId");

CREATE UNIQUE INDEX "payment_account_provisioning_requests_paymentAccountId_tena_key" ON "payment_account_provisioning_requests"("paymentAccountId", "tenantId");

CREATE UNIQUE INDEX "payment_account_provisioning_requests_id_tenantId_key" ON "payment_account_provisioning_requests"("id", "tenantId");

ALTER TABLE "payment_account_provisioning_requests" ADD CONSTRAINT "payment_account_provisioning_requests_paymentAccountId_ten_fkey" FOREIGN KEY ("paymentAccountId", "tenantId") REFERENCES "payment_accounts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Technical shape only (no business limit): reais with exact cents, a Brazilian mobile number and a SHA-256 version.
ALTER TABLE "payment_account_provisioning_requests"
  ADD CONSTRAINT "payment_account_provisioning_requests_income" CHECK ("incomeValue" IS NULL OR "incomeValue" >= 0),
  ADD CONSTRAINT "payment_account_provisioning_requests_phone" CHECK ("mobilePhone" IS NULL OR "mobilePhone" ~ '^[1-9]{2}9[0-9]{8}$'),
  ADD CONSTRAINT "payment_account_provisioning_requests_version" CHECK ("companyDataVersion" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "payment_account_provisioning_requests_purge" CHECK (
    ("purgedAt" IS NULL AND "purgeReason" IS NULL AND "incomeValue" IS NOT NULL AND "mobilePhone" IS NOT NULL) OR
    ("purgedAt" IS NOT NULL AND "purgeReason" IN ('CREATED','UNCERTAIN','REJECTED','CANCELLED','EXISTING_ACCOUNT','BLOCKED')
      AND "incomeValue" IS NULL AND "mobilePhone" IS NULL));

-- The only permitted change is the single purge: identity never changes, values never change while live and a
-- purged request never changes again.
CREATE FUNCTION payment_account_provisioning_requests_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."purgedAt" IS NOT NULL OR NEW."purgedAt" IS NULL
    OR NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."paymentAccountId" IS DISTINCT FROM OLD."paymentAccountId"
    OR NEW."companyDataVersion" IS DISTINCT FROM OLD."companyDataVersion"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'PAYMENT_ACCOUNT_PROVISIONING_REQUEST_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_account_provisioning_requests_immutable BEFORE UPDATE ON "payment_account_provisioning_requests" FOR EACH ROW EXECUTE FUNCTION payment_account_provisioning_requests_guard();

-- Platform-only (tools/tenant-models.json, read "platform"): the business role never reads the declared income.
ALTER TABLE "payment_account_provisioning_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_account_provisioning_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "payment_account_provisioning_requests" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "payment_account_provisioning_requests" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "payment_account_provisioning_requests" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER payment_account_provisioning_requests_no_delete BEFORE DELETE ON "payment_account_provisioning_requests" FOR EACH ROW EXECUTE FUNCTION forbid_delete();
