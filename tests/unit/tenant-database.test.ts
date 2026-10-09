import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { checkTenantDatabase } from '../../tools/tenant-database-check.mjs'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient, type Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { enqueueOutbox } from '@gb-locacoes/backend/outbox'
import { createPrismaOutboxRepository } from '../../packages/backend/src/modules/outbox/adapters/prisma-outbox'
import { dispatchOutbox } from '../../packages/backend/src/modules/outbox/dispatch'
import { alterSharedAcl } from '../helpers/shared-acl'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Tenant database isolation and durable effects',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const runtimeRole = 'test_runtime_' + suffix
    const tenantA = 'test-a-' + suffix
    const tenantB = 'test-b-' + suffix
    let admin: Pool
    let runtime: Pool
    let client: PrismaClient
    let adminClient: PrismaClient

    beforeAll(async () => {
      if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
        throw new Error('Disposable database opt-in required')
      const connectionString = requireTestDatabase(process.env)
      admin = new Pool({ connectionString })
      adminClient = new PrismaClient({ adapter: new PrismaPg(admin) })
      // With a password: the CI service authenticates TCP clients with scram-sha-256.
      const runtimeUrl = await createLoginRole(
        admin,
        connectionString,
        runtimeRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      await alterSharedAcl(admin, [
        'GRANT USAGE ON SCHEMA public TO "' + runtimeRole + '"',
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "' +
          runtimeRole +
          '"',
      ])
      const platformModels = JSON.parse(
        fs.readFileSync('tools/tenant-models.json', 'utf8')
      ).platformModels as { table: string; read: string }[]
      await alterSharedAcl(admin, [
        'REVOKE ALL ON ' +
          platformModels.map((row) => '"' + row.table + '"').join(', ') +
          ' FROM "' +
          runtimeRole +
          '"',
        'GRANT SELECT ON ' +
          platformModels
            .filter((row) => row.read !== 'platform')
            .map((row) => '"' + row.table + '"')
            .join(', ') +
          ' TO "' +
          runtimeRole +
          '"',
      ])
      runtime = new Pool({ connectionString: runtimeUrl, max: 10 })
      client = new PrismaClient({ adapter: new PrismaPg(runtime) })
      await adminClient.organization.createMany({
        data: [
          { id: tenantA, slug: tenantA, name: 'Fixture A' },
          { id: tenantB, slug: tenantB, name: 'Fixture B' },
        ],
      })
      await adminClient.driver.createMany({
        data: [
          { tenantId: tenantA, name: 'Driver A', phone: '00000000000' },
          { tenantId: tenantB, name: 'Driver B', phone: '00000000000' },
          { name: 'Unassigned fixture ' + suffix, phone: '00000000000' },
        ],
      })
    })

    async function scoped<T>(
      tenantId: string,
      operation: (tx: Prisma.TransactionClient) => Promise<T>
    ) {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
        return operation(tx)
      })
    }

    afterAll(async () => {
      await client?.$disconnect()
      await runtime?.end()
      if (adminClient) {
        await adminClient.outboxEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        })
        await adminClient.equipment.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        })
        await adminClient.category.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        })
        await adminClient.driver.deleteMany({
          where: {
            OR: [
              { tenantId: { in: [tenantA, tenantB] } },
              { name: 'Unassigned fixture ' + suffix },
            ],
          },
        })
        await adminClient.organization.deleteMany({
          where: { id: { in: [tenantA, tenantB] } },
        })
        await adminClient.$disconnect()
      }
      if (admin) {
        await alterSharedAcl(admin, [
          'DROP OWNED BY "' + runtimeRole + '"',
          'DROP ROLE "' + runtimeRole + '"',
        ])
        await admin.end()
      }
    })

    it('uses a role without RLS bypass and hides unscoped/unassigned rows', async () => {
      const role = await runtime.query(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
      )
      expect(await checkTenantDatabase(runtime)).toMatchObject({
        ok: true,
        tables: 32,
        issues: [],
      })
      expect((await checkTenantDatabase(admin)).issues).toContain(
        'RUNTIME_ROLE_CAN_BYPASS_ISOLATION'
      )
      expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
      expect(await client.driver.findMany()).toEqual([])
      expect(
        (await scoped(tenantA, (tx) => tx.driver.findMany())).map(
          (row) => row.name
        )
      ).toEqual(['Driver A'])
      expect(
        (await scoped(tenantB, (tx) => tx.driver.findMany())).map(
          (row) => row.name
        )
      ).toEqual(['Driver B'])
      expect(await client.driver.findMany()).toEqual([])
    })

    it('rejects writes claiming another tenant even with a valid row id', async () => {
      await expect(
        scoped(tenantA, (tx) =>
          tx.driver.create({
            data: { tenantId: tenantB, name: 'Spoof', phone: '0' },
          })
        )
      ).rejects.toThrow()
      const foreign = await adminClient.driver.findFirstOrThrow({
        where: { tenantId: tenantB },
      })
      const result = await scoped(tenantA, (tx) =>
        tx.driver.updateMany({
          where: { id: foreign.id },
          data: { name: 'Spoof' },
        })
      )
      expect(result.count).toBe(0)
    })

    it('rejects references to resources belonging to another tenant', async () => {
      const category = await adminClient.category.create({
        data: { tenantId: tenantB, slug: suffix, name: 'Fixture category' },
      })
      await expect(
        scoped(tenantA, (tx) =>
          tx.equipment.create({
            data: {
              tenantId: tenantA,
              categoryId: category.id,
              name: 'Spoof',
              pricePerDay: 1,
              images: [],
            },
          })
        )
      ).rejects.toThrow()
    })

    it('rolls back events with their business transaction and deduplicates committed events', async () => {
      const event = {
        tenantId: tenantA,
        topic: 'test.effect',
        aggregateId: suffix,
        payload: { safe: true },
        dedupeKey: 'rollback',
      }
      await expect(
        scoped(tenantA, async (tx) => {
          await enqueueOutbox(tx, event)
          throw new Error('simulated rollback')
        })
      ).rejects.toThrow('simulated rollback')
      expect(await scoped(tenantA, (tx) => tx.outboxEvent.count())).toBe(0)
      const first = await scoped(tenantA, (tx) =>
        enqueueOutbox(tx, { ...event, dedupeKey: 'committed' })
      )
      const second = await scoped(tenantA, (tx) =>
        enqueueOutbox(tx, { ...event, dedupeKey: 'committed' })
      )
      expect(first.id).toBe(second.id)
      const other = createPrismaOutboxRepository(client, tenantB)
      expect(await other.claim('foreign-worker', new Date(), 1000)).toBeNull()
    })

    it('only one concurrent worker claims an event and a stale worker cannot acknowledge it', async () => {
      const repository = createPrismaOutboxRepository(client, tenantA)
      const now = new Date()
      const claims = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          repository.claim('worker-' + index, now, 1000)
        )
      )
      const claimed = claims.filter((value) => value !== null)
      expect(claimed).toHaveLength(1)
      const old = claimed[0]!
      const newer = await repository.claim(
        'replacement-worker',
        new Date(now.getTime() + 1001),
        1000
      )
      expect(newer?.id).toBe(old.id)
      expect(await repository.complete(old, now)).toBe(false)
      expect(
        await repository.complete(newer!, new Date(now.getTime() + 1002))
      ).toBe(true)
    })

    it('retries a failed external effect without persisting its sensitive error text', async () => {
      await scoped(tenantA, (tx) =>
        enqueueOutbox(tx, {
          tenantId: tenantA,
          topic: 'test.retry',
          aggregateId: suffix,
          payload: {},
          dedupeKey: 'retry',
        })
      )
      const repository = createPrismaOutboxRepository(client, tenantA)
      const first = await dispatchOutbox({
        repository,
        workerId: 'failure-worker',
        limit: 1,
        handlers: {
          'test.retry': async () => {
            throw new Error('sensitive provider response')
          },
        },
      })
      expect(first.retried).toBe(1)
      const row = await adminClient.outboxEvent.findUniqueOrThrow({
        where: { dedupeKey: tenantA + ':retry' },
      })
      expect(row.lastError).toBe('DELIVERY_FAILED')
      await adminClient.outboxEvent.update({
        where: { id: row.id },
        data: { availableAt: new Date(0) },
      })
      const second = await dispatchOutbox({
        repository,
        workerId: 'success-worker',
        limit: 1,
        handlers: { 'test.retry': async () => {} },
      })
      expect(second.completed).toBe(1)
    })
  }
)
