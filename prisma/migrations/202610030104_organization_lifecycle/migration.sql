BEGIN;

CREATE TYPE "OrganizationAccess" AS ENUM ('SETUP', 'FULL', 'RESTRICTED', 'ARCHIVED');

CREATE TYPE "OrganizationOrigin" AS ENUM ('LEGACY', 'ONBOARDING');

CREATE TYPE "CompanyType" AS ENUM ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION');

ALTER TABLE "organizations" ADD COLUMN     "access" "OrganizationAccess" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "adminHoldReason" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "companyType" "CompanyType",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "documentNormalized" TEXT,
ADD COLUMN     "documentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "origin" "OrganizationOrigin" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "provisioningKey" TEXT,
ADD COLUMN     "siteIndexable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sitePublishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "organizations_provisioningKey_key" ON "organizations"("provisioningKey");
ALTER TABLE organizations ALTER COLUMN access SET DEFAULT 'SETUP';
ALTER TABLE organizations ADD CONSTRAINT organizations_owner_required CHECK (origin='LEGACY' OR "ownerUserId" IS NOT NULL), ADD CONSTRAINT organizations_document_format CHECK ("documentNormalized" IS NULL OR "documentNormalized" ~ '^[0-9A-Z]{12}[0-9]{2}$'), ADD CONSTRAINT organizations_document_verified CHECK ("documentVerifiedAt" IS NULL OR "documentNormalized" IS NOT NULL);
CREATE UNIQUE INDEX organizations_verified_document ON organizations("documentNormalized") WHERE "documentVerifiedAt" IS NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT organizations_owner_membership_fkey FOREIGN KEY(id,"ownerUserId") REFERENCES memberships("tenantId","userId") DEFERRABLE INITIALLY DEFERRED;
UPDATE organizations SET "sitePublishedAt"="createdAt" WHERE status='ACTIVE';
CREATE FUNCTION organizations_platform_columns() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF (NEW.access<>'SETUP' OR NEW.origin<>'LEGACY' OR NEW."ownerUserId" IS NOT NULL OR NEW."documentVerifiedAt" IS NOT NULL OR NEW."adminHoldReason" IS NOT NULL OR NEW."sitePublishedAt" IS NOT NULL OR NEW."provisioningKey" IS NOT NULL) AND NOT app_is_platform_context() THEN RAISE EXCEPTION 'ORGANIZATION_PLATFORM_COLUMNS' USING ERRCODE='42501'; END IF;
 ELSE
  IF (NEW.access,NEW.status,NEW."ownerUserId",NEW."documentNormalized",NEW."documentVerifiedAt",NEW."siteIndexable",NEW."adminHoldReason",NEW.origin,NEW."sitePublishedAt",NEW."provisioningKey") IS DISTINCT FROM (OLD.access,OLD.status,OLD."ownerUserId",OLD."documentNormalized",OLD."documentVerifiedAt",OLD."siteIndexable",OLD."adminHoldReason",OLD.origin,OLD."sitePublishedAt",OLD."provisioningKey") AND NOT app_is_platform_context() THEN RAISE EXCEPTION 'ORGANIZATION_PLATFORM_COLUMNS' USING ERRCODE='42501'; END IF;
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD."sitePublishedAt" IS NOT NULL AND NOT app_is_platform_context() THEN RAISE EXCEPTION 'SLUG_IMMUTABLE_AFTER_PUBLISH' USING ERRCODE='42501'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER organizations_platform_columns BEFORE INSERT OR UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION organizations_platform_columns();
CREATE FUNCTION preserve_owner_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM organizations o WHERE o.id=OLD."tenantId" AND o."ownerUserId"=OLD."userId") AND (TG_OP='DELETE' OR (NEW."tenantId",NEW."userId") IS DISTINCT FROM (OLD."tenantId",OLD."userId") OR NEW.role<>'ADMIN' OR NEW.status<>'ACTIVE') THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_REQUIRED' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER memberships_preserve_owner BEFORE UPDATE OR DELETE ON memberships FOR EACH ROW EXECUTE FUNCTION preserve_owner_membership();
CREATE FUNCTION organization_owner_active() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."ownerUserId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM memberships WHERE "tenantId"=NEW.id AND "userId"=NEW."ownerUserId" AND role='ADMIN' AND status='ACTIVE') THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_REQUIRED' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE CONSTRAINT TRIGGER organizations_owner_active AFTER INSERT OR UPDATE ON organizations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization_owner_active();

COMMIT;
