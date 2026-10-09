import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client, Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'

/**
 * Data preflights of 202609260001-0004 run while "rentals" and "payments" have FORCE ROW LEVEL
 * SECURITY (202609250005). The real migration SQL is replayed into a scratch schema by a role
 * that OWNS the tables but is neither superuser nor BYPASSRLS (a dedicated production migrator),
 * with rows written under organizations and without one. Each preflight must see every row,
 * abort with its reconciliation message, and leave data and RLS exactly as they were.
 */
const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
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

function first<T>(rows: T[]): T {
  const [row] = rows
  if (row === undefined) throw new Error('Query returned no rows')
  return row
}

function through(last: string): string[] {
  const end = migrations.indexOf(last)
  if (end < 0) throw new Error('Unknown migration ' + last)
  return migrations.slice(0, end + 1)
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Migration preflights under FORCE ROW LEVEL SECURITY',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
    const ownerRole = 'mig_owner_' + suffix
    const tenantA = 'org-a'
    const tenantB = 'org-b'
    const schemas: string[] = []
    const owners: Client[] = []
    let admin: Pool
    let ownerUrl: string
    let database: string

    beforeAll(async () => {
      if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
        throw new Error('Disposable database opt-in required')
      const connectionString = requireTestDatabase(process.env)
      admin = new Pool({ connectionString, max: 2 })
      database = first(
        (
          await admin.query<{ name: string }>(
            'SELECT current_database() AS name'
          )
        ).rows
      ).name
      // With a password: the CI service authenticates TCP clients with scram-sha-256.
      ownerUrl = await createLoginRole(
        admin,
        connectionString,
        ownerRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      // The legacy baseline starts with CREATE SCHEMA IF NOT EXISTS "public", which checks this privilege.
      await admin.query(
        `GRANT CREATE ON DATABASE "${database}" TO "${ownerRole}"`
      )
    }, 60_000)

    afterAll(async () => {
      for (const owner of owners) await owner.end().catch(() => undefined)
      if (!admin) return
      for (const schema of schemas)
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.query(`DROP OWNED BY "${ownerRole}"`).catch(() => undefined)
      await admin.query(`DROP ROLE IF EXISTS "${ownerRole}"`)
      await admin.end()
    }, 60_000)

    /** Creates a schema owned by the migrator and applies the real migrations up to `last` as that role. */
    async function migratedSchema(
      last: string
    ): Promise<{ schema: string; owner: Client }> {
      const schema = `mig_rls_${suffix}_${schemas.length}`
      schemas.push(schema)
      await admin.query(
        `CREATE SCHEMA "${schema}" AUTHORIZATION "${ownerRole}"`
      )
      const owner = new Client({ connectionString: ownerUrl })
      owners.push(owner)
      await owner.connect()
      await owner.query(`SET search_path TO "${schema}"`)
      const role = await owner.query<{
        rolsuper: boolean
        rolbypassrls: boolean
      }>(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
      )
      expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
      for (const name of through(last)) await owner.query(migrationSql(name))
      return { schema, owner }
    }

    /** Global rows plus one quote per organization, written by the owner under each tenant. */
    async function seed(schema: string, owner: Client): Promise<void> {
      await owner.query(
        `INSERT INTO "organizations" ("id", "slug", "name", "updatedAt")
       VALUES ($1, $1, 'Fixture A', now()), ($2, $2, 'Fixture B', now())`,
        [tenantA, tenantB]
      )
      await owner.query(
        `INSERT INTO "users" ("id", "email", "updatedAt") VALUES ('user-1', 'fixture@example.test', now())`
      )
      for (const tenant of [tenantA, tenantB]) {
        await asTenant(
          owner,
          tenant,
          `INSERT INTO "quotes" ("id", "name", "email", "phone", "updatedAt", "tenantId")
        VALUES ('quote-${tenant}', 'Fixture', 'fixture@example.test', '0', now(), $1)`,
          [tenant]
        )
      }
      // Legacy quote without organization, visible to nobody through the policy.
      await admin.query(`INSERT INTO "${schema}"."quotes" ("id", "name", "email", "phone", "updatedAt")
      VALUES ('quote-legacy', 'Legacy', 'legacy@example.test', '0', now())`)
    }

    async function asTenant(
      owner: Client,
      tenant: string,
      sql: string,
      values: unknown[] = []
    ): Promise<void> {
      await owner.query('BEGIN')
      try {
        await owner.query(`SELECT set_config('app.tenant_id', $1, true)`, [
          tenant,
        ])
        await owner.query(sql, values)
        await owner.query('COMMIT')
      } catch (error) {
        await owner.query('ROLLBACK')
        throw error
      }
    }

    async function rentalRow(
      owner: Client,
      schema: string,
      id: string,
      tenant: string | null,
      status: string | null,
      quote: string | null
    ) {
      const sql = `INSERT INTO "rentals" ("id", "startdate", "enddate", "total", "userid", "status", "quoteId", "tenantId")
      VALUES ($1, now(), now() + interval '1 day', 10, 'user-1', $2, $3, $4)`
      if (tenant)
        await asTenant(owner, tenant, sql, [id, status, quote, tenant])
      else
        await admin.query(sql.replace('"rentals"', `"${schema}"."rentals"`), [
          id,
          status,
          quote,
          null,
        ])
    }

    async function paymentRow(
      owner: Client,
      schema: string,
      id: string,
      tenant: string | null,
      quote: string,
      status: string
    ) {
      const sql = `INSERT INTO "payments" ("id", "amount", "method", "status", "type", "dueDate", "updatedAt", "quoteId", "tenantId")
      VALUES ($1, 10, 'PIX', $2::"PaymentStatus", 'DEPOSIT', now(), now(), $3, $4)`
      if (tenant)
        await asTenant(owner, tenant, sql, [id, status, quote, tenant])
      else
        await admin.query(
          sql
            .replace('"payments"', `"${schema}"."payments"`)
            .replace('"PaymentStatus"', `"${schema}"."PaymentStatus"`),
          [id, status, quote, null]
        )
    }

    async function rowSecurity(schema: string, table: string) {
      const result = await admin.query<{
        relrowsecurity: boolean
        relforcerowsecurity: boolean
        policies: string[]
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity,
         ARRAY(SELECT p.policyname::text FROM pg_policies p WHERE p.schemaname = $1 AND p.tablename = $2 ORDER BY 1) AS policies
       FROM pg_class c WHERE c.oid = to_regclass($3)`,
        [schema, table, `"${schema}"."${table}"`]
      )
      return result.rows[0]
    }

    const forced = {
      relrowsecurity: true,
      relforcerowsecurity: true,
      policies: ['tenant_isolation'],
    }

    async function snapshot(
      schema: string,
      table: string,
      columns: string
    ): Promise<unknown[]> {
      return (
        await admin.query(
          `SELECT ${columns} FROM "${schema}"."${table}" ORDER BY "id"`
        )
      ).rows
    }

    async function ownerCount(owner: Client, table: string): Promise<number> {
      return Number(
        first(
          (
            await owner.query<{ total: string }>(
              `SELECT count(*) AS total FROM "${table}"`
            )
          ).rows
        ).total
      )
    }

    it('202609260001 sees duplicated rentals of every organization and aborts without changes', async () => {
      const { schema, owner } = await migratedSchema(
        '202609250013_tenant_settings_addresses'
      )
      await seed(schema, owner)
      // Simulates a database where the guarantee of 202609250005 was lost, the case this preflight exists for.
      await owner.query('DROP INDEX "rentals_tenant_quote_unique"')
      await rentalRow(
        owner,
        schema,
        'rental-a1',
        tenantA,
        'ACTIVE',
        'quote-org-a'
      )
      await rentalRow(
        owner,
        schema,
        'rental-a2',
        tenantA,
        'ACTIVE',
        'quote-org-a'
      )
      await rentalRow(
        owner,
        schema,
        'rental-b1',
        tenantB,
        'ACTIVE',
        'quote-org-b'
      )
      await rentalRow(
        owner,
        schema,
        'rental-b2',
        tenantB,
        'ACTIVE',
        'quote-org-b'
      )
      const before = await snapshot(
        schema,
        'rentals',
        '"id", "tenantId", "quoteId", "status"'
      )
      // Premise: without app.tenant_id the owner sees nothing, so a naive preflight would pass.
      expect(await ownerCount(owner, 'rentals')).toBe(0)

      await expect(
        owner.query(migrationSql('202609260001_rental_quote_unique'))
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          'Preflight rentals_tenant_quote_unique: 2 quote(s) have more than one rental in the same organization ' +
            '(tenant=org-a quote=quote-org-a rentals=2; tenant=org-b quote=quote-org-b rentals=2)'
        ),
      })
      expect(
        await snapshot(
          schema,
          'rentals',
          '"id", "tenantId", "quoteId", "status"'
        )
      ).toEqual(before)
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."rentals_tenant_quote_unique"`,
          ])
        ).rows[0].index
      ).toBeNull()

      await admin.query(
        `DELETE FROM "${schema}"."rentals" WHERE "id" IN ('rental-a2', 'rental-b2')`
      )
      await owner.query(migrationSql('202609260001_rental_quote_unique'))
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."rentals_tenant_quote_unique"`,
          ])
        ).rows[0].index
      ).not.toBeNull()
      expect(await ownerCount(owner, 'rentals')).toBe(0)
    }, 60_000)

    it('202609260002 and 0003 see invalid statuses in and outside organizations and abort without changes', async () => {
      const { schema, owner } = await migratedSchema(
        '202609260001_rental_quote_unique'
      )
      await seed(schema, owner)
      await rentalRow(owner, schema, 'rental-a1', tenantA, null, null)
      await rentalRow(owner, schema, 'rental-b1', tenantB, null, null)
      await rentalRow(owner, schema, 'rental-legacy', null, 'WEIRD', null)
      const enumLabels = async () =>
        first(
          (
            await admin.query<{ labels: string[] }>(
              `SELECT ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = to_regtype($1) ORDER BY enumsortorder) AS labels`,
              [`"${schema}"."RentalStatus"`]
            )
          ).rows
        ).labels
      const statusColumn = async () =>
        (
          await admin.query(
            `SELECT data_type, udt_name, is_nullable FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'rentals' AND column_name = 'status'`,
            [schema]
          )
        ).rows[0]
      const labelsBefore = await enumLabels()
      const before = await snapshot(
        schema,
        'rentals',
        '"id", "tenantId", "status"'
      )
      expect(await ownerCount(owner, 'rentals')).toBe(0)

      await expect(
        owner.query(migrationSql('202609260002_rental_status_pending'))
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          "Preflight rentals.status: 2 rental(s) without status; unknown values: 'WEIRD'=1."
        ),
      })
      expect(await enumLabels()).toEqual(labelsBefore)
      expect(labelsBefore).not.toContain('PENDING')
      expect(
        await snapshot(schema, 'rentals', '"id", "tenantId", "status"')
      ).toEqual(before)
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)

      await admin.query(`UPDATE "${schema}"."rentals" SET "status" = 'ACTIVE'`)
      await owner.query(migrationSql('202609260002_rental_status_pending'))
      expect(await enumLabels()).toContain('PENDING')
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)

      // Data may change between 0002 and 0003; the repeated preflight must see it too.
      await admin.query(
        `UPDATE "${schema}"."rentals" SET "status" = NULL WHERE "id" = 'rental-b1'`
      )
      await admin.query(
        `UPDATE "${schema}"."rentals" SET "status" = 'LOST' WHERE "id" = 'rental-legacy'`
      )
      const columnBefore = await statusColumn()
      const beforeConversion = await snapshot(
        schema,
        'rentals',
        '"id", "tenantId", "status"'
      )
      await expect(
        owner.query(migrationSql('202609260003_rental_status_enum'))
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          "Preflight rentals.status: 1 rental(s) without status; unknown values: 'LOST'=1."
        ),
      })
      expect(columnBefore).toEqual({
        data_type: 'text',
        udt_name: 'text',
        is_nullable: 'YES',
      })
      expect(await statusColumn()).toEqual(columnBefore)
      expect(
        await snapshot(schema, 'rentals', '"id", "tenantId", "status"')
      ).toEqual(beforeConversion)
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)

      await admin.query(
        `UPDATE "${schema}"."rentals" SET "status" = 'COMPLETED' WHERE "id" IN ('rental-b1', 'rental-legacy')`
      )
      await owner.query(migrationSql('202609260003_rental_status_enum'))
      expect(await statusColumn()).toEqual({
        data_type: 'USER-DEFINED',
        udt_name: 'RentalStatus',
        is_nullable: 'NO',
      })
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      expect(await ownerCount(owner, 'rentals')).toBe(0)
    }, 60_000)

    it('202609260004 sees duplicated current charges in and outside organizations and aborts without changes', async () => {
      const { schema, owner } = await migratedSchema(
        '202609260003_rental_status_enum'
      )
      await seed(schema, owner)
      // Simulates a database without the legacy full unique index, the case this preflight exists for.
      await owner.query('DROP INDEX "payments_quote_method_type_unique"')
      await paymentRow(
        owner,
        schema,
        'payment-a1',
        tenantA,
        'quote-org-a',
        'PENDING'
      )
      await paymentRow(
        owner,
        schema,
        'payment-a2',
        tenantA,
        'quote-org-a',
        'PAID'
      )
      await paymentRow(
        owner,
        schema,
        'payment-a3',
        tenantA,
        'quote-org-a',
        'CANCELLED'
      )
      await paymentRow(
        owner,
        schema,
        'payment-l1',
        null,
        'quote-legacy',
        'PENDING'
      )
      await paymentRow(
        owner,
        schema,
        'payment-l2',
        null,
        'quote-legacy',
        'OVERDUE'
      )
      const before = await snapshot(
        schema,
        'payments',
        '"id", "tenantId", "quoteId", "status"'
      )
      expect(await ownerCount(owner, 'payments')).toBe(0)

      await expect(
        owner.query(migrationSql('202609260004_payment_active_charge_unique'))
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining(
          'Preflight payments_quote_method_type_active_unique: 2 quote obligation(s) have more than one current charge ' +
            '(quote=quote-legacy method=PIX type=DEPOSIT payments=2; quote=quote-org-a method=PIX type=DEPOSIT payments=2)'
        ),
      })
      expect(
        await snapshot(
          schema,
          'payments',
          '"id", "tenantId", "quoteId", "status"'
        )
      ).toEqual(before)
      expect(await rowSecurity(schema, 'payments')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."payments_quote_method_type_active_unique"`,
          ])
        ).rows[0].index
      ).toBeNull()

      // The operator reconciles as the message asks: the superseded charges are cancelled, never
      // deleted, and the legacy full index stays gone (it would reject [PAID, CANCELLED] again).
      await admin.query(
        `UPDATE "${schema}"."payments" SET "status" = 'CANCELLED' WHERE "id" IN ('payment-a1', 'payment-l2')`
      )
      await owner.query(
        migrationSql('202609260004_payment_active_charge_unique')
      )
      // Cancelled charges remain as history next to the current one.
      expect(
        await snapshot(schema, 'payments', '"id", "quoteId", "status"')
      ).toEqual([
        { id: 'payment-a1', quoteId: 'quote-org-a', status: 'CANCELLED' },
        { id: 'payment-a2', quoteId: 'quote-org-a', status: 'PAID' },
        { id: 'payment-a3', quoteId: 'quote-org-a', status: 'CANCELLED' },
        { id: 'payment-l1', quoteId: 'quote-legacy', status: 'PENDING' },
        { id: 'payment-l2', quoteId: 'quote-legacy', status: 'CANCELLED' },
      ])
      expect(await rowSecurity(schema, 'payments')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."payments_quote_method_type_active_unique"`,
          ])
        ).rows[0].index
      ).not.toBeNull()
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."payments_quote_method_type_unique"`,
          ])
        ).rows[0].index
      ).toBeNull()
      expect(await ownerCount(owner, 'payments')).toBe(0)
    }, 60_000)

    /** Resolves when `check` holds, polling; rejects after `timeout` ms. */
    async function until(check: () => Promise<boolean>, timeout = 10_000) {
      const deadline = Date.now() + timeout
      while (!(await check())) {
        if (Date.now() > deadline) throw new Error('Condition not reached')
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    async function session(schema: string): Promise<Client> {
      const client = new Client({ connectionString: ownerUrl })
      owners.push(client)
      await client.connect()
      await client.query(`SET search_path TO "${schema}"`)
      return client
    }

    const pid = async (client: Client) =>
      first(
        (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'))
          .rows
      ).pid

    it('202609260004 gives up after lock_timeout instead of queueing behind a busy "payments", and readers keep reading while it waits', async () => {
      const { schema, owner } = await migratedSchema(
        '202609260003_rental_status_enum'
      )
      await seed(schema, owner)
      // An old app instance mid-write (e.g. a boleto webhook) holds ROW EXCLUSIVE on payments.
      const writer = await session(schema)
      await writer.query('BEGIN')
      await writer.query('LOCK TABLE "payments" IN ROW EXCLUSIVE MODE')
      const migrator = await pid(owner)
      const started = Date.now()
      const migration = owner
        .query(migrationSql('202609260004_payment_active_charge_unique'))
        .then(
          () => 'applied' as const,
          (error: { code?: string; message?: string }) => error
        )
      try {
        await until(
          async () =>
            (
              await admin.query(
                `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
                [migrator]
              )
            ).rowCount === 1
        )
        // While the migration waits for its lock, a reader is not queued behind it.
        const reader = await session(schema)
        await reader.query(`SET lock_timeout = '1s'`)
        await expect(
          reader.query('SELECT count(*) FROM "payments"')
        ).resolves.toMatchObject({ rowCount: 1 })
        const outcome = await Promise.race([
          migration,
          new Promise<'still waiting'>((resolve) =>
            setTimeout(() => resolve('still waiting'), 20_000)
          ),
        ])
        expect(outcome).toMatchObject({
          code: '55P03',
          message: expect.stringContaining('lock timeout'),
        })
        expect(Date.now() - started).toBeLessThan(15_000)
      } finally {
        await writer.query('ROLLBACK')
        await migration
      }
      expect(await rowSecurity(schema, 'payments')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."payments_quote_method_type_active_unique"`,
          ])
        ).rows[0].index
      ).toBeNull()
      // Once the writer is gone, the same script applies.
      await owner.query(
        migrationSql('202609260004_payment_active_charge_unique')
      )
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."payments_quote_method_type_active_unique"`,
          ])
        ).rows[0].index
      ).not.toBeNull()
      expect(await rowSecurity(schema, 'payments')).toEqual(forced)
    }, 60_000)

    /**
     * Runs `migration` while another session holds ROW EXCLUSIVE on "rentals" (an old app
     * instance mid-write). Resolves with what the migration answered and whether a reader got
     * through while the migration was waiting for its lock.
     */
    async function againstBusyRentals(schema: string, migration: string) {
      const owner = await session(schema)
      const writer = await session(schema)
      await writer.query('BEGIN')
      await writer.query('LOCK TABLE "rentals" IN ROW EXCLUSIVE MODE')
      const migrator = await pid(owner)
      const started = Date.now()
      const running = owner.query(migrationSql(migration)).then(
        () => 'applied' as const,
        (error: { code?: string; message?: string }) => error
      )
      try {
        await until(
          async () =>
            (
              await admin.query(
                `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
                [migrator]
              )
            ).rowCount === 1
        )
        const reader = await session(schema)
        await reader.query(`SET lock_timeout = '1s'`)
        const read = await reader.query('SELECT count(*) FROM "rentals"').then(
          () => 'read' as const,
          (error: { code?: string }) => error.code ?? 'failed'
        )
        const outcome = await Promise.race([
          running,
          new Promise<'still waiting'>((resolve) =>
            setTimeout(() => resolve('still waiting'), 20_000)
          ),
        ])
        return { outcome, elapsed: Date.now() - started, read }
      } finally {
        await writer.query('ROLLBACK')
        await running
      }
    }

    it('202609260001 gives up after lock_timeout instead of queueing behind a busy "rentals", and readers keep reading while it waits', async () => {
      const { schema, owner } = await migratedSchema(
        '202609250013_tenant_settings_addresses'
      )
      await seed(schema, owner)
      const busy = await againstBusyRentals(
        schema,
        '202609260001_rental_quote_unique'
      )
      expect(busy.outcome).toMatchObject({
        code: '55P03',
        message: expect.stringContaining('lock timeout'),
      })
      expect(busy.elapsed).toBeLessThan(15_000)
      // Only SHARE is requested (the index build is the check): readers are never queued.
      expect(busy.read).toBe('read')
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      // Once the writer is gone, the same script applies.
      await owner.query(migrationSql('202609260001_rental_quote_unique'))
      expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      expect(
        (
          await admin.query('SELECT to_regclass($1) AS index', [
            `"${schema}"."rentals_tenant_quote_unique"`,
          ])
        ).rows[0].index
      ).not.toBeNull()
    }, 60_000)

    it('202609260002 and 0003 give up after lock_timeout instead of queueing behind a busy "rentals"', async () => {
      const { schema, owner } = await migratedSchema(
        '202609260001_rental_quote_unique'
      )
      await seed(schema, owner)
      await rentalRow(owner, schema, 'rental-a1', tenantA, 'ACTIVE', null)
      for (const migration of [
        '202609260002_rental_status_pending',
        '202609260003_rental_status_enum',
      ]) {
        const busy = await againstBusyRentals(schema, migration)
        expect(busy.outcome, migration).toMatchObject({
          code: '55P03',
          message: expect.stringContaining('lock timeout'),
        })
        expect(busy.elapsed, migration).toBeLessThan(15_000)
        // FORCE was never lifted for other sessions: the aborted script rolled back.
        expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
        await owner.query(migrationSql(migration))
        expect(await rowSecurity(schema, 'rentals')).toEqual(forced)
      }
      expect(
        (
          await admin.query(
            `SELECT udt_name FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'rentals' AND column_name = 'status'`,
            [schema]
          )
        ).rows[0]
      ).toEqual({ udt_name: 'RentalStatus' })
    }, 90_000)

    it('a migrator that does not own the tables cannot lift FORCE and changes nothing', async () => {
      const { schema, owner } = await migratedSchema(
        '202609260003_rental_status_enum'
      )
      const outsider = 'mig_outsider_' + suffix
      await admin.query(
        `CREATE ROLE "${outsider}" NOLOGIN NOSUPERUSER NOBYPASSRLS`
      )
      try {
        await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${outsider}"`)
        await admin.query(
          `GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO "${outsider}"`
        )
        await admin.query(`GRANT "${outsider}" TO "${ownerRole}"`)
        await owner.query(`SET ROLE "${outsider}"`)
        // RLS always applies to non-owners, so the check must not depend on what the migrator can read:
        // the unique index build is the check, and only the table owner may run it.
        await expect(
          owner.query(migrationSql('202609260004_payment_active_charge_unique'))
        ).rejects.toMatchObject({
          code: '42501',
          message: expect.stringContaining('must be owner of table payments'),
          where: expect.stringContaining(
            'CREATE UNIQUE INDEX "payments_quote_method_type_active_unique"'
          ),
        })
        await owner.query('RESET ROLE')
        expect(await rowSecurity(schema, 'payments')).toEqual(forced)
      } finally {
        await owner.query('RESET ROLE').catch(() => undefined)
        await admin.query(`REVOKE "${outsider}" FROM "${ownerRole}"`)
        await admin.query(`DROP OWNED BY "${outsider}"`)
        await admin.query(`DROP ROLE "${outsider}"`)
      }
    }, 60_000)
  }
)

