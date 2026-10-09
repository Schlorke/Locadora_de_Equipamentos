-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FINANCIAL', 'OPERATOR', 'CLIENT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuotePaymentTerms" AS ENUM ('UPFRONT', 'ON_DELIVERY', 'AT_END');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH', 'BOLETO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentBillingStatus" AS ENUM ('PAID', 'UNPAID', 'AWAITING_PAYMENT', 'SETTLED');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('CPF', 'CNPJ', 'CNI');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RENTAL', 'DEPOSIT', 'FINE', 'DAMAGE', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "QuoteAdjustmentCategory" AS ENUM ('LABOR', 'TRAVEL', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('PURE_RENTAL', 'RENTAL_WITH_SERVICE');

-- CreateEnum
CREATE TYPE "ClientDocumentType" AS ENUM ('ID_DOCUMENT', 'SELFIE', 'SIGNED_CONTRACT', 'CPF_CNPJ_PROOF');

-- CreateEnum
CREATE TYPE "RentalItemStatus" AS ENUM ('RENTED', 'RETURNED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE', 'PENDING_RETURN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'FINANCIAL', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "delivery_type" AS ENUM ('pickup', 'delivery', 'both');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'OPERATOR', 'FINANCIAL', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'VAN', 'PICKUP', 'MOTORCYCLE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentUnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('QUOTE', 'ORDER', 'PAYMENT', 'EQUIPMENT', 'SYSTEM', 'RENTAL', 'DELIVERY', 'CONTRACT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "phone" TEXT,
    "company" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoho_mail_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "datacenter" TEXT NOT NULL DEFAULT 'com',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zoho_mail_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "type" "WhatsAppMessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificationtokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verificationtokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "pricePerDay" DECIMAL(65,30) NOT NULL,
    "finalPrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "iconColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "bgColor" TEXT NOT NULL DEFAULT '#EFF6FF',
    "fontColor" TEXT NOT NULL DEFAULT '#1E40AF',
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "placement" TEXT,
    "customIcon" JSONB,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerDay" DECIMAL(65,30) NOT NULL,
    "images" TEXT[],
    "available" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "biweeklyDiscount" INTEGER DEFAULT 0,
    "dailyDiscount" INTEGER DEFAULT 0,
    "maxStock" INTEGER DEFAULT 1,
    "monthlyDiscount" INTEGER DEFAULT 0,
    "popularPeriod" TEXT DEFAULT 'weekly',
    "weeklyDiscount" INTEGER DEFAULT 0,
    "specifications" JSONB,
    "biweeklyDirectValue" DECIMAL(65,30),
    "biweeklyUseDirectValue" BOOLEAN NOT NULL DEFAULT false,
    "dailyDirectValue" DECIMAL(65,30),
    "dailyUseDirectValue" BOOLEAN NOT NULL DEFAULT false,
    "monthlyDirectValue" DECIMAL(65,30),
    "monthlyUseDirectValue" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDirectValue" DECIMAL(65,30),
    "weeklyUseDirectValue" BOOLEAN NOT NULL DEFAULT false,
    "dailyRentalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyRentalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "biweeklyRentalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyRentalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "depreciationRate" DECIMAL,
    "hourMeter" DECIMAL,
    "odometer" DECIMAL,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL,
    "partsLossHistory" JSONB,
    "partsLossCount" INTEGER DEFAULT 0,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_units" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "status" "EquipmentUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hourMeter" DECIMAL,
    "odometer" DECIMAL,
    "serialNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "quoteCode" TEXT,
    "legacyExternalCode" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "clientDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cep" TEXT,
    "cnpj" TEXT,
    "cpf" TEXT,
    "adminNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "convertedToRentalId" TEXT,
    "paymentTerms" "QuotePaymentTerms" NOT NULL DEFAULT 'UPFRONT',
    "deliveryAddress" JSONB,
    "deliveryFee" DECIMAL(65,30),
    "deliveryType" "DeliveryType",
    "deposit" DECIMAL(65,30),
    "discount" DECIMAL(65,30),
    "endDate" TIMESTAMP(3),
    "finalTotal" DECIMAL(65,30),
    "internalNotes" TEXT,
    "pickupFee" DECIMAL(65,30),
    "priority" INTEGER DEFAULT 0,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "startDate" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30),
    "taxes" DECIMAL(65,30),
    "validUntil" TIMESTAMP(3),
    "originalTotal" DECIMAL(65,30),
    "priceAdjustmentReason" TEXT,
    "priceAdjustedAt" TIMESTAMP(3),
    "priceAdjustedBy" TEXT,
    "lateFee" DECIMAL(65,30),
    "lateFeeApproved" BOOLEAN DEFAULT false,
    "lateFeeApprovedAt" TIMESTAMP(3),
    "lateFeeApprovedBy" TEXT,
    "damages" JSONB,
    "misuse" JSONB,
    "operationType" "OperationType",
    "serviceAmount" DECIMAL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "days" INTEGER NOT NULL DEFAULT 1,
    "pricePerDay" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "includeWeekends" BOOLEAN NOT NULL DEFAULT false,
    "appliedDiscount" DECIMAL(65,30),
    "appliedPeriod" TEXT,
    "useDirectValue" BOOLEAN NOT NULL DEFAULT false,
    "directValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_items" (
    "id" TEXT NOT NULL,
    "rentalid" TEXT NOT NULL,
    "equipmentid" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceperday" DECIMAL NOT NULL,
    "totaldays" INTEGER NOT NULL,
    "totalprice" DECIMAL NOT NULL,
    "startDate" TIMESTAMP(6),
    "endDate" TIMESTAMP(6),
    "includeWeekends" BOOLEAN NOT NULL DEFAULT false,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "startdate" TIMESTAMP(6) NOT NULL,
    "enddate" TIMESTAMP(6) NOT NULL,
    "total" DECIMAL NOT NULL,
    "status" TEXT DEFAULT 'PENDING',
    "userid" TEXT NOT NULL,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "checkInAt" TIMESTAMP(6),
    "checkOutAt" TIMESTAMP(6),
    "extensionDays" INTEGER,
    "extensionFee" DECIMAL,
    "lateFee" DECIMAL,
    "notes" TEXT,
    "quoteId" TEXT,
    "clientDeletedAt" TIMESTAMP(3),

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "companyPhone" TEXT NOT NULL DEFAULT '',
    "companyIconUrl" TEXT NOT NULL DEFAULT '',
    "aboutUsText" TEXT NOT NULL DEFAULT '',
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "heroCarousel" JSONB NOT NULL DEFAULT '[]',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" TEXT NOT NULL DEFAULT 'GB Locações - Equipamentos para Construção',
    "seoDescription" TEXT NOT NULL DEFAULT 'Locação de equipamentos para construção civil com qualidade e segurança',
    "themeColorPrimary" TEXT NOT NULL DEFAULT '#ea580c',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "analyticsTrackingId" TEXT NOT NULL DEFAULT '',
    "footerText" TEXT NOT NULL DEFAULT '',
    "businessHours" JSONB NOT NULL DEFAULT '{}',
    "supportChat" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "favicon" TEXT NOT NULL DEFAULT '',
    "logoSecondary" TEXT NOT NULL DEFAULT '',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'pt-BR',
    "baseCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'Site em manutenção. Voltamos em breve!',
    "smtpConfig" JSONB NOT NULL DEFAULT '{}',
    "uploadLimits" JSONB NOT NULL DEFAULT '{}',
    "securityConfig" JSONB NOT NULL DEFAULT '{}',
    "customCss" TEXT NOT NULL DEFAULT '',
    "customJs" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketingEmail" TEXT NOT NULL DEFAULT '',
    "waveAnimation" TEXT NOT NULL DEFAULT 'animated',

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cost" DECIMAL,
    "laborCost" DECIMAL,
    "partsCost" DECIMAL,
    "description" TEXT,
    "notes" TEXT,
    "technician" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT,
    "quoteId" TEXT,
    "amount" DECIMAL NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billingStatus" "PaymentBillingStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "type" "PaymentType" NOT NULL DEFAULT 'RENTAL',
    "paidAt" TIMESTAMP(6),
    "dueDate" TIMESTAMP(6) NOT NULL,
    "grossAmount" DECIMAL,
    "netAmount" DECIMAL,
    "taxRate" DECIMAL,
    "taxDocumentType" "TaxDocumentType",
    "invoiceNumber" TEXT,
    "boletoIssuedAt" TIMESTAMP(3),
    "invoiceIssuedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "pixCode" TEXT,
    "pixQrCode" TEXT,
    "metadata" JSONB,
    "operationType" "OperationType",
    "rentalAmount" DECIMAL,
    "serviceAmount" DECIMAL,
    "taxRegimeSnapshot" "TaxRegime",
    "issAmount" DECIMAL,
    "irpjAmount" DECIMAL,
    "csllAmount" DECIMAL,
    "pisCofinsAmount" DECIMAL,
    "simplesAmount" DECIMAL,
    "nfseNumber" TEXT,
    "nfseIssuedAt" TIMESTAMP(3),
    "taxBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_settings" (
    "id" TEXT NOT NULL,
    "cpfRate" DECIMAL NOT NULL DEFAULT 6.0,
    "cnpjRate" DECIMAL NOT NULL DEFAULT 2.5,
    "cniRate" DECIMAL NOT NULL DEFAULT 6.0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    "issRate" DECIMAL NOT NULL DEFAULT 2.5,
    "issExemptRental" BOOLEAN NOT NULL DEFAULT true,
    "irpjPresumidoRate" DECIMAL,
    "csllPresumidoRate" DECIMAL,
    "pisCofinsRate" DECIMAL,
    "simplesAnexo" TEXT DEFAULT 'III',
    "simplesAliquota" DECIMAL,
    "ibsCbsRate" DECIMAL,
    "ibsCbsActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_adjustments" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "category" "QuoteAdjustmentCategory" NOT NULL,
    "amount" DECIMAL NOT NULL,
    "justification" TEXT NOT NULL,
    "sentEmailAt" TIMESTAMP(3),
    "sentEmailTo" TEXT,
    "sentWhatsappAt" TIMESTAMP(3),
    "sentWhatsappTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rentalId" TEXT,
    "type" "ClientDocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT,
    "captureMetadata" JSONB,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "type" "DeliveryType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(6),
    "address" JSONB NOT NULL,
    "distance" DECIMAL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "photos" TEXT[],
    "checklist" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "type" "VehicleType" NOT NULL DEFAULT 'TRUCK',
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnh" TEXT,
    "cnhCategory" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "template" TEXT,
    "content" TEXT,
    "pdfUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "zapSignId" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cnpj_key" ON "users"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_mail_tokens_userId_key" ON "zoho_mail_tokens"("userId");

-- CreateIndex
CREATE INDEX "zoho_mail_tokens_userId_idx" ON "zoho_mail_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_phone_key" ON "whatsapp_conversations"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_providerMessageId_key" ON "whatsapp_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversationId_idx" ON "whatsapp_messages"("conversationId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verificationtokens_token_key" ON "verificationtokens"("token");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE INDEX "cart_items_equipmentId_idx" ON "cart_items"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_equipmentId_key" ON "cart_items"("cartId", "equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "equipments_categoryId_idx" ON "equipments"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_units_uniqueCode_key" ON "equipment_units"("uniqueCode");

-- CreateIndex
CREATE INDEX "equipment_units_equipmentId_idx" ON "equipment_units"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteCode_key" ON "quotes"("quoteCode");

-- CreateIndex
CREATE INDEX "quotes_userId_idx" ON "quotes"("userId");

-- CreateIndex
CREATE INDEX "quotes_endDate_idx" ON "quotes"("endDate");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_approvedBy_idx" ON "quotes"("approvedBy");

-- CreateIndex
CREATE INDEX "quotes_rejectedBy_idx" ON "quotes"("rejectedBy");

-- CreateIndex
CREATE INDEX "quote_items_equipmentId_idx" ON "quote_items"("equipmentId");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_idx" ON "quote_items"("quoteId");

-- CreateIndex
CREATE INDEX "rental_items_equipmentid_idx" ON "rental_items"("equipmentid");

-- CreateIndex
CREATE INDEX "rental_items_rentalid_idx" ON "rental_items"("rentalid");

-- CreateIndex
CREATE INDEX "rentals_userid_idx" ON "rentals"("userid");

-- CreateIndex
CREATE INDEX "rentals_quoteId_idx" ON "rentals"("quoteId");

-- CreateIndex
CREATE INDEX "maintenances_equipmentId_idx" ON "maintenances"("equipmentId");

-- CreateIndex
CREATE INDEX "payments_rentalId_idx" ON "payments"("rentalId");

-- CreateIndex
CREATE INDEX "payments_quoteId_idx" ON "payments"("quoteId");

-- CreateIndex
CREATE INDEX "payments_billingStatus_idx" ON "payments"("billingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "payments_quote_method_type_unique" ON "payments"("quoteId", "method", "type");

-- CreateIndex
CREATE INDEX "financial_settings_updatedBy_idx" ON "financial_settings"("updatedBy");

-- CreateIndex
CREATE INDEX "quote_adjustments_quoteId_idx" ON "quote_adjustments"("quoteId");

-- CreateIndex
CREATE INDEX "quote_adjustments_createdBy_idx" ON "quote_adjustments"("createdBy");

-- CreateIndex
CREATE INDEX "client_documents_userId_idx" ON "client_documents"("userId");

-- CreateIndex
CREATE INDEX "client_documents_rentalId_idx" ON "client_documents"("rentalId");

-- CreateIndex
CREATE INDEX "client_documents_uploadedBy_idx" ON "client_documents"("uploadedBy");

-- CreateIndex
CREATE INDEX "deliveries_rentalId_idx" ON "deliveries"("rentalId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_rentalId_key" ON "contracts"("rentalId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_module_action_key" ON "permissions"("role", "module", "action");

-- AddForeignKey
ALTER TABLE "zoho_mail_tokens" ADD CONSTRAINT "zoho_mail_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "fk_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_equipmentid_fkey" FOREIGN KEY ("equipmentid") REFERENCES "equipments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_rentalid_fkey" FOREIGN KEY ("rentalid") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_adjustments" ADD CONSTRAINT "quote_adjustments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_adjustments" ADD CONSTRAINT "quote_adjustments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
