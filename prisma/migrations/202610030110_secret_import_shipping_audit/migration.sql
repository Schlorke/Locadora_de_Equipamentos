BEGIN;
-- Replace only the provider condition, keeping the bridge and ACL from 0108 intact.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.audit_integration_secret_import(text,text)'::regprocedure) INTO definition;
  IF position('integration.provider NOT IN (''ASAAS'',''ZAPSIGN'',''WHATSAPP'',''PIX'')' IN definition)=0 THEN
    RAISE EXCEPTION 'SECRET_IMPORT_AUDIT_DEFINITION_UNEXPECTED: audit_integration_secret_import differs from 202610030108. No data changed. After authorized reconciliation: pnpm exec prisma migrate resolve --rolled-back 202610030110_secret_import_shipping_audit then pnpm exec prisma migrate deploy.' USING ERRCODE='23514';
  END IF;
  EXECUTE replace(definition,
    'integration.provider NOT IN (''ASAAS'',''ZAPSIGN'',''WHATSAPP'',''PIX'')',
    'integration.provider NOT IN (''ASAAS'',''ZAPSIGN'',''WHATSAPP'',''PIX'',''MELHOR_ENVIO'')');
END $$;
COMMIT;
