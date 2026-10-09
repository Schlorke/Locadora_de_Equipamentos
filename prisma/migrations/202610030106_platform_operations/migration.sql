BEGIN;

CREATE TYPE "PlatformStaffRole" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER');

CREATE TYPE "SupportAccessScope" AS ENUM ('READ_ONLY');

CREATE TYPE "LegalDocumentKind" AS ENUM ('PLATFORM_TERMS', 'PRIVACY_POLICY', 'DATA_PROCESSING_AGREEMENT', 'PAYMENTS_PARTNER_NOTICE', 'MARKETING_OPT_IN');

CREATE TABLE "platform_webhook_inbox" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "routeKey" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processingToken" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "platform_webhook_inbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_outbox_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "topic" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "platform_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "tenantId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "reasonCategory" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformStaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "platform_staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_access_grants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "staffUserId" TEXT,
    "scope" "SupportAccessScope" NOT NULL DEFAULT 'READ_ONLY',
    "reason" TEXT NOT NULL,
    "ticketRef" TEXT,
    "breakGlass" BOOLEAN NOT NULL DEFAULT false,
    "approverStaffIds" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" "LegalDocumentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "textSha256" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_usage_snapshots" (
    "tenantId" TEXT NOT NULL,
    "equipments" INTEGER NOT NULL,
    "staffSeats" INTEGER NOT NULL,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_snapshots_pkey" PRIMARY KEY ("tenantId")
);

CREATE INDEX "platform_webhook_inbox_status_receivedAt_idx" ON "platform_webhook_inbox"("status", "receivedAt");

CREATE UNIQUE INDEX "platform_webhook_inbox_source_eventId_key" ON "platform_webhook_inbox"("source", "eventId");

CREATE UNIQUE INDEX "platform_outbox_events_dedupeKey_key" ON "platform_outbox_events"("dedupeKey");

CREATE INDEX "platform_outbox_events_status_availableAt_idx" ON "platform_outbox_events"("status", "availableAt");

CREATE INDEX "platform_audit_logs_tenantId_createdAt_idx" ON "platform_audit_logs"("tenantId", "createdAt");

CREATE INDEX "platform_audit_logs_action_createdAt_idx" ON "platform_audit_logs"("action", "createdAt");

CREATE UNIQUE INDEX "platform_staff_userId_key" ON "platform_staff"("userId");

CREATE INDEX "support_access_grants_tenantId_expiresAt_idx" ON "support_access_grants"("tenantId", "expiresAt");

CREATE INDEX "legal_acceptances_userId_kind_idx" ON "legal_acceptances"("userId", "kind");

CREATE INDEX "legal_acceptances_tenantId_kind_idx" ON "legal_acceptances"("tenantId", "kind");

ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE support_access_grants ADD CONSTRAINT support_grant_reason CHECK (length(trim(reason)) BETWEEN 10 AND 500), ADD CONSTRAINT support_grant_window CHECK ("expiresAt">"startsAt" AND "expiresAt"<="startsAt"+CASE WHEN "breakGlass" THEN interval '4 hours' ELSE interval '72 hours' END), ADD CONSTRAINT support_break_glass CHECK (("breakGlass" AND "grantedByUserId" IS NULL AND cardinality("approverStaffIds")=2 AND "approverStaffIds"[1] IS NOT NULL AND "approverStaffIds"[2] IS NOT NULL AND "approverStaffIds"[1]<>"approverStaffIds"[2]) OR (NOT "breakGlass" AND "grantedByUserId" IS NOT NULL));
ALTER TABLE tenant_usage_snapshots ADD CONSTRAINT tenant_usage_nonnegative CHECK (equipments>=0 AND "staffSeats">=0 AND "storageBytes">=0);
ALTER TABLE platform_webhook_inbox ADD CONSTRAINT platform_webhook_source CHECK (source IN ('ASAAS_ROOT','ASAAS_ACCOUNT','ASAAS_TRANSFER_VALIDATION')), ADD CONSTRAINT platform_webhook_status CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','UNROUTED','CONFLICT','FAILED'));
CREATE TRIGGER platform_audit_logs_append_only BEFORE UPDATE ON platform_audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_update();
CREATE FUNCTION legal_acceptance_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.kind<>'MARKETING_OPT_IN' OR (to_jsonb(NEW)-'withdrawnAt') IS DISTINCT FROM (to_jsonb(OLD)-'withdrawnAt') OR OLD."withdrawnAt" IS NOT NULL OR NEW."withdrawnAt" IS NULL THEN RAISE EXCEPTION 'LEGAL_ACCEPTANCE_IMMUTABLE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER legal_acceptances_history BEFORE UPDATE ON legal_acceptances FOR EACH ROW EXECUTE FUNCTION legal_acceptance_history();
ALTER TABLE "platform_webhook_inbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_webhook_inbox" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "platform_webhook_inbox" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "platform_webhook_inbox" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "platform_webhook_inbox" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER platform_webhook_inbox_no_delete BEFORE DELETE ON "platform_webhook_inbox" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "platform_outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "platform_outbox_events" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "platform_outbox_events" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "platform_outbox_events" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER platform_outbox_events_no_delete BEFORE DELETE ON "platform_outbox_events" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "platform_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "platform_audit_logs" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "platform_audit_logs" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "platform_audit_logs" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER platform_audit_logs_no_delete BEFORE DELETE ON "platform_audit_logs" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "platform_staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_staff" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "platform_staff" FOR SELECT USING (app_is_platform_context());
CREATE POLICY platform_insert ON "platform_staff" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "platform_staff" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER platform_staff_no_delete BEFORE DELETE ON "platform_staff" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "support_access_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_access_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "support_access_grants" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "support_access_grants" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "support_access_grants" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER support_access_grants_no_delete BEFORE DELETE ON "support_access_grants" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "legal_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_acceptances" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "legal_acceptances" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "legal_acceptances" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "legal_acceptances" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER legal_acceptances_no_delete BEFORE DELETE ON "legal_acceptances" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

ALTER TABLE "tenant_usage_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_select ON "tenant_usage_snapshots" FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), '') OR app_is_platform_context());
CREATE POLICY platform_insert ON "tenant_usage_snapshots" FOR INSERT WITH CHECK (app_is_platform_context());
CREATE POLICY platform_update ON "tenant_usage_snapshots" FOR UPDATE USING (app_is_platform_context()) WITH CHECK (app_is_platform_context());
CREATE TRIGGER tenant_usage_snapshots_no_delete BEFORE DELETE ON "tenant_usage_snapshots" FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- The DBA role script transfers the definer to the restricted platform runtime.
CREATE FUNCTION memberships_forbid_platform_staff() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public SET app.platform_scope='on' AS $$ BEGIN IF NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM public.platform_staff s WHERE s."userId"=NEW."userId" AND s.active) THEN RAISE EXCEPTION 'PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER memberships_forbid_platform_staff BEFORE INSERT OR UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION memberships_forbid_platform_staff();
CREATE FUNCTION platform_staff_forbid_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.active AND EXISTS(SELECT 1 FROM memberships WHERE "userId"=NEW."userId" AND status='ACTIVE') THEN RAISE EXCEPTION 'PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER platform_staff_forbid_membership BEFORE INSERT OR UPDATE ON platform_staff FOR EACH ROW EXECUTE FUNCTION platform_staff_forbid_membership();

COMMIT;
