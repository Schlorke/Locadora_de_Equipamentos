BEGIN;

DO $$ BEGIN
 IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.organizations'::regclass) OR (SELECT relrowsecurity FROM pg_class WHERE oid='public.tenant_integrations'::regclass) THEN
  RAISE EXCEPTION 'Preflight platform_scope: routing tables must be global. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030102_platform_scope_foundation then pnpm exec prisma migrate deploy.';
 END IF;
 IF to_regclass('public.equipments') IS NULL OR to_regclass('public.client_profiles') IS NULL OR to_regclass('public.payments') IS NULL THEN
  RAISE EXCEPTION 'Preflight platform_scope: missing sentinel tables. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030102_platform_scope_foundation then pnpm exec prisma migrate deploy.';
 END IF;
END $$;
CREATE FUNCTION app_is_platform_context() RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT coalesce(current_setting('app.platform_scope',true),'')='on'
 AND NOT has_table_privilege(current_user,'public.equipments','SELECT')
 AND NOT has_table_privilege(current_user,'public.client_profiles','SELECT')
 AND NOT has_table_privilege(current_user,'public.payments','SELECT')
$$;
CREATE FUNCTION forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PLATFORM_HISTORY_DELETE_FORBIDDEN:%', TG_TABLE_NAME USING ERRCODE='23514'; END $$;
CREATE FUNCTION forbid_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PLATFORM_APPEND_ONLY:%', TG_TABLE_NAME USING ERRCODE='23514'; END $$;
CREATE VIEW platform_user_contacts AS SELECT id,name,email,"authEmailVerified" FROM users;
REVOKE ALL ON platform_user_contacts FROM PUBLIC;

COMMIT;
