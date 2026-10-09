import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Client, Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  PLATFORM,
  TENANT_SLUG_RE,
  isTenantSlug,
} from '../../packages/contracts/src/platform'
import {
  TENANT_SLUG_PATTERN,
  classifySlugs,
  loadReservedSubdomains,
  resolveTarget,
  runTenantSlugPreflight,
} from '../../tools/tenant-slug-preflight.mjs'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'

const toolPath = path.join(process.cwd(), 'tools', 'tenant-slug-preflight.mjs')
const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
const slugMigration = '202609260005_organization_slug_policy'
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((name) => /^\d{12}_[a-z0-9_]+$/.test(name))
  .sort()

function migrationSql(name: string): string {
  if (!migrations.includes(name)) throw new Error('Unknown migration ' + name)
  return fs.readFileSync(
    path.join(migrationsDir, name, 'migration.sql'),
    'utf8'
  )
}

const valid = [
  'ab',
  'a1',
  '1a',
  '00',
  'a-b',
  '9lives',
  'xn-a',
  'locadora-a',
  'a'.repeat(63),
  'a' + '-b'.repeat(31),
]
const invalid = [
  '',
  'a',
  'x',
  '-',
  '--',
  'a--b',
  'xn--abc',
  'abc---def',
  '-ab',
  'ab-',
  'Ab',
  'AB',
  'ab_c',
  'ação',
  'é1',
  'a.b',
  'a b',
  ' ab',
  'ab\n',
  'ａｂ',
  'a'.repeat(64),
  'b' + '-b'.repeat(31) + 'b',
]