/**
 * The recovery a migration documents for a lock timeout: the `pnpm exec prisma` commands of its header,
 * in order.
 */
function documentedRecovery(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .map((line) => /^--\s+(pnpm exec prisma .+)$/.exec(line)?.[1]?.trim())
    .filter((command): command is string => !!command)
}

/** Migrations that give up on a busy table (lock_timeout) instead of queueing the application behind them. */
const lockGuarded = migrations.filter((name) =>
  /lock_timeout/.test(migrationSql(name))
)

/**
 * From the 2026100301xx family on, migrations qualify objects of "public" and create functions with their own
 * settings, so they cannot be replayed in a scratch schema: their recovery runs on a dedicated database below.
 */
const SCRATCH_SCHEMA_LIMIT = '202610030101'

describe('Lock-timeout runbook of the migrations (finding 24)', () => {
  it('every migration that gives up on a busy table documents the Prisma recovery by its own name', () => {
    expect(lockGuarded).toEqual(
      expect.arrayContaining([
        '202609260001_rental_quote_unique',
        '202609260002_rental_status_pending',
        '202609260003_rental_status_enum',
        '202609260004_payment_active_charge_unique',
      ])
    )
    for (const name of lockGuarded) {
      const sql = migrationSql(name)
      // A failed migration blocks every later deploy (P3009) until it is marked rolled back.
      expect
        .soft(sql, name)
        .not.toMatch(/run(?: it)? again|rode o deploy de novo/i)
      expect
        .soft(documentedRecovery(sql), name)
        .toEqual([
          `pnpm exec prisma migrate resolve --rolled-back ${name}`,
          'pnpm exec prisma migrate deploy',
        ])
    }
  })
})

