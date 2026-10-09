import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Pool } from 'pg'
import { checkPlatformDatabase } from './tenant-database-check.mjs'

const reserved = JSON.parse(
  fs.readFileSync(
    new URL('../packages/contracts/src/platform.json', import.meta.url),
    'utf8'
  )
).reservedSubdomains

/** Read-only readiness check. Reports identifiers and missing variable names, never values. */
export async function checkPlatformPreflight(connection, env = process.env) {
  const issues = []
  const missing = await connection.query(
    `SELECT o.id FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s."tenantId"=o.id AND s.status<>'CANCELED')`
  )
  for (const row of missing.rows)
    issues.push({ code: 'SUBSCRIPTION_REQUIRED', id: row.id })
  const owners = await connection.query(
    `SELECT id FROM organizations WHERE origin='ONBOARDING' AND "ownerUserId" IS NULL`
  )
  for (const row of owners.rows)
    issues.push({ code: 'OWNER_REQUIRED', id: row.id })
  const integrations = await connection.query(
    `SELECT id,"credentialsRef" FROM tenant_integrations WHERE "credentialSource"='ENV_REF' AND status='ACTIVE'`
  )
  for (const row of integrations.rows) {
    if (!/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/.test(row.credentialsRef ?? ''))
      issues.push({ code: 'CREDENTIAL_REFERENCE_INVALID', id: row.id })
    else {
      const variable = row.credentialsRef.slice(4) + '_SECRET'
      if (!env[variable]?.trim())
        issues.push({ code: 'ENV_REFERENCE_MISSING', id: row.id, variable })
    }
  }
  const accounts = await connection.query(
    `SELECT a.id FROM payment_accounts a WHERE a."disconnectedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM integration_secrets s WHERE s."integrationId"=a."integrationId" AND s."tenantId"=a."tenantId" AND s.purpose='ASAAS_API_KEY' AND s.state='ACTIVE')`
  )
  for (const row of accounts.rows)
    issues.push({ code: 'PAYMENT_ACCOUNT_SECRET_REQUIRED', id: row.id })
  const slugs = await connection.query(
    'SELECT id FROM organizations WHERE slug=ANY($1::text[])',
    [reserved]
  )
  for (const row of slugs.rows)
    issues.push({ code: 'RESERVED_SLUG', id: row.id })
  return { ok: issues.length === 0, issues }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  if (!process.env.PLATFORM_RUNTIME_DATABASE_URL) {
    process.stderr.write('Set PLATFORM_RUNTIME_DATABASE_URL explicitly.\n')
    process.exitCode = 1
  } else {
    const pool = new Pool({
      connectionString: process.env.PLATFORM_RUNTIME_DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
    })
    let client
    try {
      const isolation = await checkPlatformDatabase(pool)
      if (!isolation.ok) throw new Error('PLATFORM_ISOLATION_INVALID')
      client = await pool.connect()
      await client.query('BEGIN READ ONLY')
      await client.query("SELECT set_config('app.platform_scope','on',true)")
      const result = await checkPlatformPreflight(client)
      await client.query('ROLLBACK')
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      if (!result.ok) process.exitCode = 1
    } catch {
      process.stderr.write(
        'Platform preflight could not complete; no changes applied.\n'
      )
      process.exitCode = 1
    } finally {
      if (client) {
        await client.query('ROLLBACK').catch(() => {})
        client.release()
      }
      await pool.end()
    }
  }
}
