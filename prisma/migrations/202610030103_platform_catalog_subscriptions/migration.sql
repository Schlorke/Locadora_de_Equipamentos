BEGIN;

CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

CREATE TYPE "SubscriptionBillingMode" AS ENUM ('ASAAS', 'COMPLIMENTARY');

CREATE TYPE "ProviderSyncState" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'UNKNOWN', 'SYNCED', 'FAILED');

CREATE TYPE "SubscriptionEventSource" AS ENUM ('WEBHOOK', 'JOB', 'OWNER', 'STAFF', 'SYSTEM', 'RECONCILIATION');

CREATE TYPE "PlatformInvoiceKind" AS ENUM ('CYCLE', 'ADJUSTMENT');

CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED', 'REFUNDED', 'CHARGEBACK');

CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_versions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(12,2) NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "suspendDays" INTEGER NOT NULL DEFAULT 30,
    "incompleteDays" INTEGER NOT NULL DEFAULT 30,
    "entitlements" JSONB NOT NULL,
    "sellableFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "scheduledPlanVersionId" TEXT,
    "scheduledChangeAt" DATE,
    "status" "SubscriptionStatus" NOT NULL,
    "billingMode" "SubscriptionBillingMode" NOT NULL DEFAULT 'ASAAS',
    "complimentaryUntil" DATE,
    "complimentaryReason" TEXT,
    "trialEndsAt" DATE,
    "currentPeriodStart" DATE,
    "currentPeriodEnd" DATE,
    "pastDueSince" DATE,
    "graceEndsAt" DATE,
    "suspendedAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "billingEmail" TEXT,
    "providerEnvironment" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerSync" "ProviderSyncState" NOT NULL DEFAULT 'NOT_REQUIRED',
    "providerAttempts" INTEGER NOT NULL DEFAULT 0,
    "providerNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerLastError" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "SubscriptionEventSource" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "actorUserId" TEXT,
    "planVersionId" TEXT,
    "mrrDelta" DECIMAL(12,2),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "kind" "PlatformInvoiceKind" NOT NULL DEFAULT 'CYCLE',
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "providerStatus" TEXT,
    "providerPaymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "billingType" TEXT,
    "invoiceUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "chargebackAt" TIMESTAMP(3),
    "settlesInvoiceId" TEXT,
    "debtWaivedAt" TIMESTAMP(3),
    "voluntaryRefund" BOOLEAN NOT NULL DEFAULT false,
    "canceledReason" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entitlement_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trial_claims" (
    "keyHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_claims_pkey" PRIMARY KEY ("keyHash")
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

CREATE UNIQUE INDEX "plan_versions_planId_version_key" ON "plan_versions"("planId", "version");

CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");

CREATE INDEX "subscriptions_tenantId_status_idx" ON "subscriptions"("tenantId", "status");

CREATE INDEX "subscriptions_status_graceEndsAt_idx" ON "subscriptions"("status", "graceEndsAt");

CREATE INDEX "subscriptions_providerSync_providerNextAttemptAt_idx" ON "subscriptions"("providerSync", "providerNextAttemptAt");

CREATE UNIQUE INDEX "subscriptions_id_tenantId_key" ON "subscriptions"("id", "tenantId");

CREATE INDEX "subscription_events_tenantId_occurredAt_idx" ON "subscription_events"("tenantId", "occurredAt");

CREATE INDEX "subscription_events_occurredAt_idx" ON "subscription_events"("occurredAt");

CREATE UNIQUE INDEX "subscription_events_subscriptionId_dedupeKey_key" ON "subscription_events"("subscriptionId", "dedupeKey");

CREATE UNIQUE INDEX "platform_invoices_providerPaymentId_key" ON "platform_invoices"("providerPaymentId");

CREATE INDEX "platform_invoices_tenantId_status_dueDate_idx" ON "platform_invoices"("tenantId", "status", "dueDate");

