import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/tenant-principal'
import type { AuthenticatedTenantWebhook } from '../../packages/backend/src/modules/identity/tenant-webhook'
import { createWebhookInbox } from '../../packages/backend/src/modules/outbox/webhook-inbox'
import { alterSharedAcl } from '../helpers/shared-acl'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Webhook receipts under real PostgreSQL contention and FORCE RLS',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const role = 'inbox_race_' + suffix
    const tenants = ['inbox-a-' + suffix, 'inbox-b-' + suffix]
    const providers = ['PIX', 'ASAAS', 'ZAPSIGN', 'WHATSAPP'] as const
    const integrations = providers.map(() => randomUUID())
    const foreignIntegration = randomUUID()
    let adminPool: Pool
    let admin: PrismaClient
    const pools: Pool[] = []
    const clients: PrismaClient[] = []
    const failures: string[] = []

    beforeAll(async () => {
      const url = requireTestDatabase(process.env)
      adminPool = new Pool({ connectionString: url })
      admin = new PrismaClient({ adapter: new PrismaPg(adminPool) })
      const runtimeUrl = await createLoginRole(
        adminPool,
        url,
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      await alterSharedAcl(adminPool, [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
      ])
      // Independent pools match the two HTTP processes, each with one connection.
      for (let i = 0; i < 2; i++) {
        const pool = new Pool({ connectionString: runtimeUrl, max: 1 })
        pools.push(pool)
        clients.push(new PrismaClient({ adapter: new PrismaPg(pool) }))
      }
      await admin.organization.createMany({
        data: tenants.map((id) => ({
          id,
          slug: id,
          name: 'Local inbox fixture',
        })),
      })
      await admin.tenantIntegration.createMany({
        data: [
          ...providers.map((provider, index) => ({
            id: integrations[index]!,
            tenantId: tenants[0]!,
            provider,
            credentialsRef: 'env:LOCADORA_INTEGRATION_LOCAL_FIXTURE',
          })),
          {
            id: foreignIntegration,
            tenantId: tenants[1]!,
            provider: 'PIX',
            credentialsRef: 'env:LOCADORA_INTEGRATION_LOCAL_FIXTURE',
          },
        ],
      })
    })

    beforeEach(async () => {
      failures.length = 0
      await admin.outboxEvent.deleteMany({
        where: { tenantId: { in: tenants } },
      })
      await admin.webhookInbox.deleteMany({
        where: { tenantId: { in: tenants } },
      })
    })

    afterAll(async () => {
      for (const client of clients) await client.$disconnect()
      for (const pool of pools) await pool.end()
      if (admin) {
        await admin.outboxEvent.deleteMany({
          where: { tenantId: { in: tenants } },
        })
        await admin.webhookInbox.deleteMany({
          where: { tenantId: { in: tenants } },
        })
        await admin.tenantIntegration.deleteMany({
          where: { tenantId: { in: tenants } },
        })
        await admin.organization.deleteMany({ where: { id: { in: tenants } } })
        await admin.$disconnect()
      }
      if (adminPool) {
        await alterSharedAcl(adminPool, [
          `DROP OWNED BY "${role}"`,
          `DROP ROLE "${role}"`,
        ])
        await adminPool.end()
      }
    })

    function event(index = 0): AuthenticatedTenantWebhook {
      const body = { id: 'same-provider-event', value: 'local fixture' }
      return {
        body,
        payloadHash: createHash('sha256')
          .update(JSON.stringify(body))
          .digest('hex'),
        context: { tenantId: tenants[0]! },
        integration: {
          id: integrations[index]!,
          tenantId: tenants[0]!,
          provider: providers[index]!,
          externalAccountId: null,
        },
      }
    }

    function inbox(
      index: number,
      consume: (_event: AuthenticatedTenantWebhook) => Promise<Response>
    ) {
      return createWebhookInbox({
        withTenantTransaction: async (context, operation) => {
          try {
            return await withTenantTransaction(
              clients[index]!,
              context,
              operation
            )
          } catch (error) {
            failures.push(
              error && typeof error === 'object' && 'code' in error
                ? String(error.code)
                : 'UNKNOWN'
            )
            throw error
          }
        },
        consumers: Object.fromEntries(
          providers.map((provider) => [
            provider,
            async () => ({ consumeWebhook: consume }),
          ])
        ),
      })
    }

    it.each(providers.map((provider, index) => [provider, index] as const))(
      '%s: concurrent first deliveries persist once and apply one effect without persistence failure',
      async (_provider, index) => {
        const name = 'inbox_barrier_' + suffix
        const key = 'local-inbox-barrier-' + suffix
        const connection = await adminPool.connect()
        const incoming = event(index)
        let consumed = 0
        const consume = async () => {
          consumed++
          return Response.json({ ok: true })
        }
        const services = [inbox(0, consume), inbox(1, consume)]
        let pending: Promise<Response>[] = []
        try {
          // Hold both INSERTs after the old upsert's read, exposing the real race.
          await adminPool.query(
            `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."integrationId"='${incoming.integration.id}' THEN PERFORM pg_advisory_xact_lock(hashtextextended('${key}',0)); END IF; RETURN NEW; END $$`
          )
          await adminPool.query(
            `CREATE TRIGGER ${name} BEFORE INSERT ON webhook_inbox FOR EACH ROW EXECUTE FUNCTION ${name}()`
          )
          await connection.query('BEGIN')
          await connection.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            [key]
          )
          pending = services.map((service) =>
            service.acceptTenantWebhook(incoming, consume)
          )
          let waiting = 0
          for (let n = 0; n < 150 && waiting < 2; n++) {
            waiting = Number(
              (
                await adminPool.query(
                  "SELECT count(*) FROM pg_stat_activity WHERE usename=$1 AND wait_event='advisory' AND query LIKE '%webhook_inbox%'",
                  [role]
                )
              ).rows[0].count
            )
            if (waiting < 2)
              await new Promise((resolve) => setTimeout(resolve, 20))
          }
          expect(
            waiting,
            'Both independent runtime INSERTs must reach the SQL barrier'
          ).toBe(2)
          await connection.query('COMMIT')
          const responses = await Promise.all(pending)
          expect(
            responses.map((r) => r.status),
            'SQL failures: ' + failures.join(',')
          ).not.toContain(503)
          expect(responses.every((r) => [200, 202].includes(r.status))).toBe(
            true
          )
          expect(responses.some((r) => r.status === 200)).toBe(true)
          expect(consumed).toBe(1)
          const receipt = await admin.webhookInbox.findFirstOrThrow({
            where: { integrationId: incoming.integration.id },
          })
          expect(receipt).toMatchObject({
            tenantId: tenants[0],
            processedAt: expect.any(Date),
            processingToken: null,
            lockedUntil: null,
          })
          expect(
            await admin.webhookInbox.count({
              where: { integrationId: incoming.integration.id },
            })
          ).toBe(1)
          expect(
            await admin.outboxEvent.count({
              where: { aggregateId: receipt.id },
            })
          ).toBe(1)
          const retry = await services[1]!.acceptTenantWebhook(
            incoming,
            consume
          )
          expect(retry.status).toBe(200)
          expect(await retry.json()).toEqual({ success: true, duplicate: true })
          expect(consumed).toBe(1)
        } finally {
          await connection.query('ROLLBACK')
          await Promise.allSettled(pending)
          await adminPool.query(
            `DROP TRIGGER IF EXISTS ${name} ON webhook_inbox`
          )
          await adminPool.query(`DROP FUNCTION IF EXISTS ${name}()`)
          connection.release()
        }
      }
    )

    it('keeps a provider event identity conflict separate from a duplicate', async () => {
      let consumed = 0
      const consume = async () => {
        consumed++
        return Response.json({ ok: true })
      }
      const incoming = event()
      const results = await Promise.all([
        inbox(0, consume).acceptTenantWebhook(incoming, consume),
        inbox(1, consume).acceptTenantWebhook(
          { ...incoming, payloadHash: 'changed-authenticated-bytes' },
          consume
        ),
      ])
      expect(results.map((r) => r.status).sort()).toEqual([200, 409])
      expect(await results.find((r) => r.status === 409)!.json()).toEqual({
        error: 'Webhook event identity conflict',
      })
      expect(consumed).toBe(1)
      expect(
        await admin.webhookInbox.count({ where: { tenantId: { in: tenants } } })
      ).toBe(1)
      expect(
        await admin.outboxEvent.count({ where: { tenantId: { in: tenants } } })
      ).toBe(1)
    })

    it('does not mix identical external keys across integrations and tenant RLS', async () => {
      const consume = async () => Response.json({ ok: true })
      const incoming = event()
      const foreign = {
        ...incoming,
        context: { tenantId: tenants[1]! },
        integration: {
          ...incoming.integration,
          id: foreignIntegration,
          tenantId: tenants[1]!,
        },
      }
      const responses = await Promise.all([
        inbox(0, consume).acceptTenantWebhook(incoming, consume),
        inbox(1, consume).acceptTenantWebhook(foreign, consume),
      ])
      expect(responses.map((r) => r.status)).toEqual([200, 200])
      const roles = await pools[0]!.query(
        'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
      )
      expect(roles.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
      expect(await clients[0]!.webhookInbox.findMany()).toEqual([])
      for (const tenantId of tenants) {
        const rows = await withTenantTransaction(
          clients[0]!,
          { tenantId },
          (tx) => tx.webhookInbox.findMany()
        )
        expect(rows).toHaveLength(1)
        expect(rows[0]!.tenantId).toBe(tenantId)
      }
    })

    it('rolls back the receipt if durable enqueue fails and allows a clean retry', async () => {
      const name = 'inbox_outbox_failure_' + suffix
      let consumed = 0
      const consume = async () => {
        consumed++
        return Response.json({ ok: true })
      }
      const incoming = event(),
        service = inbox(0, consume)
      await adminPool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId"='${tenants[0]}' THEN RAISE EXCEPTION 'local private fixture failure'; END IF; RETURN NEW; END $$`
      )
      try {
        await adminPool.query(
          `CREATE TRIGGER ${name} BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION ${name}()`
        )
        try {
          const failed = await service.acceptTenantWebhook(incoming, consume)
          expect(failed.status).toBe(503)
          expect(await failed.json()).toEqual({
            error: 'Webhook persistence unavailable',
          })
          expect(consumed).toBe(0)
          expect(
            await admin.webhookInbox.count({ where: { tenantId: tenants[0] } })
          ).toBe(0)
          expect(
            await admin.outboxEvent.count({ where: { tenantId: tenants[0] } })
          ).toBe(0)
        } finally {
          await adminPool.query(
            `DROP TRIGGER IF EXISTS ${name} ON outbox_events`
          )
        }
      } finally {
        await adminPool.query(`DROP FUNCTION IF EXISTS ${name}()`)
      }
      expect(
        (await service.acceptTenantWebhook(incoming, consume)).status
      ).toBe(200)
      expect(consumed).toBe(1)
      expect(
        await admin.webhookInbox.count({ where: { tenantId: tenants[0] } })
      ).toBe(1)
      expect(
        await admin.outboxEvent.count({ where: { tenantId: tenants[0] } })
      ).toBe(1)
    })

    it('preserves the active lease while another host acknowledges the same receipt', async () => {
      let started!: () => void, release!: () => void
      const entered = new Promise<void>((resolve) => {
        started = resolve
      })
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      let consumed = 0
      const consume = async () => {
        consumed++
        started()
        await held
        return Response.json({ ok: true })
      }
      const incoming = event(),
        first = inbox(0, consume).acceptTenantWebhook(incoming, consume)
      try {
        await entered
        const before = await admin.webhookInbox.findFirstOrThrow({
          where: { integrationId: incoming.integration.id },
        })
        expect(before).toMatchObject({
          processedAt: null,
          processingToken: expect.any(String),
          lockedUntil: expect.any(Date),
        })
        const second = await inbox(1, consume).acceptTenantWebhook(
          incoming,
          consume
        )
        expect(second.status).toBe(202)
        expect(await second.json()).toEqual({
          accepted: true,
          processing: true,
        })
        expect(
          await admin.webhookInbox.findUniqueOrThrow({
            where: { id: before.id },
          })
        ).toMatchObject({
          processingToken: before.processingToken,
          lockedUntil: before.lockedUntil,
          processedAt: null,
        })
        expect(consumed).toBe(1)
      } finally {
        release()
        expect((await first).status).toBe(200)
      }
    })

    it('retains a failed consumer for the outbox, then completes it exactly once', async () => {
      let consumed = 0
      const consume = async () =>
        Response.json(
          { ok: ++consumed > 1 },
          { status: consumed === 1 ? 500 : 200 }
        )
      const service = inbox(0, consume),
        incoming = event()
      expect(
        (await service.acceptTenantWebhook(incoming, consume)).status
      ).toBe(500)
      const receipt = await admin.webhookInbox.findFirstOrThrow({
        where: { integrationId: incoming.integration.id },
      })
      expect(receipt).toMatchObject({
        processedAt: null,
        lastError: 'CONSUMER_HTTP_500',
        processingToken: null,
        lockedUntil: null,
      })
      await service.runWebhookInboxEffect(incoming.context, 'local-outbox', {
        inboxId: receipt.id,
      })
      await service.runWebhookInboxEffect(incoming.context, 'local-outbox', {
        inboxId: receipt.id,
      })
      expect(consumed).toBe(2)
      expect(
        await admin.webhookInbox.findUniqueOrThrow({
          where: { id: receipt.id },
        })
      ).toMatchObject({ processedAt: expect.any(Date), lastError: null })
      expect(
        await admin.outboxEvent.count({ where: { aggregateId: receipt.id } })
      ).toBe(1)
    })
  }
)
