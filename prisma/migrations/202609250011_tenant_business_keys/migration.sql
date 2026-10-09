-- Scope business keys to the explicitly assigned organization. Legacy null tenants remain quarantined.
DROP INDEX "categories_slug_key";
CREATE UNIQUE INDEX "categories_tenantId_slug_key" ON "categories"("tenantId", "slug");
DROP INDEX "carts_userId_key";
CREATE UNIQUE INDEX "carts_tenantId_userId_key" ON "carts"("tenantId", "userId");
DROP INDEX "equipment_units_uniqueCode_key";
CREATE UNIQUE INDEX "equipment_units_tenantId_uniqueCode_key" ON "equipment_units"("tenantId", "uniqueCode");
DROP INDEX "vehicles_plate_key";
CREATE UNIQUE INDEX "vehicles_tenantId_plate_key" ON "vehicles"("tenantId", "plate");
DROP INDEX "permissions_role_module_action_key";
CREATE UNIQUE INDEX "permissions_tenantId_role_module_action_key" ON "permissions"("tenantId", "role", "module", "action");

-- Cancellation intent is independent of payment settlement and must be confirmed before replacement.
CREATE TYPE "PaymentCancellationStatus" AS ENUM ('NONE', 'REQUESTED', 'PROCESSING', 'UNKNOWN', 'CONFIRMED');
ALTER TABLE "payment_attempts"
  ADD COLUMN "cancellationStatus" "PaymentCancellationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);
