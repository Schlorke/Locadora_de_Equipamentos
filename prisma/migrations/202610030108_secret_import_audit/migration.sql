BEGIN;

-- Narrow bridge: the platform may append this fixed event, never read tenant audit data.
CREATE FUNCTION public.audit_integration_secret_import(integration_id text, plan_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE integration public.tenant_integrations%ROWTYPE;
        previous_tenant text;
BEGIN
  IF plan_hash IS NULL OR plan_hash !~ '^[a-f0-9]{64}$'
     OR coalesce(current_setting('app.platform_scope',true),'') <> 'on'
     OR coalesce(current_setting('role',true),'none') NOT IN ('none',session_user)
     OR NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname=session_user
          AND NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
          AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid))
     OR has_schema_privilege(session_user,'public','CREATE')
     OR NOT (has_table_privilege(session_user,'public.integration_secrets','INSERT')
             AND has_table_privilege(session_user,'public.integration_secrets','UPDATE'))
     OR has_table_privilege(session_user,'public.audit_logs','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     OR has_any_column_privilege(session_user,'public.audit_logs','SELECT,INSERT,UPDATE')
     OR has_any_column_privilege(session_user,'public.payments','SELECT,INSERT,UPDATE')
     OR has_any_column_privilege(session_user,'public.client_profiles','SELECT,INSERT,UPDATE') THEN
    RAISE EXCEPTION 'SECRET_IMPORT_AUDIT_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO integration FROM public.tenant_integrations WHERE id=integration_id FOR UPDATE;
  IF NOT FOUND OR integration."credentialSource" <> 'VAULT' OR integration.status='DISABLED'
     OR integration.provider NOT IN ('ASAAS','ZAPSIGN','WHATSAPP','PIX') THEN
    RAISE EXCEPTION 'SECRET_IMPORT_AUDIT_INVALID' USING ERRCODE='23514';
  END IF;
  previous_tenant := current_setting('app.tenant_id',true);
  PERFORM set_config('app.tenant_id',integration."tenantId",true);
  IF NOT EXISTS (SELECT 1 FROM public.integration_secrets s
     WHERE s."integrationId"=integration.id AND s."tenantId"=integration."tenantId" AND s.state='ACTIVE') THEN
    RAISE EXCEPTION 'SECRET_IMPORT_AUDIT_INVALID' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.audit_logs(id,"tenantId",action,entity,"entityId",changes)
    VALUES ('secret_import_' || gen_random_uuid()::text,integration."tenantId",'integration.secrets.imported',
      'TenantIntegration',integration.id,jsonb_build_object('planHash',plan_hash,'provider',integration.provider));
  PERFORM set_config('app.tenant_id',coalesce(previous_tenant,''),true);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.audit_integration_secret_import(text,text) FROM PUBLIC;
COMMIT;
