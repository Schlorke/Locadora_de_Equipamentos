import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  enqueuePlatformOutbox,
  createPlatformOutboxRepository,
} from '@gb-locacoes/backend/outbox'
import {
  createPlatformJobs,
  createPlatformMaintenance,
} from '../../packages/backend/src/modules/platform-jobs/index'
import { dispatchOutbox } from '../../packages/backend/src/modules/outbox/dispatch'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import { runConfiguredPlatformJobs } from '@gb-locacoes/backend/runtime'
import { GET as apiCron } from '../../apps/services/api/src/app/api/cron/platform/route'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'platform runtime on restricted PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'platform_runtime_' + suffix + '_test'
    const role = 'platform_' + suffix
    const businessRole = 'business_' + suffix
    let admin: Pool, db: Pool, pool: Pool, businessPool: Pool
    let prisma: PrismaClient, business: PrismaClient, unsafe: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>
    let platformUrl: string, businessUrl: string
    const now = new Date('2026-10-03T12:00:00Z')
    const topic = 'platform.fixture'
    const enqueue = (
      key: string,
      value = topic,
      tenantId: string | null = null
    ) =>
      scope.withPlatformTransaction((tx) =>
        enqueuePlatformOutbox(tx, {
          dedupeKey: key,
          topic: value,
          aggregateId: key,
          tenantId,
          payload: { count: 1 },
        })
      )
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      db = new Pool({ connectionString: url.toString(), max: 1 })
      for (const migration of fs
        .readdirSync('prisma/migrations')
        .filter((name) => /^\d{12}_/.test(name))
        .sort())
        await db.query(
          fs.readFileSync(
            'prisma/migrations/' + migration + '/migration.sql',
            'utf8'
          )
        )
      platformUrl = await createLoginRole(
        db,
        url.toString(),
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      businessUrl = await createLoginRole(
        db,
        url.toString(),
        businessRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (const [file, name] of [
        ['app_runtime', businessRole],
        ['platform_runtime', role],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + file + '.sql', 'utf8')
            .replaceAll(file!, name!)
        )
      pool = new Pool({ connectionString: platformUrl, max: 2 })
      businessPool = new Pool({ connectionString: businessUrl, max: 1 })
      prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      unsafe = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(prisma)
      await scope.withPlatformTransaction((tx) =>
        tx.organization.create({
          data: { id: 'tenant-alfa', slug: 'alfa', name: 'A' },
        })
      )
      await scope.withPlatformTransaction((tx) =>
        tx.organization.create({
          data: { id: 'tenant-bravo', slug: 'bravo', name: 'B' },
        })
      )
    }, 120_000)
    afterAll(async () => {
      for (const client of [prisma, business, unsafe])
        await client?.$disconnect()
      for (const connection of [pool, businessPool, db]) await connection?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const name of [role, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + name + '"')
        await admin.end()
      }
    })
    it('sets platform context, clears tenant context, and resets both on connection reuse', async () => {
      expect(
        await scope.withPlatformTransaction(
          async (tx) =>
            (
              await tx.$queryRaw<
                { scope: string; tenant: string }[]
              >`SELECT current_setting('app.platform_scope',true) AS scope,current_setting('app.tenant_id',true) AS tenant`
            )[0]
        )
      ).toEqual({ scope: 'on', tenant: '' })
      const rows = await pool.query(
        "SELECT current_setting('app.platform_scope',true) AS scope,current_setting('app.tenant_id',true) AS tenant"
      )
      expect(rows.rows[0].scope).not.toBe('on')
      expect(rows.rows[0].tenant || '').toBe('')
    })
    it('rejects administrator and business connections before executing an operation', async () => {
      for (const client of [unsafe, business]) {
        let executed = false
        await expect(
          createPlatformScope(client).withPlatformTransaction(async () => {
            executed = true
          })
        ).rejects.toThrow('Platform database role is not isolated')
        expect(executed).toBe(false)
      }
    })
    it('rejects a column-only business grant, not just SELECT on sentinel tables', async () => {
      await db.query('GRANT SELECT (email) ON users TO "' + role + '"')
      try {
        await expect(
          scope.withPlatformTransaction(async () => null)
        ).rejects.toThrow('Platform database role is not isolated')
      } finally {
        await db.query('REVOKE SELECT (email) ON users FROM "' + role + '"')
      }
      await scope.withPlatformTransaction(async () => null)
    })
    it('rolls back data and local context when the operation fails', async () => {
      await expect(
        scope.withPlatformTransaction(async (tx) => {
          await enqueuePlatformOutbox(tx, {
            topic,
            aggregateId: 'rollback',
            dedupeKey: 'rollback',
            payload: {},
          })
          throw new Error('fixture rollback')
        })
      ).rejects.toThrow('fixture rollback')
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM platform_outbox_events WHERE "dedupeKey"=\'rollback\''
          )
        ).rows[0].n
      ).toBe(0)
      expect(
        (
          await pool.query(
            "SELECT current_setting('app.platform_scope',true) AS scope"
          )
        ).rows[0].scope
      ).not.toBe('on')
    })
    it('allows four insert-only tenant seeds atomically but no reading or cross-tenant insert', async () => {
      await scope.withProvisioningTransaction('tenant-alfa', async (tx) => {
        expect(
          await tx.setting.createMany({ data: [{ tenantId: 'tenant-alfa' }] })
        ).toEqual({ count: 1 })
        expect(
          await tx.financialSetting.createMany({
            data: [{ tenantId: 'tenant-alfa' }],
          })
        ).toEqual({ count: 1 })
        expect(
          await tx.permission.createMany({
            data: [
              {
                tenantId: 'tenant-alfa',
                role: 'ADMIN',
                module: 'fixture',
                action: 'read',
              },
            ],
          })
        ).toEqual({ count: 1 })
        expect(
          await tx.category.createMany({
            data: [
              { tenantId: 'tenant-alfa', name: 'Fixture', slug: 'fixture' },
            ],
          })
        ).toEqual({ count: 1 })
      })
      await expect(
        scope.withProvisioningTransaction('tenant-alfa', (tx) =>
          tx.setting.findMany()
        )
      ).rejects.toThrow()
      await expect(
        scope.withProvisioningTransaction('tenant-alfa', (tx) =>
          tx.category.createMany({
            data: [
              { tenantId: 'tenant-bravo', name: 'Denied', slug: 'denied' },
            ],
          })
        )
      ).rejects.toThrow(/row-level security/)
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM categories WHERE slug='denied'"
          )
        ).rows[0].n
      ).toBe(0)
      await expect(
        scope.withProvisioningTransaction('', async () => null)
      ).rejects.toThrow('Provisioning tenant is required')
    })
    it('keeps one durable event for retries, including global events without tenant id', async () => {
      const [a, b] = await Promise.all([enqueue('dedupe'), enqueue('dedupe')])
      expect(a.id).toBe(b.id)
      expect(a.tenantId).toBeNull()
      await expect(
        scope.withPlatformTransaction((tx) =>
          enqueuePlatformOutbox(tx, {
            topic: 'other',
            aggregateId: 'dedupe',
            dedupeKey: 'dedupe',
            payload: {},
          })
        )
      ).rejects.toThrow('PLATFORM_OUTBOX_DEDUPE_CONFLICT')
    })
    it('claims concurrently once and prevents a stale worker with the same id from acknowledging a recovered lease', async () => {
      await enqueue('lease', 'platform.lease', 'tenant-alfa')
      await db.query(
        'UPDATE platform_outbox_events SET "availableAt"=$1 WHERE "dedupeKey"=\'lease\'',
        [now]
      )
      const repository = createPlatformOutboxRepository(
        scope.withPlatformTransaction,
        ['platform.lease']
      )
      const claims = await Promise.all([
        repository.claim('same-worker', now, 1000),
        repository.claim('same-worker', now, 1000),
      ])
      const claimed = claims.filter((message) => message !== null)
      expect(claimed).toHaveLength(1)
      const first = claimed[0]!
      expect(first.tenantId).toBe('tenant-alfa')
      const recovered = await repository.claim(
        'same-worker',
        new Date(now.getTime() + 1001),
        1000
      )
      expect(recovered?.attempts).toBe(first.attempts + 1)
      expect(await repository.complete(first, now)).toBe(false)
      expect(await repository.fail(first, 'STALE', now, true)).toBe(false)
      expect(await repository.complete(recovered!, now)).toBe(true)
    })
    it('reuses the dispatcher retries, preserves unknown topics and never persists provider error text', async () => {
      await enqueue('retry', 'platform.retry')
      await enqueue('future', 'platform.future')
      await db.query(
        'UPDATE platform_outbox_events SET "availableAt"=$1 WHERE "dedupeKey" IN (\'retry\',\'future\')',
        [now]
      )
      const repository = createPlatformOutboxRepository(
        scope.withPlatformTransaction,
        ['platform.retry']
      )
      const result = await dispatchOutbox({
        repository,
        handlers: {
          'platform.retry': async () => {
            throw new Error('private-provider-secret')
          },
        },
        workerId: 'retry-worker',
        limit: 1,
        now: () => now,
      })
      expect(result).toEqual({
        completed: 0,
        retried: 1,
        failed: 0,
        lostLease: 0,
      })
      const rows = (
        await db.query(
          'SELECT "dedupeKey",status,attempts,"lastError" FROM platform_outbox_events WHERE "dedupeKey" IN (\'retry\',\'future\') ORDER BY "dedupeKey"'
        )
      ).rows
      expect(rows).toEqual([
        {
          dedupeKey: 'future',
          status: 'PENDING',
          attempts: 0,
          lastError: null,
        },
        {
          dedupeKey: 'retry',
          status: 'PENDING',
          attempts: 1,
          lastError: 'DELIVERY_FAILED',
        },
      ])
      expect(await repository.claim('later', now, 1000)).toBeNull()
    })
    it('bounds job execution and leaves events intact when no consumers are installed', async () => {
      const before = (
        await db.query(
          'SELECT id,status,attempts FROM platform_outbox_events ORDER BY id'
        )
      ).rows
      expect(
        await createPlatformJobs({
          scope,
          handlers: {},
          workerId: () => 'empty',
        })()
      ).toEqual({
        success: true,
        completed: 0,
        retried: 0,
        failed: 0,
        lostLease: 0,
        registeredTopics: 0,
      })
      expect(
        (
          await db.query(
            'SELECT id,status,attempts FROM platform_outbox_events ORDER BY id'
          )
        ).rows
      ).toEqual(before)
      await enqueue('budget', 'platform.budget')
      let executed = 0
      const run = createPlatformJobs({
        scope,
        handlers: {
          'platform.budget': async () => {
            executed++
          },
        },
        workerId: () => 'budget',
        budgetMs: 50,
        minRemainingMs: 50,
      })
      expect((await run()).completed).toBe(0)
      expect(executed).toBe(0)
      expect(
        (
          await db.query(
            'SELECT status,attempts FROM platform_outbox_events WHERE "dedupeKey"=\'budget\''
          )
        ).rows[0]
      ).toEqual({ status: 'PENDING', attempts: 0 })
    })
    it('delivers only the configured limit through real leases and the shared dispatcher', async () => {
      await enqueue('limit-a', 'platform.limit')
      await enqueue('limit-b', 'platform.limit')
      let executed = 0
      const result = await createPlatformJobs({
        scope,
        handlers: {
          'platform.limit': async (event) => {
            expect(event.tenantId).toBeNull()
            executed++
          },
        },
        workerId: () => 'limit',
        limit: 1,
      })()
      expect(result.completed).toBe(1)
      expect(executed).toBe(1)
      expect(
        (
          await db.query(
            "SELECT status FROM platform_outbox_events WHERE topic='platform.limit' ORDER BY status::text"
          )
        ).rows
      ).toEqual([{ status: 'COMPLETED' }, { status: 'PENDING' }])
    })
    it('composes a separate lazy pool, fails closed on missing config and forbids live identity rotation', async () => {
      vi.stubEnv('DATABASE_URL', businessUrl)
      vi.stubEnv('PLATFORM_DATABASE_URL', undefined)
      let runtime: ReturnType<typeof getPlatformDatabaseRuntime> | undefined
      try {
        expect(await runConfiguredPlatformJobs()).toEqual({
          status: 503,
          body: { error: 'Platform jobs unavailable' },
        })
        vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
        runtime = getPlatformDatabaseRuntime()
        expect(getPlatformDatabaseRuntime().prisma).toBe(runtime.prisma)
        expect(getPlatformDatabaseRuntime().pool).toBe(runtime.pool)
        const fixtureTime = Date.now()
        await scope.withPlatformTransaction((tx) =>
          tx.platformRateLimit.createMany({
            data: [
              {
                key: 'expired',
                count: 7,
                expiresAt: new Date(fixtureTime - 172_800_000),
              },
              {
                key: 'recent',
                count: 9,
                expiresAt: new Date(fixtureTime - 15_000),
              },
              {
                key: 'active',
                count: 11,
                expiresAt: new Date(fixtureTime + 172_800_000),
              },
            ],
          })
        )
        const first = await runConfiguredPlatformJobs()
        expect(first.status).toBe(200)
        expect(first.body).toEqual({
          success: true,
          completed: 1,
          retried: 0,
          failed: 0,
          lostLease: 0,
          registeredTopics: 3,
        })
        expect(
          (
            await db.query(
              'SELECT key,count FROM platform_rate_limits ORDER BY key'
            )
          ).rows
        ).toEqual([
          { key: 'active', count: 11 },
          { key: 'recent', count: 9 },
        ])
        vi.stubEnv('CRON_SECRET', 'local-platform-cron-fixture')
        // Repeated API invocations retain the maintenance dedupe/window contract.
        for (let invocation = 0; invocation < 2; invocation++) {
          const response = await apiCron(
            new Request('http://localhost/api/cron/platform', {
              headers: { authorization: 'Bearer local-platform-cron-fixture' },
            })
          )
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
          )
          const body = await response.json()
          expect(body).toEqual({
            success: true,
            completed: expect.any(Number),
            retried: 0,
            failed: 0,
            lostLease: 0,
            registeredTopics: 3,
          })
          // Crossing a minute legitimately enqueues one new maintenance event.
          expect([0, 1]).toContain(body.completed)
        }
        vi.stubEnv('PLATFORM_DATABASE_URL', businessUrl)
        expect(await runConfiguredPlatformJobs()).toEqual({
          status: 503,
          body: { error: 'Platform jobs unavailable' },
        })
        vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
        expect(getPlatformDatabaseRuntime().prisma).toBe(runtime.prisma)
      } finally {
        if (runtime) {
          await runtime.prisma.$disconnect()
          await runtime.pool.end()
        }
        vi.unstubAllEnvs()
      }
    })
    it('deduplicates maintenance registration across instances within the same injected minute', async () => {
      const maintenance = createPlatformMaintenance(scope, now)
      const registrations = await Promise.all(
        Array.from({ length: 10 }, () => maintenance.enqueue())
      )
      const first = registrations[0]!
      expect(new Set(registrations.map((event) => event.id)).size).toBe(1)
      expect(first.availableAt).toEqual(now)
      expect(
        (
          await createPlatformJobs({
            scope,
            handlers: maintenance.handlers,
            workerId: () => 'maintenance',
            now: () => now,
            limit: 1,
          })()
        ).completed
      ).toBe(1)
      const repeated = await maintenance.enqueue()
      expect(repeated.id).toBe(first.id)
      expect(repeated.status).toBe('COMPLETED')
      expect(repeated.attempts).toBe(1)
    })
  }
)