describe('Tenant slug policy: one rule in contract, tool and database', () => {
  it('uses the exact TENANT_SLUG_RE of the platform contract', () => {
    expect(TENANT_SLUG_PATTERN.source).toBe(TENANT_SLUG_RE.source)
    expect(TENANT_SLUG_PATTERN.flags).toBe(TENANT_SLUG_RE.flags)
    for (const slug of valid)
      expect([slug, TENANT_SLUG_PATTERN.test(slug)]).toEqual([slug, true])
    for (const slug of invalid)
      expect([slug, TENANT_SLUG_PATTERN.test(slug)]).toEqual([slug, false])
    expect('b' + '-b'.repeat(31) + 'b').toHaveLength(64)
  })

  it('reads the reserved labels from platform.json and flags invalid and reserved slugs', () => {
    const reserved = loadReservedSubdomains()
    expect(reserved).toEqual([...PLATFORM.reservedSubdomains])
    const rows = [
      { id: '1', slug: 'locadora-a', status: 'ACTIVE' },
      { id: '2', slug: 'admin', status: 'ACTIVE' },
      { id: '3', slug: 'Bad_Slug', status: 'SUSPENDED' },
      { id: '4', slug: 'm', status: 'ACTIVE' },
    ]
    expect(classifySlugs(rows, reserved)).toEqual([
      { id: '2', slug: 'admin', status: 'ACTIVE', reasons: ['RESERVED'] },
      {
        id: '3',
        slug: 'Bad_Slug',
        status: 'SUSPENDED',
        reasons: ['INVALID_DNS_LABEL'],
      },
      {
        id: '4',
        slug: 'm',
        status: 'ACTIVE',
        reasons: ['INVALID_DNS_LABEL', 'RESERVED'],
      },
    ])
    for (const slug of [...valid, ...invalid, ...reserved])
      expect([
        slug,
        classifySlugs([{ id: 'x', slug, status: 'ACTIVE' }], reserved)
          .length === 0,
      ]).toEqual([slug, isTenantSlug(slug)])
  })

  it('honours the Prisma schema parameter without passing it to node-postgres', () => {
    expect(
      resolveTarget(
        'postgresql://u@localhost:5432/db?schema=tenant_x&sslmode=disable'
      )
    ).toEqual({
      connectionString: 'postgresql://u@localhost:5432/db?sslmode=disable',
      schema: 'tenant_x',
    })
    expect(resolveTarget('postgresql://u@localhost:5432/db').schema).toBe(
      'public'
    )
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Tenant slug policy in the database',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
    const readerRole = 'slug_reader_' + suffix
    const schemas: string[] = []
    const clients: Client[] = []
    let connectionString: string
    let admin: Pool

    beforeAll(() => {
      if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
        throw new Error('Disposable database opt-in required')
      connectionString = requireTestDatabase(process.env)
      admin = new Pool({ connectionString, max: 2 })
    })

    afterAll(async () => {
      for (const client of clients) await client.end().catch(() => undefined)
      if (!admin) return
      for (const schema of schemas)
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      const role = await admin.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [readerRole]
      )
      if (role.rowCount) {
        await admin.query(`DROP OWNED BY "${readerRole}"`)
        await admin.query(`DROP ROLE "${readerRole}"`)
      }
      await admin.end()
    }, 60_000)

    /** Scratch schema with the real migrations applied up to `last` (inclusive). */
    async function migratedSchema(
      last: string
    ): Promise<{ schema: string; client: Client }> {
      const end = migrations.indexOf(last)
      if (end < 0) throw new Error('Unknown migration ' + last)
      const schema = `slug_policy_${suffix}_${schemas.length}`
      schemas.push(schema)
      await admin.query(`CREATE SCHEMA "${schema}"`)
      const client = new Client({ connectionString })
      clients.push(client)
      await client.connect()
      await client.query(`SET search_path TO "${schema}"`)
      for (const name of migrations.slice(0, end + 1))
        await client.query(migrationSql(name))
      return { schema, client }
    }

    async function organizations(
      client: Client,
      slugs: string[]
    ): Promise<void> {
      for (const [index, slug] of slugs.entries())
        await client.query(
          `INSERT INTO "organizations" ("id", "slug", "name", "updatedAt") VALUES ($1, $2, 'Fixture', now())`,
          ['org-' + index, slug]
        )
    }

    async function constraint(schema: string) {
      const result = await admin.query<{ convalidated: boolean }>(
        `SELECT con.convalidated FROM pg_constraint con
       WHERE con.conrelid = to_regclass($1) AND con.conname = 'organizations_slug_dns_label'`,
        [`"${schema}"."organizations"`]
      )
      return result.rows[0] ?? null
    }

    /** Connection to `schema`, as the admin or as a role URL from `createLoginRole`. */
    function schemaUrl(schema: string, roleUrl = connectionString): string {
      const url = new URL(roleUrl)
      url.searchParams.set('schema', schema)
      return url.toString()
    }

    function cli(url: string) {
      return spawnSync(process.execPath, [toolPath], {
        env: { ...process.env, DATABASE_URL: url },
        encoding: 'utf8',
        timeout: 30_000,
      })
    }

    it('keeps organizations global, without row level security, and applies the CHECK in the migrated database', async () => {
      const table = await admin.query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.organizations'::regclass`
      )
      expect(table.rows[0]).toEqual({ relrowsecurity: false })
      expect(await constraint('public')).toEqual({ convalidated: true })
    })

    it('aborts the migration on invalid slugs without changing data, then enforces the DNS label rule', async () => {
      const { schema, client } = await migratedSchema(
        '202609260004_payment_active_charge_unique'
      )
      await organizations(client, [
        'locadora-a',
        'x',
        'a--b',
        'Locadora_B',
        'a'.repeat(64),
      ])
      const snapshot = async () =>
        (
          await admin.query(
            `SELECT "id", "slug" FROM "${schema}"."organizations" ORDER BY "id"`
          )
        ).rows
      const before = await snapshot()

      const failure = client.query(migrationSql(slugMigration))
      await expect(failure).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          'Preflight organizations_slug_dns_label: 4 organização(ões) fora da política'
        ),
      })
      const message = await failure.catch((error: Error) => error.message)
      for (const slug of ['x', 'a--b', 'Locadora_B', 'a'.repeat(64)])
        expect(message).toContain(`slug='${slug}'`)
      expect(message).not.toContain(`slug='locadora-a'`)
      expect(message).toContain('nada foi alterado')
      expect(await snapshot()).toEqual(before)
      expect(await constraint(schema)).toBeNull()

      await admin.query(
        `DELETE FROM "${schema}"."organizations" WHERE "slug" <> 'locadora-a'`
      )
      await client.query(migrationSql(slugMigration))
      expect(await constraint(schema)).toEqual({ convalidated: true })

      for (const [index, slug] of [...valid, ...invalid].entries()) {
        if (slug === 'locadora-a') continue
        const insert = client.query(
          `INSERT INTO "organizations" ("id", "slug", "name", "updatedAt") VALUES ($1, $2, 'Matrix', now())`,
          ['matrix-' + index, slug]
        )
        if (TENANT_SLUG_RE.test(slug))
          await expect(insert).resolves.toBeDefined()
        else
          await expect(insert).rejects.toMatchObject({
            code: '23514',
            constraint: 'organizations_slug_dns_label',
          })
      }
      for (const slug of ['x', 'a--b', 'a'.repeat(64)])
        await expect(
          client.query(
            `UPDATE "organizations" SET "slug" = $1 WHERE "slug" = 'locadora-a'`,
            [slug]
          )
        ).rejects.toMatchObject({
          code: '23514',
          constraint: 'organizations_slug_dns_label',
        })
    }, 60_000)

    it('refuses to trust the preflight when organizations has row level security', async () => {
      const { schema, client } = await migratedSchema(
        '202609260004_payment_active_charge_unique'
      )
      await client.query(
        'ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY'
      )
      await expect(
        client.query(migrationSql(slugMigration))
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          '"organizations" tem row level security'
        ),
      })
      expect(await constraint(schema)).toBeNull()
    }, 60_000)

    it('lists invalid and reserved slugs read-only and exits 1 until they are fixed', async () => {
      const { schema, client } = await migratedSchema(
        '202609260004_payment_active_charge_unique'
      )
      await organizations(client, ['locadora-a', 'admin', 'Bad_Slug', 'm'])
      const url = schemaUrl(schema)

      const result = await runTenantSlugPreflight({ connectionString: url })
      expect(result).toEqual({
        ok: false,
        schema,
        checked: 4,
        violations: expect.arrayContaining([
          {
            id: 'org-1',
            slug: 'admin',
            status: 'ACTIVE',
            reasons: ['RESERVED'],
          },
          {
            id: 'org-2',
            slug: 'Bad_Slug',
            status: 'ACTIVE',
            reasons: ['INVALID_DNS_LABEL'],
          },
          {
            id: 'org-3',
            slug: 'm',
            status: 'ACTIVE',
            reasons: ['INVALID_DNS_LABEL', 'RESERVED'],
          },
        ]),
      })
      expect(result.violations).toHaveLength(3)

      const failing = cli(url)
      expect(failing.status).toBe(1)
      expect(JSON.parse(failing.stdout)).toMatchObject({
        ok: false,
        checked: 4,
      })
      expect(failing.stderr).toContain(
        '3 organization(s) with a slug outside the policy'
      )
      expect(failing.stdout + failing.stderr).not.toContain(connectionString)

      // Read-only: nothing was touched by the tool.
      expect(
        (
          await admin.query(
            `SELECT "slug" FROM "${schema}"."organizations" ORDER BY "id"`
          )
        ).rows.map((row) => row.slug)
      ).toEqual(['locadora-a', 'admin', 'Bad_Slug', 'm'])

      await admin.query(
        `DELETE FROM "${schema}"."organizations" WHERE "slug" <> 'locadora-a'`
      )
      const passing = cli(url)
      expect(passing.status).toBe(0)
      expect(JSON.parse(passing.stdout)).toEqual({
        ok: true,
        schema,
        checked: 1,
        violations: [],
      })

      const missing = spawnSync(process.execPath, [toolPath], {
        env: { ...process.env, DATABASE_URL: '' },
        encoding: 'utf8',
        timeout: 30_000,
      })
      expect(missing.status).toBe(1)
      expect(missing.stderr).toContain('Set DATABASE_URL')
    }, 60_000)

    it('fails instead of passing empty when a row level security policy would hide organizations', async () => {
      const { schema, client } = await migratedSchema(
        '202609260004_payment_active_charge_unique'
      )
      await organizations(client, ['Bad_Slug'])
      // With a password: the CI service authenticates TCP clients with scram-sha-256.
      const readerUrl = await createLoginRole(
        admin,
        connectionString,
        readerRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${readerRole}"`)
      await admin.query(
        `GRANT SELECT ON "${schema}"."organizations" TO "${readerRole}"`
      )
      await admin.query(
        `ALTER TABLE "${schema}"."organizations" ENABLE ROW LEVEL SECURITY`
      )
      await admin.query(
        `CREATE POLICY hide_all ON "${schema}"."organizations" USING (false)`
      )
      const url = schemaUrl(schema, readerUrl)

      await expect(
        runTenantSlugPreflight({ connectionString: url })
      ).rejects.toMatchObject({ code: '42501' })
      const blocked = cli(url)
      expect(blocked.status).toBe(1)
      expect(blocked.stderr).toContain(
        'Tenant slug preflight could not complete (42501'
      )
      expect(blocked.stdout).toBe('')
    }, 60_000)
  }
)