/**
 * The messages an anonymous `DO $$ ... END $$;` block raises while `prisma migrate deploy` runs it (a failing
 * preflight): the deploy stops with P3018 and records the migration as failed, so fixing the data and deploying
 * again is refused (P3009). Trigger bodies (`CREATE FUNCTION`) raise at run time and are not listed.
 */
function deployTimeMessages(sql: string): string[] {
  return [...sql.matchAll(/^DO \$\$[\s\S]*?^END \$\$;/gm)].flatMap((block) =>
    [...block[0].matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((match) =>
      match[1]!.replaceAll("''", "'")
    )
  )
}

/** The Prisma commands a message tells the operator to run, in order. */
const toldRecovery = (text: string) => [
  ...new Set(
    [
      ...text.matchAll(
        /pnpm exec prisma migrate (?:resolve --rolled-back [\w-]+|deploy)/g
      ),
    ].map((match) => match[0])
  ),
]

describe('Preflight runbook of the migrations (finding 110)', () => {
  it('every message a deploy-time block raises gives the Prisma recovery by its own name, never "deploy again" alone', () => {
    const raising = migrations.filter(
      (name) => deployTimeMessages(migrationSql(name)).length > 0
    )
    expect(raising).toEqual(
      expect.arrayContaining([
        '202609260001_rental_quote_unique',
        '202609260002_rental_status_pending',
        '202609260003_rental_status_enum',
        '202609260004_payment_active_charge_unique',
        '202609260005_organization_slug_policy',
      ])
    )
    for (const name of raising)
      for (const message of deployTimeMessages(migrationSql(name))) {
        expect
          .soft(toldRecovery(message), `${name}: ${message}`)
          .toEqual([
            `pnpm exec prisma migrate resolve --rolled-back ${name}`,
            'pnpm exec prisma migrate deploy',
          ])
        expect
          .soft(message, name)
          .not.toMatch(/run(?: it)? again|rode o deploy de novo/i)
      }
  })

  it('the slug policy runbook (section 8) marks the failed migration rolled back before deploying', () => {
    const doc = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'features', 'tenant-slug-policy.md'),
      'utf8'
    )
    const section = /^## 8\. [^\n]*\n([\s\S]*?)^## /m.exec(doc)?.[1] ?? ''
    expect(toldRecovery(section)).toEqual([
      'pnpm exec prisma migrate resolve --rolled-back 202609260005_organization_slug_policy',
      'pnpm exec prisma migrate deploy',
    ])
    expect(section).toMatch(/P3009/)
    expect(section).not.toMatch(/rode o deploy de novo/i)
  })
})

