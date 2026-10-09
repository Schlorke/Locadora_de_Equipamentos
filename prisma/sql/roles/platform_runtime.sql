-- DBA-only, idempotent. Execute AFTER platform migrations; never embed passwords.
-- Configure LOGIN/password out of band. Existing passwords and LOGIN are preserved.
BEGIN;
DO $$ BEGIN
 IF current_user='platform_runtime' THEN RAISE EXCEPTION 'Run this script as the separate migration administrator'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='platform_runtime') THEN CREATE ROLE platform_runtime NOLOGIN; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='platform_runtime')) THEN RAISE EXCEPTION 'platform_runtime must not inherit or assume other roles'; END IF;
END $$;
ALTER ROLE platform_runtime NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
GRANT USAGE ON SCHEMA public TO platform_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, platform_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM platform_runtime;
GRANT SELECT,INSERT,UPDATE ON "plans", "plan_versions", "subscriptions", "subscription_events", "platform_invoices", "entitlement_overrides", "trial_claims", "payment_accounts", "payment_account_provisioning_requests", "integration_secrets", "payout_requests", "platform_webhook_inbox", "platform_outbox_events", "platform_audit_logs", "platform_staff", "support_access_grants", "legal_acceptances", "tenant_usage_snapshots", organizations, memberships, tenant_integrations TO platform_runtime;
GRANT INSERT ON settings, financial_settings, permissions, categories TO platform_runtime;
GRANT SELECT ON platform_user_contacts TO platform_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON platform_rate_limits TO platform_runtime;
ALTER FUNCTION memberships_forbid_platform_staff() OWNER TO platform_runtime;
GRANT EXECUTE ON FUNCTION public.audit_integration_secret_import(text,text) TO platform_runtime;
COMMIT;
