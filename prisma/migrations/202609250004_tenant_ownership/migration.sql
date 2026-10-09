-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- DropIndex
DROP INDEX "whatsapp_conversations_phone_key";

-- DropIndex
DROP INDEX "whatsapp_messages_providerMessageId_key";

-- AlterTable
ALTER TABLE "zoho_mail_tokens" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "equipment_units" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rental_items" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "maintenances" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "financial_settings" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "quote_adjustments" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "client_documents" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "webhook_inbox" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "payment_attempts" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "credentialsRef" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_resource_tenants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_resource_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_userId_status_idx" ON "memberships"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenantId_userId_key" ON "memberships"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_tenantId_userId_key" ON "client_profiles"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_tenantId_document_key" ON "client_profiles"("tenantId", "document");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_id_tenantId_key" ON "client_profiles"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_integrations_id_tenantId_key" ON "tenant_integrations"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_integrations_tenantId_provider_externalAccountId_key" ON "tenant_integrations"("tenantId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "external_resource_tenants_tenantId_resourceType_resourceId_idx" ON "external_resource_tenants"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "external_resource_tenants_integrationId_resourceType_extern_key" ON "external_resource_tenants"("integrationId", "resourceType", "externalId");

-- CreateIndex
CREATE INDEX "zoho_mail_tokens_tenantId_idx" ON "zoho_mail_tokens"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_mail_tokens_id_tenantId_key" ON "zoho_mail_tokens"("id", "tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_tenantId_idx" ON "whatsapp_conversations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_id_tenantId_key" ON "whatsapp_conversations"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_tenantId_phone_key" ON "whatsapp_conversations"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenantId_idx" ON "whatsapp_messages"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_id_tenantId_key" ON "whatsapp_messages"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_tenantId_providerMessageId_key" ON "whatsapp_messages"("tenantId", "providerMessageId");

-- CreateIndex
CREATE INDEX "addresses_tenantId_idx" ON "addresses"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_id_tenantId_key" ON "addresses"("id", "tenantId");

-- CreateIndex
CREATE INDEX "carts_tenantId_idx" ON "carts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_id_tenantId_key" ON "carts"("id", "tenantId");

-- CreateIndex
CREATE INDEX "cart_items_tenantId_idx" ON "cart_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_id_tenantId_key" ON "cart_items"("id", "tenantId");

-- CreateIndex
CREATE INDEX "categories_tenantId_idx" ON "categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_tenantId_key" ON "categories"("id", "tenantId");

-- CreateIndex
CREATE INDEX "equipments_tenantId_idx" ON "equipments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_id_tenantId_key" ON "equipments"("id", "tenantId");

-- CreateIndex
CREATE INDEX "equipment_units_tenantId_idx" ON "equipment_units"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_units_id_tenantId_key" ON "equipment_units"("id", "tenantId");

-- CreateIndex
CREATE INDEX "quotes_tenantId_idx" ON "quotes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_id_tenantId_key" ON "quotes"("id", "tenantId");

-- CreateIndex
CREATE INDEX "quote_items_tenantId_idx" ON "quote_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_items_id_tenantId_key" ON "quote_items"("id", "tenantId");

-- CreateIndex
CREATE INDEX "rental_items_tenantId_idx" ON "rental_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_items_id_tenantId_key" ON "rental_items"("id", "tenantId");

-- CreateIndex
CREATE INDEX "rentals_tenantId_idx" ON "rentals"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_id_tenantId_key" ON "rentals"("id", "tenantId");

-- CreateIndex
CREATE INDEX "settings_tenantId_idx" ON "settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_id_tenantId_key" ON "settings"("id", "tenantId");

-- CreateIndex
CREATE INDEX "maintenances_tenantId_idx" ON "maintenances"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenances_id_tenantId_key" ON "maintenances"("id", "tenantId");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_tenantId_key" ON "payments"("id", "tenantId");

-- CreateIndex
CREATE INDEX "financial_settings_tenantId_idx" ON "financial_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_settings_id_tenantId_key" ON "financial_settings"("id", "tenantId");

-- CreateIndex
CREATE INDEX "quote_adjustments_tenantId_idx" ON "quote_adjustments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_adjustments_id_tenantId_key" ON "quote_adjustments"("id", "tenantId");

-- CreateIndex
CREATE INDEX "client_documents_tenantId_idx" ON "client_documents"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "client_documents_id_tenantId_key" ON "client_documents"("id", "tenantId");

-- CreateIndex
CREATE INDEX "deliveries_tenantId_idx" ON "deliveries"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_id_tenantId_key" ON "deliveries"("id", "tenantId");

-- CreateIndex
CREATE INDEX "vehicles_tenantId_idx" ON "vehicles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_id_tenantId_key" ON "vehicles"("id", "tenantId");

-- CreateIndex
CREATE INDEX "drivers_tenantId_idx" ON "drivers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_id_tenantId_key" ON "drivers"("id", "tenantId");

-- CreateIndex
CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_id_tenantId_key" ON "contracts"("id", "tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_id_tenantId_key" ON "audit_logs"("id", "tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_id_tenantId_key" ON "notifications"("id", "tenantId");

-- CreateIndex
CREATE INDEX "permissions_tenantId_idx" ON "permissions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_id_tenantId_key" ON "permissions"("id", "tenantId");

-- CreateIndex
CREATE INDEX "outbox_events_tenantId_idx" ON "outbox_events"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_id_tenantId_key" ON "outbox_events"("id", "tenantId");

-- CreateIndex
CREATE INDEX "webhook_inbox_tenantId_idx" ON "webhook_inbox"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_inbox_id_tenantId_key" ON "webhook_inbox"("id", "tenantId");

-- CreateIndex
CREATE INDEX "payment_attempts_tenantId_idx" ON "payment_attempts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_id_tenantId_key" ON "payment_attempts"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "zoho_mail_tokens" ADD CONSTRAINT "zoho_mail_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_adjustments" ADD CONSTRAINT "quote_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_inbox" ADD CONSTRAINT "webhook_inbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_resource_tenants" ADD CONSTRAINT "external_resource_tenants_integrationId_tenantId_fkey" FOREIGN KEY ("integrationId", "tenantId") REFERENCES "tenant_integrations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
