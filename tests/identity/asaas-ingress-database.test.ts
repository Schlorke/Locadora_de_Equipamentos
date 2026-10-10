import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createPlatformAsaasIngress } from '../../packages/backend/src/modules/platform-webhooks/index'
import { createWebhookInbox } from '../../packages/backend/src/modules/outbox/index'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/tenant-principal'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'

import { POST as apiRoot } from '../../apps/services/api/src/app/api/webhooks/asaas/platform/route'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'S5 Asaas durable ingress with separate restricted LOGIN roles',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'asaas_ingress_' + suffix + '_test'
    const role = 'platform_' + suffix,
      businessRole = 'business_' + suffix
    const token = 'local-root-token-synthetic-only-123456'
    const hash = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex')
    let admin: Pool, db: Pool, platformPool: Pool, businessPool: Pool
    let platform: PrismaClient, business: PrismaClient, inspector: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      receive: ReturnType<typeof createPlatformAsaasIngress>
    let inbox: ReturnType<typeof createWebhookInbox>
    let configured = false
    let consumerStatus = 200,
      effects = 0
    const event = (id: string, extra = {}) => ({
      id,
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay-' + id,
        status: 'RECEIVED',
        value: 10,
        subscription: 'sub-alfa',
      },
      ...extra,
    })
    const root = (body: unknown) =>
      receive({ source: 'ASAAS_ROOT', body, payloadHash: hash(body) })
    const tenant = (body: unknown, which = 'alfa') => ({
      body,
      payloadHash: hash(body),
      context: { tenantId: which },
      integration: {
        id: 'integration-' + which,
        provider: 'ASAAS',
        tenantId: which,
        externalAccountId: 'acc-' + which,
      },
    })
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      db = new Pool({ connectionString: url.toString(), max: 1 })
      for (const name of fs
        .readdirSync('prisma/migrations')
        .filter((name) => /^\d{12}_/.test(name))
        .sort())
        await db.query(
          fs.readFileSync(
            'prisma/migrations/' + name + '/migration.sql',
            'utf8'
          )
        )
      const platformUrl = await createLoginRole(
        db,
        url.toString(),
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      const businessUrl = await createLoginRole(
        db,
        url.toString(),
        businessRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (const [profile, name] of [
        ['app_runtime', businessRole],
        ['platform_runtime', role],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + profile + '.sql', 'utf8')
            .replaceAll(profile!, name!)
        )
      platformPool = new Pool({ connectionString: platformUrl, max: 2 })
      businessPool = new Pool({ connectionString: businessUrl, max: 2 })
      platform = new PrismaClient({ adapter: new PrismaPg(platformPool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(platform)
      receive = createPlatformAsaasIngress({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
      })
      await scope.withPlatformTransaction(async (tx) => {
        for (const id of ['alfa', 'bravo']) {
          await tx.organization.create({
            data: { id, slug: id, name: 'Synthetic ' + id },
          })
          await tx.tenantIntegration.create({
            data: {
              id: 'integration-' + id,
              tenantId: id,
              provider: 'ASAAS',
              environment: 'sandbox',
              externalAccountId: 'acc-' + id,
              credentialsRef: 'env:LOCADORA_INTEGRATION_LOCAL_FIXTURE',
            },
          })
        }
        const version = await tx.planVersion.findFirstOrThrow()
        await tx.subscription.create({
          data: {
            id: 'subscription-alfa',
            tenantId: 'alfa',
            planVersionId: version.id,
            status: 'INCOMPLETE',
            providerEnvironment: 'sandbox',
            providerSubscriptionId: 'sub-alfa',
          },
        })
        await tx.platformInvoice.create({
          data: {
            id: 'invoice-alfa',
            tenantId: 'alfa',
            subscriptionId: 'subscription-alfa',
            providerPaymentId: 'invoice-pay-alfa',
            amount: '10.00',
            dueDate: new Date('2026-10-03T00:00:00Z'),
            syncedAt: new Date(),
          },
        })
        await tx.paymentAccount.create({
          data: {
            tenantId: 'bravo',
            integrationId: 'integration-bravo',
            mode: 'ASAAS_CONNECTED_ACCOUNT',
            environment: 'sandbox',
            providerAccountId: 'acc-bravo',
          },
        })
      })
      inbox = createWebhookInbox({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
        consumers: {
          ASAAS: async () => ({
            consumeWebhook: async () => {
              effects++
              return Response.json({}, { status: consumerStatus })
            },
          }),
        },
      })
      vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
      vi.stubEnv('DATABASE_URL', businessUrl)
      vi.stubEnv('PLATFORM_ASAAS_ENVIRONMENT', 'sandbox')
      vi.stubEnv(
        'PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256',
        createHash('sha256').update(token).digest('hex')
      )
      vi.stubEnv('PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256', '')
      configured = true
    }, 120_000)
    afterAll(async () => {
      if (configured) {
        const runtime = getPlatformDatabaseRuntime()
        await runtime.prisma.$disconnect()
        await runtime.pool.end()
      }
      vi.unstubAllEnvs()
      for (const client of [platform, business, inspector])
        await client?.$disconnect()
      for (const pool of [platformPool, businessPool, db]) await pool?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const name of [role, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + name + '"')
        await admin.end()
      }
    })
    it('simultaneous root deliveries persist exactly one inbox and outbox, without business effects', async () => {
      const body = event('root-race')
      const results = await Promise.all(
        Array.from({ length: 8 }, () => root(body))
      )
      expect(results.every((result) => result.accepted)).toBe(true)
      expect(
        results.filter((result) => !('duplicate' in result && result.duplicate))
      ).toHaveLength(1)
      const receipt = await inspector.platformWebhookInbox.findUniqueOrThrow({
        where: {
          source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:root-race' },
        },
      })
      expect(receipt).toMatchObject({
        tenantId: 'alfa',
        status: 'RECEIVED',
        processedAt: null,
        payloadHash: hash(body),
      })
      expect(
        await inspector.platformOutboxEvent.count({
          where: {
            aggregateId: receipt.id,
            topic: 'subscriptions.invoice.webhook',
            status: 'PENDING',
          },
        })
      ).toBe(1)
      expect(await inspector.webhookInbox.count()).toBe(0)
      expect(effects).toBe(0)
    })
    it.each([
      [
        'subscription-reference',
        {
          payment: {
            id: 'p',
            status: 'RECEIVED',
            value: 10,
            externalReference: 'sub:subscription-alfa',
          },
        },
        'alfa',
      ],
      [
        'invoice-reference',
        {
          payment: {
            id: 'p',
            status: 'RECEIVED',
            value: 10,
            externalReference: 'inv:invoice-alfa',
          },
        },
        'alfa',
      ],
      [
        'account-reference',
        {
          event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
          account: { id: 'acc-bravo' },
        },
        'bravo',
      ],
    ] as const)(
      'routes root %s using platform records only',
      async (id, extra, which) => {
        await root(event(id, extra))
        const receipt = await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: {
            source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:' + id },
          },
        })
        expect(receipt.tenantId).toBe(which)
        expect(receipt.status).toBe('RECEIVED')
      }
    )
    it('records UNROUTED with an alert and IGNORED without a dispatch', async () => {
      await root(
        event('unrouted', {
          payment: { id: 'unknown', value: 10, subscription: 'unknown' },
        })
      )
      await root({ id: 'ignored', event: 'OTHER_NEW', apiKey: 'never-retain' })
      for (const [id, status] of [
        ['unrouted', 'UNROUTED'],
        ['ignored', 'IGNORED'],
      ]) {
        const receipt = await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: {
            source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:' + id },
          },
        })
        expect(receipt.status).toBe(status)
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: receipt.id },
          })
        ).toBe(0)
        expect(
          await inspector.platformAuditLog.count({
            where: { targetId: receipt.id, action: 'webhook.unrouted' },
          })
        ).toBe(status === 'UNROUTED' ? 1 : 0)
        expect(JSON.stringify(receipt.payload)).not.toContain('never-retain')
      }
    })
    it('detects changed identity, retains the original, and records one durable alert', async () => {
      const body = event('identity')
      await root(body)
      const changed = event('identity', {
        payment: { id: 'evil', value: 100, subscription: 'sub-alfa' },
      })
      expect(await root(changed)).toMatchObject({
        accepted: true,
        conflict: true,
      })
      expect(await root(changed)).toMatchObject({
        accepted: true,
        conflict: true,
      })
      const receipt = await inspector.platformWebhookInbox.findUniqueOrThrow({
        where: {
          source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:identity' },
        },
      })
      expect(receipt).toMatchObject({
        payloadHash: hash(body),
        status: 'CONFLICT',
      })
      expect((receipt.payload as { payment: { id: string } }).payment.id).toBe(
        'pay-identity'
      )
      expect(
        await inspector.platformAuditLog.count({
          where: { targetId: receipt.id, action: 'webhook.identity.conflict' },
        })
      ).toBe(1)
    })
    it('namespaces account events by integration and never stores provider keys', async () => {
      const body = {
        id: 'same-account-event',
        event: 'ACCESS_TOKEN_DISABLED',
        accessToken: { id: 'key', enabled: false, apiKey: 'never-retain' },
      }
      for (const which of ['alfa', 'bravo'])
        await receive({ ...tenant(body, which), source: 'ASAAS_ACCOUNT' })
      const receipts = await inspector.platformWebhookInbox.findMany({
        where: { source: 'ASAAS_ACCOUNT' },
        orderBy: { tenantId: 'asc' },
      })
      expect(receipts.map((row) => row.tenantId)).toEqual(['alfa', 'bravo'])
      expect(new Set(receipts.map((row) => row.eventId)).size).toBe(2)
      expect(
        receipts.every(
          (row) => !JSON.stringify(row.payload).includes('never-retain')
        )
      ).toBe(true)
      await expect(
        receive({
          ...tenant(body),
          source: 'ASAAS_ACCOUNT',
          integration: { ...tenant(body).integration, tenantId: 'bravo' },
        })
      ).rejects.toThrow('INVALID_ACCOUNT_WEBHOOK')
    })
    it('rolls back both receipt and alert when dispatch cannot be persisted', async () => {
      let rolledBackId = ''
      const broken = createPlatformAsaasIngress({
        environment: 'sandbox',
        transaction: (operation) =>
          scope.withPlatformTransaction(async (tx) => {
            await operation(tx)
            rolledBackId = (
              await tx.platformWebhookInbox.findUniqueOrThrow({
                where: {
                  source_eventId: {
                    source: 'ASAAS_ROOT',
                    eventId: 'id:rollback',
                  },
                },
              })
            ).id
            throw new Error('synthetic-after-write-failure')
          }),
      })
      const body = event('rollback')
      await expect(
        broken({ source: 'ASAAS_ROOT', body, payloadHash: hash(body) })
      ).rejects.toThrow('synthetic-after-write-failure')
      expect(
        await inspector.platformWebhookInbox.count({
          where: { eventId: 'id:rollback' },
        })
      ).toBe(0)
      expect(rolledBackId).not.toBe('')
      expect(
        await inspector.platformOutboxEvent.count({
          where: { aggregateId: rolledBackId },
        })
      ).toBe(0)
    })
    it('queued tenant ingress commits once, returns before the effect, and the worker runs the stored payload', async () => {
      const body = event('tenant-queue'),
        incoming = tenant(body),
        before = effects
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          inbox.acceptQueuedAsaasWebhook(incoming)
        )
      )
      expect(results.every((result) => result.status === 200)).toBe(true)
      expect(effects).toBe(before)
      const receipt = await inspector.webhookInbox.findUniqueOrThrow({
        where: {
          integrationId_eventKey: {
            integrationId: incoming.integration.id,
            eventKey: 'id:tenant-queue',
          },
        },
      })
      expect(receipt.processedAt).toBeNull()
      const outbox = await inspector.outboxEvent.findFirstOrThrow({
        where: { aggregateId: receipt.id },
      })
      await inbox.runWebhookInboxEffect(
        incoming.context,
        outbox.id,
        outbox.payload
      )
      await inbox.runWebhookInboxEffect(
        incoming.context,
        outbox.id,
        outbox.payload
      )
      expect(effects).toBe(before + 1)
      expect(
        (
          await inspector.webhookInbox.findUniqueOrThrow({
            where: { id: receipt.id },
          })
        ).processedAt
      ).toBeInstanceOf(Date)
      await expect(
        withTenantTransaction(business, { tenantId: 'bravo' }, (tx) =>
          tx.webhookInbox.findUniqueOrThrow({ where: { id: receipt.id } })
        )
      ).rejects.toThrow()
    })
    it.each([404, 409])(
      'queued consumer HTTP %s is terminal locally, with reconciliation audit for value conflicts',
      async (status) => {
        const incoming = tenant(event('consumer-' + status))
        consumerStatus = status
        try {
          expect((await inbox.acceptQueuedAsaasWebhook(incoming)).status).toBe(
            200
          )
          const receipt = await inspector.webhookInbox.findUniqueOrThrow({
            where: {
              integrationId_eventKey: {
                integrationId: incoming.integration.id,
                eventKey: 'id:consumer-' + status,
              },
            },
          })
          const outbox = await inspector.outboxEvent.findFirstOrThrow({
            where: { aggregateId: receipt.id },
          })
          await inbox.runWebhookInboxEffect(
            incoming.context,
            outbox.id,
            outbox.payload
          )
          expect(
            await inspector.webhookInbox.findUniqueOrThrow({
              where: { id: receipt.id },
            })
          ).toMatchObject({
            processedAt: expect.any(Date),
            lastError:
              status === 409
                ? 'RECONCILIATION_REQUIRED'
                : 'IGNORED_UNKNOWN_PAYMENT',
          })
          expect(
            await inspector.auditLog.count({
              where: {
                entityId: receipt.id,
                action: 'PAYMENT_RECONCILIATION_REQUIRED',
              },
            })
          ).toBe(status === 409 ? 1 : 0)
        } finally {
          consumerStatus = 200
        }
      }
    )
    it('conflicting queued identity blocks its effect and retains a single alert', async () => {
      const incoming = tenant(event('tenant-conflict'))
      await inbox.acceptQueuedAsaasWebhook(incoming)
      const changed = tenant(
        event('tenant-conflict', { payment: { id: 'other', value: 11 } })
      )
      const result = await inbox.acceptQueuedAsaasWebhook(changed)
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({ conflict: true })
      const receipt = await inspector.webhookInbox.findUniqueOrThrow({
        where: {
          integrationId_eventKey: {
            integrationId: incoming.integration.id,
            eventKey: 'id:tenant-conflict',
          },
        },
      })
      const outbox = await inspector.outboxEvent.findFirstOrThrow({
        where: { aggregateId: receipt.id },
      })
      const before = effects
      await inbox.runWebhookInboxEffect(
        incoming.context,
        outbox.id,
        outbox.payload
      )
      expect(effects).toBe(before)
      expect(receipt).toMatchObject({
        payloadHash: incoming.payloadHash,
        lastError: 'EVENT_IDENTITY_CONFLICT',
      })
      expect(
        await inspector.auditLog.count({
          where: { entityId: receipt.id, action: 'WEBHOOK_IDENTITY_CONFLICT' },
        })
      ).toBe(1)
    })
    it('an inflight consumer cannot erase a conflicting identity or retain its lease', async () => {
      const incoming = tenant(event('inflight-conflict'))
      await inbox.acceptQueuedAsaasWebhook(incoming)
      const receipt = await inspector.webhookInbox.findUniqueOrThrow({
        where: {
          integrationId_eventKey: {
            integrationId: incoming.integration.id,
            eventKey: 'id:inflight-conflict',
          },
        },
      })
      const outbox = await inspector.outboxEvent.findFirstOrThrow({
        where: { aggregateId: receipt.id },
      })
      let entered!: () => void
      let release!: () => void
      const claimed = new Promise<void>((resolve) => {
        entered = resolve
      })
      const finish = new Promise<void>((resolve) => {
        release = resolve
      })
      const runningInbox = createWebhookInbox({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
        consumers: {
          ASAAS: async () => ({
            consumeWebhook: async () => {
              entered()
              await finish
              return Response.json({})
            },
          }),
        },
      })
      const worker = runningInbox.runWebhookInboxEffect(
        incoming.context,
        outbox.id,
        outbox.payload
      )
      try {
        await claimed
        expect(
          (
            await inspector.webhookInbox.findUniqueOrThrow({
              where: { id: receipt.id },
            })
          ).processingToken
        ).not.toBeNull()
        const result = await inbox.acceptQueuedAsaasWebhook(
          tenant(
            event('inflight-conflict', { payment: { id: 'other', value: 11 } })
          )
        )
        expect(result.status).toBe(200)
        expect(await result.json()).toMatchObject({ conflict: true })
      } finally {
        release()
        await worker
      }
      expect(
        await inspector.webhookInbox.findUniqueOrThrow({
          where: { id: receipt.id },
        })
      ).toMatchObject({
        payloadHash: incoming.payloadHash,
        lastError: 'EVENT_IDENTITY_CONFLICT',
        processedAt: expect.any(Date),
        processingToken: null,
        lockedUntil: null,
      })
      expect(
        await inspector.auditLog.count({
          where: { entityId: receipt.id, action: 'WEBHOOK_IDENTITY_CONFLICT' },
        })
      ).toBe(1)
    })
    it.each([['service', apiRoot]] as const)(
      '%s root adapter enforces authentication and returns only after persistence',
      async (name, handler) => {
        const body = event('adapter-' + name)
        const request = (value: string) =>
          new Request('http://127.0.0.1/api/webhooks/asaas/platform', {
            method: 'POST',
            headers: { 'asaas-access-token': value },
            body: JSON.stringify(body),
          })
        expect((await handler(request('wrong'))).status).toBe(401)
        expect(
          await inspector.platformWebhookInbox.count({
            where: { eventId: 'id:adapter-' + name },
          })
        ).toBe(0)
        const result = await handler(request(token))
        expect(result.status).toBe(200)
        expect(result.headers.get('cache-control')).toBe('private, no-store')
        expect(
          await inspector.platformWebhookInbox.count({
            where: { eventId: 'id:adapter-' + name },
          })
        ).toBe(1)
      }
    )
  }
)