CREATE INDEX "platform_invoices_status_dueDate_idx" ON "platform_invoices"("status", "dueDate");

CREATE UNIQUE INDEX "platform_invoices_id_subscriptionId_tenantId_key" ON "platform_invoices"("id", "subscriptionId", "tenantId");

CREATE INDEX "entitlement_overrides_tenantId_idx" ON "entitlement_overrides"("tenantId");

ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_scheduledPlanVersionId_fkey" FOREIGN KEY ("scheduledPlanVersionId") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_tenantId_fkey" FOREIGN KEY ("subscriptionId", "tenantId") REFERENCES "subscriptions"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_subscriptionId_tenantId_fkey" FOREIGN KEY ("subscriptionId", "tenantId") REFERENCES "subscriptions"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX subscriptions_current_per_tenant ON subscriptions("tenantId") WHERE status <> 'CANCELED';
ALTER TABLE plans ADD CONSTRAINT plans_code CHECK (code ~ '^[a-z0-9-]{2,32}$');
ALTER TABLE plan_versions ADD CONSTRAINT plan_versions_amount CHECK (amount>=0), ADD CONSTRAINT plan_versions_version CHECK (version>0), ADD CONSTRAINT plan_versions_trial CHECK ("trialDays" BETWEEN 0 AND 30), ADD CONSTRAINT plan_versions_grace CHECK ("graceDays" BETWEEN 0 AND 15), ADD CONSTRAINT plan_versions_suspend CHECK ("suspendDays" BETWEEN 7 AND 90), ADD CONSTRAINT plan_versions_incomplete CHECK ("incompleteDays" BETWEEN 1 AND 90);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_canceled CHECK (status<>'CANCELED' OR "canceledAt" IS NOT NULL), ADD CONSTRAINT subscriptions_environment CHECK ("providerEnvironment" IS NULL OR "providerEnvironment" IN ('sandbox','production')), ADD CONSTRAINT subscriptions_reason CHECK ("cancelReason" IS NULL OR "cancelReason" IN ('OWNER_REQUEST','NON_PAYMENT','TRIAL_EXPIRED','ABANDONED','STAFF')), ADD CONSTRAINT subscriptions_courtesy CHECK ("billingMode"<>'COMPLIMENTARY' OR length(trim("complimentaryReason"))>0);
ALTER TABLE platform_invoices ADD CONSTRAINT platform_invoices_amount CHECK (amount>=0), ADD CONSTRAINT platform_invoices_settlement CHECK ("settlesInvoiceId" IS NULL OR (kind='ADJUSTMENT' AND "settlesInvoiceId"<>id)), ADD CONSTRAINT platform_invoices_settlement_tenant_fk FOREIGN KEY ("settlesInvoiceId","subscriptionId","tenantId") REFERENCES platform_invoices(id,"subscriptionId","tenantId") ON DELETE RESTRICT;
ALTER TABLE trial_claims ADD CONSTRAINT trial_claims_kind CHECK (kind IN ('CNPJ','EMAIL'));
INSERT INTO plans(id,code,name,"isPublic","updatedAt") VALUES ('plan_interno_legado','interno-legado','Interno (legado, sem limites)',false,now());
INSERT INTO plan_versions(id,"planId",version,interval,amount,"trialDays","graceDays","suspendDays","incompleteDays",entitlements) VALUES ('planv_interno_legado_1','plan_interno_legado',1,'MONTHLY',0,0,7,30,30,'{"schema":1,"limits":{"equipments":null,"staffSeats":null},"features":{"onlinePayments":true,"customDomain":true,"logistics":true,"maintenance":true,"contractSignature":true,"whatsapp":true,"emailInbox":true,"merchantFeed":true}}');
INSERT INTO subscriptions(id,"tenantId","planVersionId",status,"billingMode","complimentaryReason","providerSync","updatedAt") SELECT 'sub_legacy_'||id,id,'planv_interno_legado_1','ACTIVE','COMPLIMENTARY','LEGACY_BACKFILL','NOT_REQUIRED',now() FROM organizations;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM organizations o WHERE NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s."tenantId"=o.id AND s.status<>'CANCELED')) THEN RAISE EXCEPTION 'Postcheck subscriptions: missing current subscription After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030103_platform_catalog_subscriptions then pnpm exec prisma migrate deploy.'; END IF; END $$;
CREATE FUNCTION plan_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-'sellableUntil') IS DISTINCT FROM (to_jsonb(OLD)-'sellableUntil') THEN RAISE EXCEPTION 'PLAN_VERSION_IMMUTABLE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER plan_versions_immutable BEFORE UPDATE ON plan_versions FOR EACH ROW EXECUTE FUNCTION plan_version_immutable();
CREATE FUNCTION plan_price_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM plans WHERE id=NEW."planId" AND "isPublic") AND NEW.amount=0 THEN RAISE EXCEPTION 'PUBLIC_PLAN_REQUIRES_PRICE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER plan_versions_price BEFORE INSERT OR UPDATE ON plan_versions FOR EACH ROW EXECUTE FUNCTION plan_price_guard();
CREATE FUNCTION plan_public_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."isPublic" AND EXISTS(SELECT 1 FROM plan_versions WHERE "planId"=NEW.id AND amount=0) THEN RAISE EXCEPTION 'PUBLIC_PLAN_REQUIRES_PRICE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER plans_public_price BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION plan_public_guard();
CREATE FUNCTION subscription_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.id,NEW."tenantId") IS DISTINCT FROM (OLD.id,OLD."tenantId") OR (OLD.status='CANCELED' AND NEW.status<>'CANCELED') THEN RAISE EXCEPTION 'SUBSCRIPTION_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER subscriptions_history BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION subscription_history_guard();
CREATE FUNCTION invoice_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.id,NEW."tenantId",NEW."subscriptionId",NEW."providerPaymentId") IS DISTINCT FROM (OLD.id,OLD."tenantId",OLD."subscriptionId",OLD."providerPaymentId") THEN RAISE EXCEPTION 'INVOICE_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_invoices_history BEFORE UPDATE ON platform_invoices FOR EACH ROW EXECUTE FUNCTION invoice_history_guard();
CREATE TRIGGER subscription_events_append_only BEFORE UPDATE ON subscription_events FOR EACH ROW EXECUTE FUNCTION forbid_update();
CREATE TRIGGER trial_claims_append_only BEFORE UPDATE ON trial_claims FOR EACH ROW EXECUTE FUNCTION forbid_update();
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "plans" FOR SELECT USING (true);
CREATE POLICY platform_insert ON "plans" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "plans" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER plans_no_delete BEFORE DELETE ON "plans" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "plan_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "plan_versions" FOR SELECT USING (true);
CREATE POLICY platform_insert ON "plan_versions" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "plan_versions" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER plan_versions_no_delete BEFORE DELETE ON "plan_versions" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "subscriptions" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "subscriptions" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "subscriptions" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER subscriptions_no_delete BEFORE DELETE ON "subscriptions" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "subscription_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "subscription_events" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "subscription_events" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "subscription_events" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER subscription_events_no_delete BEFORE DELETE ON "subscription_events" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "platform_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "platform_invoices" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "platform_invoices" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "platform_invoices" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER platform_invoices_no_delete BEFORE DELETE ON "platform_invoices" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "entitlement_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlement_overrides" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "entitlement_overrides" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "entitlement_overrides" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "entitlement_overrides" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER entitlement_overrides_no_delete BEFORE DELETE ON "entitlement_overrides" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "trial_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trial_claims" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "trial_claims" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "trial_claims" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "trial_claims" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER trial_claims_no_delete BEFORE DELETE ON "trial_claims" FOR EACH ROW EXECUTE FUNCTION forbid_delete();


COMMIT;
