-- Additive durable intent: an uncertain provider DELETE only reconciles on retry.
BEGIN;
ALTER TABLE platform_invoices ADD COLUMN "providerCancelState" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE platform_invoices ADD CONSTRAINT platform_invoices_cancel_state
  CHECK ("providerCancelState" IN ('NONE','PROCESSING','UNKNOWN','CONFIRMED'));
COMMIT;
