-- Fail on conflicting assigned records; historical ownership is never inferred.
ALTER TABLE "organizations" ADD COLUMN "document" TEXT, ADD COLUMN "city" TEXT, ADD COLUMN "state" TEXT;
CREATE UNIQUE INDEX "settings_tenantId_key" ON "settings"("tenantId");
CREATE UNIQUE INDEX "addresses_one_primary_per_tenant_user"
  ON "addresses"("tenantId", "userId") WHERE "isPrimary" = true AND "tenantId" IS NOT NULL;
