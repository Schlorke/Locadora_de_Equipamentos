BEGIN;
ALTER TABLE platform_webhook_inbox ADD COLUMN "sourceEnvironment" TEXT;
ALTER TABLE platform_webhook_inbox ADD CONSTRAINT platform_webhook_environment
  CHECK ("sourceEnvironment" IS NULL OR (source='ASAAS_ROOT' AND "sourceEnvironment" IN ('sandbox','production')));
CREATE FUNCTION platform_webhook_environment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sourceEnvironment" IS DISTINCT FROM OLD."sourceEnvironment" THEN
    RAISE EXCEPTION 'WEBHOOK_ENVIRONMENT_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platform_webhook_environment_no_change BEFORE UPDATE ON platform_webhook_inbox
  FOR EACH ROW EXECUTE FUNCTION platform_webhook_environment_immutable();
COMMIT;