/**
 * A scratch schema migrated by the repository's Prisma CLI (`prisma migrate deploy` as in production) from a
 * migrations directory that grows one migration at a time. Registers its own hooks in the enclosing describe.
 */
function prismaScratch(prefix: string) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const schema = prefix + suffix
  const prisma = path.join(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js'
  )
  const scratch = 'locadora-runbook-'
  let directory = ''
  let admin: Pool | undefined
  let deployUrl = ''

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
      throw new Error('Disposable database opt-in required')
    const connectionString = requireTestDatabase(process.env)
    admin = new Pool({ connectionString, max: 2 })
    const url = new URL(connectionString)
    url.searchParams.set('schema', schema)
    deployUrl = url.toString()
    directory = fs.mkdtempSync(path.join(os.tmpdir(), scratch))
    fs.mkdirSync(path.join(directory, 'migrations'))
    fs.copyFileSync(
      path.join(migrationsDir, 'migration_lock.toml'),
      path.join(directory, 'migrations', 'migration_lock.toml')
    )
    fs.writeFileSync(
      path.join(directory, 'schema.prisma'),
      'datasource db {\n  provider = "postgresql"\n}\n'
    )
    const posix = (value: string) => value.split(path.sep).join('/')
    fs.writeFileSync(
      path.join(directory, 'prisma.config.ts'),
      [
        'export default {',
        `  schema: '${posix(path.join(directory, 'schema.prisma'))}',`,
        `  migrations: { path: '${posix(path.join(directory, 'migrations'))}' },`,
        '  datasource: { url: process.env.DATABASE_URL },',
        '}',
        '',
      ].join('\n')
    )
  }, 60_000)

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.end()
    }
    // Only the directory this suite created (plain files, no links).
    if (
      directory &&
      path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith(scratch)
    )
      fs.rmSync(directory, { recursive: true, force: true })
  }, 60_000)

  /** The Prisma CLI of the repository on the scratch schema, with its whole output. */
  function cli(args: string[]): { status: number | null; output: string } {
    const result = spawnSync(
      process.execPath,
      [prisma, ...args, '--config', path.join(directory, 'prisma.config.ts')],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL: deployUrl,
          CHECKPOINT_DISABLE: '1',
          PRISMA_HIDE_UPDATE_MESSAGE: '1',
        },
      }
    )
    return {
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`,
    }
  }

  const addMigration = (name: string) =>
    fs.cpSync(
      path.join(migrationsDir, name),
      path.join(directory, 'migrations', name),
      { recursive: true }
    )

  /** Runs a documented `pnpm exec prisma ...` command with the scratch CLI. */
  const run = (command: string) =>
    cli(command.replace(/^pnpm exec prisma /, '').split(/\s+/))

  /** Whether `name` is recorded as applied (finished and not rolled back). */
  const applied = async (name: string) =>
    (
      await admin!.query<{ finished: boolean }>(
        `SELECT finished_at IS NOT NULL AS finished FROM "${schema}"."_prisma_migrations"
         WHERE migration_name = $1 AND rolled_back_at IS NULL`,
        [name]
      )
    ).rows

  return {
    schema,
    cli,
    run,
    addMigration,
    applied,
    admin: () => admin!,
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Lock-timeout recovery with a real prisma migrate deploy (finding 24)',
  () => {
    const scratch = prismaScratch('mig_runbook_')
    const { schema, cli, run, addMigration } = scratch

    it('a busy table fails the deploy (P3018, 55P03), deploying again is refused (P3009), and the documented recovery applies it', async () => {
      const database = scratch.admin()
      // Everything before the first lock-guarded migration.
      for (const name of migrations.slice(
        0,
        migrations.indexOf(lockGuarded[0]!)
      ))
        addMigration(name)
      const initial = cli(['migrate', 'deploy'])
      expect(initial.status, initial.output).toBe(0)
      // The lock each one waits for: SHARE to build an index (blocked by writers), ACCESS EXCLUSIVE to lift
      // FORCE ROW LEVEL SECURITY (blocked even by readers).
      const busy: Record<string, [string, string]> = {
        '202609260001_rental_quote_unique': ['rentals', 'ROW EXCLUSIVE'],
        '202609260002_rental_status_pending': ['rentals', 'ACCESS SHARE'],
        '202609260003_rental_status_enum': ['rentals', 'ACCESS SHARE'],
        '202609260004_payment_active_charge_unique': [
          'payments',
          'ROW EXCLUSIVE',
        ],
      }
      for (const name of lockGuarded.filter(
        (guarded) => guarded < SCRATCH_SCHEMA_LIMIT
      )) {
        const lock = busy[name]
        expect(lock, `${name}: the lock to hold`).toBeDefined()
        addMigration(name)
        const holder = await database.connect()
        try {
          await holder.query('BEGIN')
          await holder.query(
            `LOCK TABLE "${schema}"."${lock![0]}" IN ${lock![1]} MODE`
          )
          const failed = cli(['migrate', 'deploy'])
          expect(failed.status, name).not.toBe(0)
          expect(failed.output, name).toMatch(/P3018/)
          expect(failed.output, name).toMatch(/55P03|lock timeout/)
          // "Run it again", as the migrations used to say: refused while it is marked as failed.
          const again = cli(['migrate', 'deploy'])
          expect(again.status, name).not.toBe(0)
          expect(again.output, name).toMatch(/P3009/)
        } finally {
          await holder.query('ROLLBACK')
          holder.release()
        }
        // The recovery exactly as the migration documents it.
        const recovery = documentedRecovery(migrationSql(name))
        expect(recovery, name).toHaveLength(2)
        for (const command of recovery) {
          const result = run(command)
          expect(result.status, `${name}: ${command}\n${result.output}`).toBe(0)
        }
        expect(await scratch.applied(name), name).toEqual([{ finished: true }])
      }
      const indexes = await database.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname IN
         ('rentals_tenant_quote_unique', 'payments_quote_method_type_active_unique', 'payments_quote_method_type_unique')
         ORDER BY indexname`,
        [schema]
      )
      expect(indexes.rows.map((row) => row.indexname)).toEqual([
        'payments_quote_method_type_active_unique',
        'rentals_tenant_quote_unique',
      ])
    }, 240_000)
  }
)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Preflight recovery of 202609260004 with a real prisma migrate deploy (finding 24, second review)',
  () => {
    const name = '202609260004_payment_active_charge_unique'
    const scratch = prismaScratch('mig_preflight_')
    const { schema, cli, run, addMigration } = scratch

    it('a failed preflight stops the deploy (P3018, P0001), deploying again is refused (P3009), and after the reconciliation the recovery its message gives applies it', async () => {
      const database = scratch.admin()
      for (const earlier of migrations.slice(0, migrations.indexOf(name)))
        addMigration(earlier)
      const initial = cli(['migrate', 'deploy'])
      expect(initial.status, initial.output).toBe(0)
      // Duplicated current charges in a database without the legacy full index (the case the preflight exists
      // for), next to a cancelled one that stays as history.
      await database.query(
        `DROP INDEX "${schema}"."payments_quote_method_type_unique"`
      )
      await database.query(`INSERT INTO "${schema}"."quotes" ("id", "name", "email", "phone", "updatedAt")
        VALUES ('quote-runbook', 'Runbook', 'runbook@example.test', '0', now())`)
      for (const [id, status] of [
        ['payment-r1', 'PENDING'],
        ['payment-r2', 'PAID'],
        ['payment-r3', 'CANCELLED'],
      ])
        await database.query(
          `INSERT INTO "${schema}"."payments" ("id", "amount", "method", "status", "type", "dueDate", "updatedAt", "quoteId")
           VALUES ($1, 10, 'PIX', $2::"${schema}"."PaymentStatus", 'DEPOSIT', now(), now(), 'quote-runbook')`,
          [id, status]
        )
      addMigration(name)
      const failed = cli(['migrate', 'deploy'])
      expect(failed.status).not.toBe(0)
      expect(failed.output).toMatch(/P3018/)
      expect(failed.output).toMatch(/P0001/)
      expect(failed.output).toContain(
        'Preflight payments_quote_method_type_active_unique: 1 quote obligation(s) have more than one current charge'
      )
      // Reconciling alone is not enough: the failed migration blocks the next deploy.
      await database.query(
        `UPDATE "${schema}"."payments" SET "status" = 'CANCELLED' WHERE "id" = 'payment-r1'`
      )
      const again = cli(['migrate', 'deploy'])
      expect(again.status).not.toBe(0)
      expect(again.output).toMatch(/P3009/)
      // The recovery exactly as the preflight message tells the operator (Prisma prints the message more than
      // once), and as the migration header documents.
      const told = [
        ...new Set(
          [
            ...failed.output.matchAll(
              /pnpm exec prisma migrate (?:resolve --rolled-back [\w-]+|deploy)/g
            ),
          ].map((match) => match[0])
        ),
      ]
      expect(told).toEqual([
        `pnpm exec prisma migrate resolve --rolled-back ${name}`,
        'pnpm exec prisma migrate deploy',
      ])
      expect(documentedRecovery(migrationSql(name))).toEqual(told)
      for (const command of told) {
        const result = run(command)
        expect(result.status, `${command}\n${result.output}`).toBe(0)
      }
      expect(await scratch.applied(name)).toEqual([{ finished: true }])
      // Nothing was deleted: the cancelled charges stay as history next to the current one.
      const payments = await database.query<{ id: string; status: string }>(
        `SELECT "id", "status"::text AS status FROM "${schema}"."payments" ORDER BY "id"`
      )
      expect(payments.rows).toEqual([
        { id: 'payment-r1', status: 'CANCELLED' },
        { id: 'payment-r2', status: 'PAID' },
        { id: 'payment-r3', status: 'CANCELLED' },
      ])
    }, 240_000)
  }
)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Preflight recovery of 202609260001, 0002, 0003 and 0005 with a real prisma migrate deploy (finding 110)',
  () => {
    const scratch = prismaScratch('mig_recover_')
    const { schema, cli, run, addMigration } = scratch

    it('each failed preflight blocks the next deploy (P3009) until the recovery its message gives, which then applies it', async () => {
      const database = scratch.admin()
      const firstStep = '202609260001_rental_quote_unique'
      let next = migrations.indexOf(firstStep)
      for (const earlier of migrations.slice(0, next)) addMigration(earlier)
      const initial = cli(['migrate', 'deploy'])
      expect(initial.status, initial.output).toBe(0)
      const sql = (text: string) => text.replaceAll('"@.', `"${schema}".`)
      await database.query(
        sql(`INSERT INTO "@."organizations" ("id", "slug", "name", "updatedAt")
         VALUES ('org-runbook', 'org-runbook', 'Runbook', now())`)
      )
      await database.query(
        sql(`INSERT INTO "@."users" ("id", "email", "updatedAt")
         VALUES ('user-1', 'runbook@example.test', now())`)
      )
      await database.query(
        sql(`INSERT INTO "@."quotes" ("id", "name", "email", "phone", "updatedAt", "tenantId")
         VALUES ('quote-runbook', 'Runbook', 'runbook@example.test', '0', now(), 'org-runbook')`)
      )
      // Each step: the data the preflight refuses, what it says first, and the reconciliation.
      const steps: Array<{
        name: string
        break: string[]
        says: string
        fix: string[]
      }> = [
        {
          name: firstStep,
          // A database where the guarantee of 202609250005 was lost, the case this preflight exists for.
          break: [
            'DROP INDEX "@."rentals_tenant_quote_unique"',
            ...['rental-r1', 'rental-r2'].map(
              (
                id
              ) => `INSERT INTO "@."rentals" ("id", "startdate", "enddate", "total", "userid", "status", "quoteId", "tenantId")
               VALUES ('${id}', now(), now() + interval '1 day', 10, 'user-1', 'ACTIVE', 'quote-runbook', 'org-runbook')`
            ),
          ],
          says: 'Preflight rentals_tenant_quote_unique: 1 quote(s) have more than one rental',
          fix: [`DELETE FROM "@."rentals" WHERE "id" = 'rental-r2'`],
        },
        {
          name: '202609260002_rental_status_pending',
          break: [
            `UPDATE "@."rentals" SET "status" = 'WEIRD' WHERE "id" = 'rental-r1'`,
          ],
          says: "Preflight rentals.status: 0 rental(s) without status; unknown values: 'WEIRD'=1.",
          fix: [
            `UPDATE "@."rentals" SET "status" = 'ACTIVE' WHERE "id" = 'rental-r1'`,
          ],
        },
        {
          name: '202609260003_rental_status_enum',
          break: [
            `UPDATE "@."rentals" SET "status" = NULL WHERE "id" = 'rental-r1'`,
          ],
          says: 'Preflight rentals.status: 1 rental(s) without status; unknown values: none.',
          fix: [
            `UPDATE "@."rentals" SET "status" = 'COMPLETED' WHERE "id" = 'rental-r1'`,
          ],
        },
        {
          name: '202609260005_organization_slug_policy',
          break: [
            `UPDATE "@."organizations" SET "slug" = 'a--b' WHERE "id" = 'org-runbook'`,
          ],
          says: 'Preflight organizations_slug_dns_label: 1 organização(ões) fora da política',
          fix: [
            `UPDATE "@."organizations" SET "slug" = 'org-runbook' WHERE "id" = 'org-runbook'`,
          ],
        },
      ]
      for (const step of steps) {
        // What lies between the previous step and this one deploys as is (0004 has its own test above).
        const at = migrations.indexOf(step.name)
        for (const name of migrations.slice(next, at)) {
          addMigration(name)
          const plain = cli(['migrate', 'deploy'])
          expect(plain.status, `${name}\n${plain.output}`).toBe(0)
        }
        next = at + 1
        for (const statement of step.break) await database.query(sql(statement))
        addMigration(step.name)
        const failed = cli(['migrate', 'deploy'])
        expect(failed.status, step.name).not.toBe(0)
        expect(failed.output, step.name).toMatch(/P3018/)
        expect(failed.output, step.name).toMatch(/P0001/)
        expect(failed.output, step.name).toContain(step.says)
        // Reconciling alone is not enough: the failed migration blocks the next deploy.
        for (const statement of step.fix) await database.query(sql(statement))
        const again = cli(['migrate', 'deploy'])
        expect(again.status, step.name).not.toBe(0)
        expect(again.output, step.name).toMatch(/P3009/)
        // The recovery exactly as the preflight message tells the operator.
        const told = toldRecovery(failed.output)
        expect(told, step.name).toEqual([
          `pnpm exec prisma migrate resolve --rolled-back ${step.name}`,
          'pnpm exec prisma migrate deploy',
        ])
        for (const command of told) {
          const result = run(command)
          expect(result.status, `${command}\n${result.output}`).toBe(0)
        }
        expect(await scratch.applied(step.name), step.name).toEqual([
          { finished: true },
        ])
      }
    }, 480_000)
  }
)

