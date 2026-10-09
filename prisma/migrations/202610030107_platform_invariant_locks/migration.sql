BEGIN;

-- Serialize opposite insertion orders; a row trigger alone can miss an uncommitted staff/membership.
CREATE OR REPLACE FUNCTION memberships_forbid_platform_staff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET app.platform_scope='on' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-membership:' || NEW."userId", 0));
  IF NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM public.platform_staff WHERE "userId"=NEW."userId" AND active) THEN
    RAISE EXCEPTION 'PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION platform_staff_forbid_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-membership:' || NEW."userId", 0));
  IF NEW.active AND EXISTS(SELECT 1 FROM memberships WHERE "userId"=NEW."userId" AND status='ACTIVE') THEN
    RAISE EXCEPTION 'PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION preserve_owner_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM organizations WHERE id=OLD."tenantId" FOR UPDATE;
  IF EXISTS(SELECT 1 FROM organizations WHERE id=OLD."tenantId" AND "ownerUserId"=OLD."userId")
     AND (TG_OP='DELETE' OR (NEW."tenantId",NEW."userId") IS DISTINCT FROM (OLD."tenantId",OLD."userId") OR NEW.role<>'ADMIN' OR NEW.status<>'ACTIVE') THEN
    RAISE EXCEPTION 'OWNER_MEMBERSHIP_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION organization_owner_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ownerUserId" IS NOT NULL THEN
    PERFORM 1 FROM memberships WHERE "tenantId"=NEW.id AND "userId"=NEW."ownerUserId" AND role='ADMIN' AND status='ACTIVE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_REQUIRED' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_courtesy_reason_required
  CHECK ("billingMode"<>'COMPLIMENTARY' OR "complimentaryReason" IS NOT NULL);
ALTER TABLE legal_acceptances ADD CONSTRAINT legal_withdrawal_marketing_only
  CHECK ("withdrawnAt" IS NULL OR kind='MARKETING_OPT_IN');

COMMIT;
