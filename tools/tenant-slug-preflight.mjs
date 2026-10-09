// Read-only pre-deploy check of tenant slugs (docs/features/tenant-slug-policy.md).
// Lists organizations whose slug is not a platform DNS label or is reserved by the platform
// (packages/contracts/src/platform.json). Exit 1 when any is found or when the check cannot run.
// Usage: DATABASE_URL=postgresql://... node tools/tenant-slug-preflight.mjs
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Client } from 'pg'

/**
 * Same rule as TENANT_SLUG_RE (packages/contracts/src/platform.ts) and the database CHECK
 * organizations_slug_dns_label: 2..63 characters, [a-z0-9-], no hyphen at either end, no "--".
 */
export const TENANT_SLUG_PATTERN = /^(?!.*--)[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

const PLATFORM_FILE = new URL(
  '../packages/contracts/src/platform.json',
  import.meta.url
)

/** Reserved labels, read from the single source used by the web host and the contracts. */
export function loadReservedSubdomains(file = PLATFORM_FILE) {
  const platform = JSON.parse(fs.readFileSync(file, 'utf8'))
  const reserved = platform?.reservedSubdomains
  if (
    !Array.isArray(reserved) ||
    reserved.length === 0 ||
    !reserved.every((label) => typeof label === 'string' && label.length > 0)
  )
    throw new Error('platform.json: reservedSubdomains is missing or invalid')
  return reserved
}

/** Pure classification: one entry per organization that breaks the policy. */
export function classifySlugs(rows, reserved) {
  const reservedLabels = new Set(reserved)
  const violations = []
  for (const row of rows) {
    const reasons = []
    if (typeof row.slug !== 'string' || !TENANT_SLUG_PATTERN.test(row.slug))
      reasons.push('INVALID_DNS_LABEL')
    if (reservedLabels.has(row.slug)) reasons.push('RESERVED')
    if (reasons.length > 0)
      violations.push({
        id: row.id,
        slug: row.slug,
        status: row.status,
        reasons,
      })
  }
  return violations
}

/** Honours the Prisma `schema` URL parameter (default public) and hides it from node-postgres. */
export function resolveTarget(connectionString) {
  const url = new URL(connectionString)
  const schema = url.searchParams.get('schema') || 'public'
  url.searchParams.delete('schema')
  return { connectionString: url.toString(), schema }
}

function quoteIdentifier(value) {
  return '"' + value.replaceAll('"', '""') + '"'
}

export async function runTenantSlugPreflight({
  connectionString,
  reserved = loadReservedSubdomains(),
}) {
  const target = resolveTarget(connectionString)
  const client = new Client({
    connectionString: target.connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  })
  await client.connect()
  try {
    await client.query('BEGIN TRANSACTION READ ONLY')
    // "organizations" is global and has no row level security. If a policy ever applied to this
    // role, PostgreSQL raises instead of silently hiding rows, so the check can never pass empty.
    await client.query('SET LOCAL row_security = off')
    const result = await client.query(
      `SELECT "id", "slug", "status"::text AS "status" FROM ${quoteIdentifier(target.schema)}."organizations" ORDER BY "slug", "id"`
    )
    const violations = classifySlugs(result.rows, reserved)
    return {
      ok: violations.length === 0,
      schema: target.schema,
      checked: result.rowCount ?? result.rows.length,
      violations,
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    process.stderr.write(
      'Set DATABASE_URL to the database that will receive the deploy.\n'
    )
    process.exitCode = 1
  } else {
    try {
      const result = await runTenantSlugPreflight({ connectionString })
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      if (!result.ok) {
        process.stderr.write(
          `${result.violations.length} organization(s) with a slug outside the policy; adjust them with approval before the deploy.\n`
        )
        process.exitCode = 1
      }
    } catch (error) {
      // Server errors carry an SQLSTATE and never the connection string; anything else stays generic.
      const detail =
        error &&
        typeof error === 'object' &&
        typeof error.code === 'string' &&
        /^[0-9A-Z]{5}$/.test(error.code)
          ? ` (${error.code}: ${error.message})`
          : ''
      process.stderr.write(
        `Tenant slug preflight could not complete${detail}.\n`
      )
      process.exitCode = 1
    }
  }
}
