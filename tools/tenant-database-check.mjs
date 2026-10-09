import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Pool } from 'pg'

const inventory = JSON.parse(
  fs.readFileSync(new URL('./tenant-models.json', import.meta.url), 'utf8')
)
const expected =
  "(\"tenantId\" = NULLIF(current_setting('app.tenant_id'::text, true), ''::text))"
export async function checkTenantDatabase(connection) {
  const issues = []
  const schema = fs.readFileSync(
    new URL('../prisma/schema.prisma', import.meta.url),
    'utf8'
  )
  const knownModels = new Set([
    ...inventory.tenantModels.map((row) => row.model),
    ...inventory.globalModels,
    ...inventory.platformModels.map((row) => row.model),
  ])
  const globalTables = []
  for (const model of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    if (!knownModels.has(model[1]))
      issues.push('MODEL_NOT_CLASSIFIED:' + model[1])
    if (inventory.globalModels.includes(model[1]))
      globalTables.push(/@@map\("([^"]+)"\)/.exec(model[2])?.[1] ?? model[1])
  }
  const role = await connection.query(`
    SELECT rolname, rolsuper, rolbypassrls, rolcreaterole
    FROM pg_roles WHERE rolname = current_user
  `)
  const current = role.rows[0]
  if (
    !current ||
    current.rolsuper ||
    current.rolbypassrls ||
    current.rolcreaterole
  )
    issues.push('RUNTIME_ROLE_CAN_BYPASS_ISOLATION')
  const privileged = await connection.query(`
    SELECT rolname FROM pg_roles
    WHERE (rolsuper OR rolbypassrls OR rolcreaterole) AND pg_has_role(current_user, oid, 'SET')
  `)
  if (privileged.rowCount) issues.push('RUNTIME_CAN_ASSUME_PRIVILEGED_ROLE')
  const tables = inventory.tenantModels.map((row) => row.table)
  const scopedTables = await connection.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId'"
  )
  for (const row of scopedTables.rows)
    if (
      !tables.includes(row.table_name) &&
      !globalTables.includes(row.table_name) &&
      !inventory.platformModels.some((value) => value.table === row.table_name)
    )
      issues.push('TENANT_TABLE_NOT_CLASSIFIED:' + row.table_name)
  const metadata = await connection.query(
    `
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
      pg_has_role(current_user, c.relowner, 'SET') AS can_own
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
  `,
    [tables]
  )
  const policies = await connection.query(
    `
    SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY($1::text[])
  `,
    [tables]
  )
  for (const table of tables) {
    const row = metadata.rows.find((value) => value.relname === table)
    if (!row || !row.relrowsecurity || !row.relforcerowsecurity)
      issues.push('RLS_NOT_FORCED:' + table)
    if (row?.can_own) issues.push('RUNTIME_OWNS_TABLE:' + table)
    const tablePolicies = policies.rows.filter(
      (value) => value.tablename === table
    )
    // Additional permissive policies combine with OR and can silently undo isolation.
    if (
      tablePolicies.length !== 1 ||
      tablePolicies[0]?.policyname !== 'tenant_isolation' ||
      tablePolicies[0]?.cmd !== 'ALL' ||
      tablePolicies[0]?.qual !== expected ||
      tablePolicies[0]?.with_check !== expected
    ) {
      issues.push('TENANT_POLICY_MISMATCH:' + table)
    }
  }
  const platform = await checkPlatformTables(connection, false)
  issues.push(...platform)
  return {
    ok: issues.length === 0,
    tables: tables.length,
    platformTables: inventory.platformModels.length,
    role: current?.rolname,
    issues,
  }
}

