-- Additive only. No provider request, legacy row rewrite or credential copy.
CREATE TABLE zoho_mail_commands (
  id text PRIMARY KEY,
  "tenantId" text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "userId" text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('SEND','REPLY','DRAFT','UPDATE','DELETE','UPLOAD')),
  "accountId" text NOT NULL,
  "grantId" text NOT NULL, -- Historical binding; disconnect may delete the live grant.
  "keyHash" text NOT NULL CHECK ("keyHash" ~ '^[a-f0-9]{64}$'),
  "requestHash" text NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING','RESOLVED','UNKNOWN')),
  "responseBody" text,
  "httpStatus" integer CHECK ("httpStatus" BETWEEN 200 AND 599),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" timestamp(3),
  CONSTRAINT zoho_mail_commands_membership_fk FOREIGN KEY ("tenantId","userId") REFERENCES memberships("tenantId","userId") ON DELETE RESTRICT,
  CONSTRAINT zoho_mail_commands_result CHECK (
    (status='PROCESSING' AND "completedAt" IS NULL AND "responseBody" IS NULL AND "httpStatus" IS NULL) OR
    (status='UNKNOWN' AND "completedAt" IS NOT NULL AND "responseBody" IS NULL AND "httpStatus" IS NULL) OR
    (status='RESOLVED' AND "completedAt" IS NOT NULL AND "responseBody" IS NOT NULL AND "httpStatus" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX zoho_mail_commands_tenant_user_operation_key ON zoho_mail_commands("tenantId","userId",operation,"keyHash");
CREATE INDEX zoho_mail_commands_tenant_status_created ON zoho_mail_commands("tenantId",status,"createdAt");
ALTER TABLE zoho_mail_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_mail_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON zoho_mail_commands FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE FUNCTION zoho_mail_commands_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ZOHO_COMMAND_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'PROCESSING' THEN RAISE EXCEPTION 'ZOHO_COMMAND_INVALID_INITIAL_STATE' USING ERRCODE='23514'; END IF;
  ELSE
    IF OLD.status<>'PROCESSING' OR
       (NEW.id,NEW."tenantId",NEW."userId",NEW.operation,NEW."accountId",NEW."grantId",NEW."keyHash",NEW."requestHash",NEW."createdAt") IS DISTINCT FROM
       (OLD.id,OLD."tenantId",OLD."userId",OLD.operation,OLD."accountId",OLD."grantId",OLD."keyHash",OLD."requestHash",OLD."createdAt") THEN
      RAISE EXCEPTION 'ZOHO_COMMAND_HISTORY_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zoho_mail_commands_guard BEFORE INSERT OR UPDATE OR DELETE ON zoho_mail_commands FOR EACH ROW EXECUTE FUNCTION zoho_mail_commands_guard();