/**
 * A dedicated database migrated by the repository's Prisma CLI (as production does) from a migrations directory
 * that grows one migration at a time. For the migrations a scratch schema cannot replay (SCRATCH_SCHEMA_LIMIT).
 */
function prismaDatabase(prefix: string) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const name = prefix + suffix + '_test'
  const prisma = path.join(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js'
  )
  const scratch = 'locadora-runbook-'
  let directory = ''
  let admin: Pool | undefined
  let database: Pool | undefined
  let deployUrl = ''

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
      throw new Error('Disposable database opt-in required')
    const connectionString = requireTestDatabase(process.env)
    admin = new Pool({ connectionString, max: 1 })
    await admin.query(`CREATE DATABASE "${name}"`)
    const url = new URL(connectionString)
    url.pathname = '/' + name
    deployUrl = url.toString()
    database = new Pool({ connectionString: deployUrl, max: 2 })
    directory = fs.mkdtempSync(path.join(os.tmpdir(), scratch))
    fs.mkdirSync(path.join(directory, 'migrations'))
    fs.copyFileSync(
      path.join(migrationsDir, 'migration_lock.toml'),
      path.join(directory, 'migrations', 'migration_lock.toml')
    )
    fs.writeFileSync(
      path.join(directory, 'schema.prisma'),
      'datasource db {\n  provider = "postgresql"\n}\n'
    )
    const posix = (value: string) => value.split(path.sep).join('/')
    fs.writeFileSync(
      path.join(directory, 'prisma.config.ts'),
      [
        'export default {',
        `  schema: '${posix(path.join(directory, 'schema.prisma'))}',`,
        `  migrations: { path: '${posix(path.join(directory, 'migrations'))}' },`,
        '  datasource: { url: process.env.DATABASE_URL },',
        '}',
        '',
      ].join('\n')
    )
  }, 60_000)

  afterAll(async () => {
    await database?.end()
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      await admin.end()
    }
    // Only the directory this suite created (plain files, no links).
    if (
      directory &&
      path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith(scratch)
    )
      fs.rmSync(directory, { recursive: true, force: true })
  }, 60_000)

  function cli(args: string[]): { status: number | null; output: string } {
    const result = spawnSync(
      process.execPath,
      [prisma, ...args, '--config', path.join(directory, 'prisma.config.ts')],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL: deployUrl,
          CHECKPOINT_DISABLE: '1',
          PRISMA_HIDE_UPDATE_MESSAGE: '1',
        },
      }
    )
    return {
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`,
    }
  }

  return {
    cli,
    run: (command: string) =>
      cli(command.replace(/^pnpm exec prisma /, '').split(/\s+/)),
    addMigration: (migration: string) =>
      fs.cpSync(
        path.join(migrationsDir, migration),
        path.join(directory, 'migrations', migration),
        { recursive: true }
      ),
    applied: async (migration: string) =>
      (
        await database!.query<{ finished: boolean }>(
          `SELECT finished_at IS NOT NULL AS finished FROM "_prisma_migrations"
           WHERE migration_name = $1 AND rolled_back_at IS NULL`,
          [migration]
        )
      ).rows,
    database: () => database!,
  }
}

const PROVISIONING_REQUESTS =
  '202610060101_payment_account_provisioning_requests'

/** One company with a receiving account that still carries a declared income range (never written by the code). */
async function seedIncomeRange(database: Pool) {
  await database.query(
    `INSERT INTO "organizations" ("id", "slug", "name", "updatedAt") VALUES ('org-range', 'org-range', 'Range', now())`
  )
  await database.query(
    `INSERT INTO "tenant_integrations" ("id", "tenantId", "provider", "credentialSource", "environment", "updatedAt")
     VALUES ('integration-range', 'org-range', 'ASAAS', 'VAULT', 'sandbox', now())`
  )
  await database.query(
    `INSERT INTO "payment_accounts" ("id", "tenantId", "integrationId", "mode", "subaccountModel", "environment", "incomeRange", "updatedAt")
     VALUES ('account-range', 'org-range', 'integration-range', 'ASAAS_SUBACCOUNT', 'STANDARD', 'sandbox', 'UP_TO_10K', now())`
  )
}

async function incomeRangeState(database: Pool) {
  const column = await database.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payment_accounts' AND column_name = 'incomeRange'`
  )
  const table = await database.query<{ name: string | null }>(
    `SELECT to_regclass('public.payment_account_provisioning_requests')::text AS name`
  )
  const security = await database.query<{
    relrowsecurity: boolean
    relforcerowsecurity: boolean
  }>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.payment_accounts'::regclass`
  )
  return {
    column: column.rows[0]!.n === 1,
    table: table.rows[0]!.name,
    security: security.rows[0],
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Lock-timeout recovery of migrations replayed on a dedicated database (finding 24, wave 134)',
  () => {
    const dedicated = prismaDatabase('mig_lock_')
    // The lock each one waits for: ACCESS EXCLUSIVE to alter the table, blocked even by readers.
    const busy: Record<string, [string, string]> = {
      [PROVISIONING_REQUESTS]: ['payment_accounts', 'ACCESS SHARE'],
      // Onda 134, lote vitrine-conteúdo: colunas e CHECK de "settings" (o ALTER TABLE espera até um leitor sair).
      '202610060201_settings_site_content_legal': ['settings', 'ACCESS SHARE'],
      '202610080101_settings_seo_title_neutral_default': [
        'settings',
        'ACCESS SHARE',
      ],
    }

    it('a busy table fails the deploy (P3018, 55P03), deploying again is refused (P3009), and the documented recovery applies it', async () => {
      const guarded = lockGuarded.filter((name) => name >= SCRATCH_SCHEMA_LIMIT)
      expect(guarded).toEqual(expect.arrayContaining([PROVISIONING_REQUESTS]))
      let next = 0
      for (const name of guarded) {
        const lock = busy[name]
        expect(lock, `${name}: the lock to hold`).toBeDefined()
        const at = migrations.indexOf(name)
        for (const earlier of migrations.slice(next, at))
          dedicated.addMigration(earlier)
        if (at > next) {
          const plain = dedicated.cli(['migrate', 'deploy'])
          expect(plain.status, plain.output).toBe(0)
        }
        next = at + 1
        dedicated.addMigration(name)
        const holder = await dedicated.database().connect()
        try {
          await holder.query('BEGIN')
          await holder.query(`LOCK TABLE "${lock![0]}" IN ${lock![1]} MODE`)
          const failed = dedicated.cli(['migrate', 'deploy'])
          expect(failed.status, name).not.toBe(0)
          expect(failed.output, name).toMatch(/P3018/)
          expect(failed.output, name).toMatch(/55P03|lock timeout/)
          const again = dedicated.cli(['migrate', 'deploy'])
          expect(again.status, name).not.toBe(0)
          expect(again.output, name).toMatch(/P3009/)
        } finally {
          await holder.query('ROLLBACK')
          holder.release()
        }
        const recovery = documentedRecovery(migrationSql(name))
        expect(recovery, name).toHaveLength(2)
        for (const command of recovery) {
          const result = dedicated.run(command)
          expect(result.status, `${name}: ${command}\n${result.output}`).toBe(0)
        }
        expect(await dedicated.applied(name), name).toEqual([
          { finished: true },
        ])
      }
    }, 480_000)
  }
)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Preflight recovery of 202610060101 with a real prisma migrate deploy (wave 134)',
  () => {
    const dedicated = prismaDatabase('mig_income_')

    it('a declared income range stops the deploy (P3018, P0001) without changes, and after the reconciliation the recovery its message gives applies it', async () => {
      const database = dedicated.database()
      for (const earlier of migrations.slice(
        0,
        migrations.indexOf(PROVISIONING_REQUESTS)
      ))
        dedicated.addMigration(earlier)
      const initial = dedicated.cli(['migrate', 'deploy'])
      expect(initial.status, initial.output).toBe(0)
      await seedIncomeRange(database)
      dedicated.addMigration(PROVISIONING_REQUESTS)
      const failed = dedicated.cli(['migrate', 'deploy'])
      expect(failed.status).not.toBe(0)
      expect(failed.output).toMatch(/P3018/)
      expect(failed.output).toMatch(/P0001/)
      expect(failed.output).toContain(
        'Preflight payment_accounts.incomeRange: declared income ranges exist and are never converted into a monthly value'
      )
      // Nothing changed: the column, the value and FORCE stay; the new table does not exist.
      expect(await incomeRangeState(database)).toEqual({
        column: true,
        table: null,
        security: { relrowsecurity: true, relforcerowsecurity: true },
      })
      expect(
        (
          await database.query(
            `SELECT "incomeRange" FROM "payment_accounts" WHERE "id" = 'account-range'`
          )
        ).rows
      ).toEqual([{ incomeRange: 'UP_TO_10K' }])
      // Reconciling alone is not enough: the failed migration blocks the next deploy.
      await database.query(
        `UPDATE "payment_accounts" SET "incomeRange" = NULL WHERE "id" = 'account-range'`
      )
      const again = dedicated.cli(['migrate', 'deploy'])
      expect(again.status).not.toBe(0)
      expect(again.output).toMatch(/P3009/)
      const told = toldRecovery(failed.output)
      expect(told).toEqual([
        `pnpm exec prisma migrate resolve --rolled-back ${PROVISIONING_REQUESTS}`,
        'pnpm exec prisma migrate deploy',
      ])
      expect(documentedRecovery(migrationSql(PROVISIONING_REQUESTS))).toEqual(
        told
      )
      for (const command of told) {
        const result = dedicated.run(command)
        expect(result.status, `${command}\n${result.output}`).toBe(0)
      }
      expect(await dedicated.applied(PROVISIONING_REQUESTS)).toEqual([
        { finished: true },
      ])
      expect(await incomeRangeState(database)).toEqual({
        column: false,
        table: 'payment_account_provisioning_requests',
        security: { relrowsecurity: true, relforcerowsecurity: true },
      })
    }, 480_000)
  }
)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Preflight of 202610060101 by a migrator without BYPASSRLS (wave 134)',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
    const name = 'mig_force_' + suffix + '_test'
    const ownerRole = 'mig_force_owner_' + suffix
    let admin: Pool | undefined
    let database: Pool | undefined
    let owner: Client | undefined

    beforeAll(async () => {
      if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
        throw new Error('Disposable database opt-in required')
      const connectionString = requireTestDatabase(process.env)
      admin = new Pool({ connectionString, max: 1 })
      await admin.query(`CREATE DATABASE "${name}"`)
      const url = new URL(connectionString)
      url.pathname = '/' + name
      database = new Pool({ connectionString: url.toString(), max: 1 })
      for (const migration of migrations.slice(
        0,
        migrations.indexOf(PROVISIONING_REQUESTS)
      ))
        await database.query(migrationSql(migration))
      // A dedicated production migrator: owns the table it alters, neither superuser nor BYPASSRLS.
      const ownerUrl = await createLoginRole(
        database,
        url.toString(),
        ownerRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      await database.query(
        `ALTER TABLE "payment_accounts" OWNER TO "${ownerRole}"`
      )
      await database.query(
        `GRANT USAGE, CREATE ON SCHEMA public TO "${ownerRole}"`
      )
      owner = new Client({ connectionString: ownerUrl })
      await owner.connect()
    }, 120_000)

    afterAll(async () => {
      await owner?.end().catch(() => undefined)
      await database?.end()
      if (admin) {
        await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        await admin.query(`DROP ROLE IF EXISTS "${ownerRole}"`)
        await admin.end()
      }
    }, 60_000)

    it('sees the rows FORCE ROW LEVEL SECURITY hides from its owner, aborts without changes, and applies once they are reconciled', async () => {
      await seedIncomeRange(database!)
      expect(
        (
          await owner!.query(
            'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
          )
        ).rows
      ).toEqual([{ rolsuper: false, rolbypassrls: false }])
      // The trap: a preflight SELECT by the owner counts nothing under FORCE.
      expect(
        (
          await owner!.query(
            'SELECT count(*)::int AS n FROM "payment_accounts" WHERE "incomeRange" IS NOT NULL'
          )
        ).rows
      ).toEqual([{ n: 0 }])
      await expect(
        owner!.query(migrationSql(PROVISIONING_REQUESTS))
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Preflight payment_accounts.incomeRange'
        ),
      })
      await owner!.query('ROLLBACK')
      expect(await incomeRangeState(database!)).toEqual({
        column: true,
        table: null,
        security: { relrowsecurity: true, relforcerowsecurity: true },
      })
      expect(
        (
          await database!.query(
            `SELECT "incomeRange" FROM "payment_accounts" WHERE "id" = 'account-range'`
          )
        ).rows
      ).toEqual([{ incomeRange: 'UP_TO_10K' }])
      await database!.query(
        `UPDATE "payment_accounts" SET "incomeRange" = NULL WHERE "id" = 'account-range'`
      )
      await owner!.query(migrationSql(PROVISIONING_REQUESTS))
      expect(await incomeRangeState(database!)).toEqual({
        column: false,
        table: 'payment_account_provisioning_requests',
        security: { relrowsecurity: true, relforcerowsecurity: true },
      })
      const created = await database!.query<{
        relforcerowsecurity: boolean
        policies: number
      }>(
        `SELECT c.relforcerowsecurity,
           (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname) AS policies
         FROM pg_class c WHERE c.oid = 'public.payment_account_provisioning_requests'::regclass`
      )
      expect(created.rows).toEqual([{ relforcerowsecurity: true, policies: 3 }])
    }, 120_000)
  }
)