async function checkPlatformTables(connection, platformRole) {
  const issues = []
  const tables = inventory.platformModels.map((row) => row.table)
  const metadata = await connection.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
    pg_has_role(current_user,c.relowner,'SET') AS can_own,
    has_any_column_privilege(current_user,c.oid,'SELECT') AS can_read,
    has_any_column_privilege(current_user,c.oid,'INSERT') AS can_insert,
    has_any_column_privilege(current_user,c.oid,'UPDATE') AS can_update,
    has_table_privilege(current_user,c.oid,'DELETE') AS can_delete
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,
    [tables]
  )
  const policies = await connection.query(
    `SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[])`,
    [tables]
  )
  const triggers = await connection.query(
    `SELECT c.relname,t.tgname,t.tgenabled,p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal`,
    [tables]
  )
  for (const { table, read } of inventory.platformModels) {
    const row = metadata.rows.find((value) => value.relname === table)
    if (!row?.relrowsecurity || !row.relforcerowsecurity)
      issues.push('PLATFORM_RLS_NOT_FORCED:' + table)
    if (row?.can_own) issues.push('RUNTIME_OWNS_TABLE:' + table)
    const select =
      read === 'public'
        ? 'true'
        : read === 'platform'
          ? 'app_is_platform_context()'
          : '(' + expected + ' OR app_is_platform_context())'
    const expectedPolicies = [
      {
        policyname: 'platform_select',
        cmd: 'SELECT',
        qual: select,
        with_check: null,
      },
      {
        policyname: 'platform_insert',
        cmd: 'INSERT',
        qual: null,
        with_check: 'app_is_platform_context()',
      },
      {
        policyname: 'platform_update',
        cmd: 'UPDATE',
        qual: 'app_is_platform_context()',
        with_check: 'app_is_platform_context()',
      },
    ]
    const actual = policies.rows.filter((value) => value.tablename === table)
    if (
      actual.length !== 3 ||
      expectedPolicies.some(
        (policy) =>
          !actual.some((value) =>
            Object.entries(policy).every(([key, val]) => value[key] === val)
          )
      )
    )
      issues.push('PLATFORM_POLICY_MISMATCH:' + table)
    if (
      !triggers.rows.some(
        (t) =>
          t.relname === table &&
          t.tgname === table + '_no_delete' &&
          ['O', 'A'].includes(t.tgenabled) &&
          t.proname === 'forbid_delete'
      )
    )
      issues.push('PLATFORM_DELETE_GUARD_MISSING:' + table)
    if (platformRole) {
      if (
        !row?.can_read ||
        !row.can_insert ||
        !row.can_update ||
        row.can_delete
      )
        issues.push('PLATFORM_RUNTIME_PRIVILEGES:' + table)
    } else if (
      row?.can_insert ||
      row?.can_update ||
      row?.can_delete ||
      row?.can_read !== (read !== 'platform')
    )
      issues.push('APP_PLATFORM_PRIVILEGES:' + table)
  }
  return issues
}

export async function checkPlatformDatabase(connection) {
  const issues = []
  const role = (
    await connection.query(
      'SELECT rolname,rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user'
    )
  ).rows[0]
  if (!role || role.rolsuper || role.rolbypassrls || role.rolcreaterole)
    issues.push('RUNTIME_ROLE_CAN_BYPASS_ISOLATION')
  if (
    (
      await connection.query(
        "SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls OR rolcreaterole) AND pg_has_role(current_user,oid,'SET')"
      )
    ).rowCount
  )
    issues.push('RUNTIME_CAN_ASSUME_PRIVILEGED_ROLE')
  const seeds = ['settings', 'financial_settings', 'permissions', 'categories']
  const privileges = await connection.query(
    `SELECT c.relname,
    has_any_column_privilege(current_user,c.oid,'SELECT') AS can_read,
    has_any_column_privilege(current_user,c.oid,'INSERT') AS can_insert,
    has_any_column_privilege(current_user,c.oid,'UPDATE') AS can_update,
    has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,
    pg_has_role(current_user,c.relowner,'SET') AS can_own
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,
    [inventory.tenantModels.map((row) => row.table)]
  )
  for (const { table } of inventory.tenantModels) {
    const row = privileges.rows.find((value) => value.relname === table)
    if (
      !row ||
      row.can_own ||
      row.can_read ||
      row.can_update ||
      row.can_delete ||
      row.can_insert !== seeds.includes(table)
    )
      issues.push('PLATFORM_BUSINESS_PRIVILEGES:' + table)
  }
  if (
    (
      await connection.query(
        "SELECT has_any_column_privilege(current_user,'public.users','SELECT') OR has_any_column_privilege(current_user,'public.users','INSERT') OR has_any_column_privilege(current_user,'public.users','UPDATE') OR has_table_privilege(current_user,'public.users','DELETE') AS forbidden"
      )
    ).rows[0]?.forbidden
  )
    issues.push('PLATFORM_USERS_PRIVILEGES')
  issues.push(...(await checkPlatformTables(connection, true)))
  return {
    ok: issues.length === 0,
    tables: inventory.platformModels.length,
    role: role?.rolname,
    issues,
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  const platformOnly = process.argv.includes('--platform')
  const connectionString = platformOnly
    ? process.env.PLATFORM_RUNTIME_DATABASE_URL
    : process.env.TENANT_RUNTIME_DATABASE_URL
  if (!connectionString) {
    process.stderr.write(
      'Set ' +
        (platformOnly
          ? 'PLATFORM_RUNTIME_DATABASE_URL'
          : 'TENANT_RUNTIME_DATABASE_URL') +
        ' explicitly to verify the runtime role.\n'
    )
    process.exitCode = 1
  } else {
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      max: 1,
    })
    try {
      const result = await (platformOnly
        ? checkPlatformDatabase(pool)
        : checkTenantDatabase(pool))
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      if (!result.ok) process.exitCode = 1
    } catch {
      process.stderr.write(
        'Database isolation verification could not complete.\n'
      )
      process.exitCode = 1
    } finally {
      await pool.end()
    }
  }
}
