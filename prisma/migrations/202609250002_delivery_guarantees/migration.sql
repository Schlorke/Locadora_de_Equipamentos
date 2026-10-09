-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_inbox" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "webhook_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "amount" DECIMAL NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupeKey_key" ON "outbox_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "outbox_events_status_availableAt_idx" ON "outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "webhook_inbox_processedAt_receivedAt_idx" ON "webhook_inbox"("processedAt", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_inbox_provider_eventKey_key" ON "webhook_inbox"("provider", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotencyKey_key" ON "payment_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_attempts_paymentId_createdAt_idx" ON "payment_attempts"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_externalId_key" ON "payment_attempts"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
