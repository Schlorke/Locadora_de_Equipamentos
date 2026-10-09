-- DBA-only, idempotent. Execute AFTER platform migrations; never embed passwords.
-- Configure LOGIN/password out of band. Existing passwords and LOGIN are preserved.
BEGIN;
DO $$ BEGIN
 IF current_user='app_runtime' THEN RAISE EXCEPTION 'Run this script as the separate migration administrator'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_runtime') THEN CREATE ROLE app_runtime NOLOGIN; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='app_runtime')) THEN RAISE EXCEPTION 'app_runtime must not inherit or assume other roles'; END IF;
END $$;
ALTER ROLE app_runtime NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
GRANT USAGE ON SCHEMA public TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, app_runtime;
GRANT SELECT,INSERT,UPDATE ON "zoho_mail_commands" TO app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "zoho_mail_tokens", "whatsapp_conversations", "whatsapp_messages", "addresses", "carts", "cart_items", "categories", "equipments", "equipment_units", "quotes", "quote_items", "rental_items", "rentals", "settings", "maintenances", "payments", "financial_settings", "quote_adjustments", "client_documents", "deliveries", "vehicles", "drivers", "contracts", "audit_logs", "notifications", "permissions", "outbox_events", "webhook_inbox", "payment_attempts", "client_profiles", "contract_signature_attempts", "users", "accounts", "sessions", "verificationtokens", "auth_sessions", "auth_accounts", "auth_verifications", "auth_rate_limits", "platform_rate_limits", "organizations", "memberships", "tenant_integrations", "external_resource_tenants" TO app_runtime;
REVOKE ALL ON "plans", "plan_versions", "subscriptions", "subscription_events", "platform_invoices", "entitlement_overrides", "trial_claims", "payment_accounts", "payment_account_provisioning_requests", "integration_secrets", "payout_requests", "platform_webhook_inbox", "platform_outbox_events", "platform_audit_logs", "platform_staff", "support_access_grants", "legal_acceptances", "tenant_usage_snapshots", platform_user_contacts FROM app_runtime;
GRANT SELECT ON "plans", "plan_versions", "subscriptions", "subscription_events", "platform_invoices", "entitlement_overrides", "payment_accounts", "integration_secrets", "payout_requests", "support_access_grants", "legal_acceptances", "tenant_usage_snapshots" TO app_runtime;
COMMIT;
