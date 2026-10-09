import type { Prisma, PrismaClient } from '@prisma/client'

class InvalidPlatformRole extends Error {
  constructor() {
    super('Platform database role is not isolated')
  }
}

type Operation<T> = (tx: Prisma.TransactionClient) => Promise<T>
export type PlatformTransaction = <T>(operation: Operation<T>) => Promise<T>
export type PlatformScope = {
  withPlatformTransaction: PlatformTransaction
  withProvisioningTransaction: <T>(
    tenantId: string,
    operation: Operation<T>
  ) => Promise<T>
}

/** Verify the actual connected role on every transaction, including inherited/column grants. */
async function assertPlatformRole(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ safe: boolean }[]>`
    SELECT app_is_platform_context() AND current_user=session_user
      AND NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
      AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid)
      AND NOT has_schema_privilege(current_user,'public','CREATE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND (
          c.relowner=r.oid OR
          CASE
            WHEN c.relname='platform_rate_limits' THEN false
            WHEN c.relname IN ('organizations','memberships','tenant_integrations')
              OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid=c.oid AND polname='platform_insert')
              THEN has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege(current_user,c.oid,'REFERENCES')
            WHEN c.relname='platform_user_contacts'
              THEN has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES')
            WHEN c.relname IN ('settings','financial_settings','permissions','categories')
              THEN has_table_privilege(current_user,c.oid,'SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege(current_user,c.oid,'SELECT,UPDATE,REFERENCES')
            ELSE has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
          END
        )
      )
      AND has_table_privilege(current_user,'public.platform_outbox_events','SELECT')
      AND has_table_privilege(current_user,'public.platform_outbox_events','INSERT')
      AND has_table_privilege(current_user,'public.platform_outbox_events','UPDATE') AS safe
    FROM pg_roles r WHERE r.rolname=current_user
  `
  if (rows.length !== 1 || rows[0]?.safe !== true)
    throw new InvalidPlatformRole()
}

export function createPlatformScope(
  prisma: PrismaClient,
  options: { readOnly?: boolean } = {}
): PlatformScope {
  async function scoped<T>(
    tenantId: string,
    operation: Operation<T>
  ): Promise<T> {
    return prisma.$transaction(
      async (tx) => {
        if (options.readOnly) await tx.$executeRaw`SET TRANSACTION READ ONLY`
        // LOCAL settings are cleared on commit/rollback, including pooled connection reuse.
        await tx.$queryRaw`SELECT set_config('app.platform_scope','on',true), set_config('app.tenant_id',${tenantId},true)`
        await assertPlatformRole(tx)
        return operation(tx)
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
  }
  return {
    withPlatformTransaction: (operation) => scoped('', operation),
    async withProvisioningTransaction(tenantId, operation) {
      if (!tenantId || tenantId !== tenantId.trim())
        throw new Error('Provisioning tenant is required')
      return scoped(tenantId, operation)
    },
  }
}
