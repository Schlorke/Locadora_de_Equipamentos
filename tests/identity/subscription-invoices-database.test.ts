import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createPlatformAsaasIngress } from '../../packages/backend/src/modules/platform-webhooks/index'
import {
  createSubscriptionInvoiceConsumer,
  SUBSCRIPTION_INVOICE_TOPIC,
} from '../../packages/backend/src/modules/subscriptions/index'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import {
  runConfiguredPlatformJobs,
  type ScheduledJobResult,
} from '@gb-locacoes/backend/runtime'
import type { AsaasPlatformInvoice } from '@gb-locacoes/backend/billing'
import { GET as legacyCron } from '../../app/api/cron/platform/route'
import { GET as apiCron } from '../../apps/services/api/src/app/api/cron/platform/route'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'subscription invoices under isolated platform role',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'subscription_invoice_' + suffix + '_test'
    const role = 'platform_' + suffix,
      businessRole = 'business_' + suffix
    let admin: Pool, db: Pool, platformPool: Pool, businessPool: Pool
    let platform: PrismaClient,
      inspector: PrismaClient,
      business: PrismaClient,
      platformUrl: string
    let scope: ReturnType<typeof createPlatformScope>,
      receive: ReturnType<typeof createPlatformAsaasIngress>
    let versionId: string,
      ownerId: string,
      tenantId: string,
      subscriptionId: string,
      paymentId: string,
      counter = 0,
      configured = false
    const now = new Date('2026-10-03T16:00:00Z')
    const read = vi.fn<(_target: unknown) => Promise<AsaasPlatformInvoice>>()
    const consumer = () =>
      createSubscriptionInvoiceConsumer({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        read,
        now: () => now,
      })
    const remote = (extra = {}): AsaasPlatformInvoice => ({
      id: paymentId,
      providerStatus: 'CONFIRMED',
      status: 'PAID',
      unknownStatus: false,
      amount: new Prisma.Decimal('149.90'),
      dueDate: '2026-10-03',
      subscription: 'provider-' + subscriptionId,
      customer: 'customer-' + tenantId,
      externalReference: 'sub:' + subscriptionId,
      billingType: 'PIX',
      invoiceUrl: 'https://sandbox.asaas.com/i/fixture',
      paidAt: now,
      ...extra,
    })
    const hash = (body: unknown) =>
      createHash('sha256').update(JSON.stringify(body)).digest('hex')
    const receipt = async (extra = {}) => {
      const body = {
        id: 'invoice-event-' + ++counter,
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: paymentId,
          subscription: 'provider-' + subscriptionId,
          externalReference: 'sub:' + subscriptionId,
          status: 'CONFIRMED',
          value: 149.9,
        },
        ...extra,
      }
      await receive({ source: 'ASAAS_ROOT', body, payloadHash: hash(body) })
      const row = await inspector.platformWebhookInbox.findFirstOrThrow({
        where: { eventId: 'id:' + body.id },
      })
      const outbox = await inspector.platformOutboxEvent.findFirstOrThrow({
        where: { aggregateId: row.id },
      })
      return {
        body,
        row,
        message: {
          ...outbox,
          payload: { inboxId: row.id },
          lockedBy: 'fixture-worker',
        },
      }
    }
    const invoice = () =>
      inspector.platformInvoice.findUnique({
        where: { providerPaymentId: paymentId },
      })
    const subscription = () =>
      inspector.subscription.findUniqueOrThrow({
        where: { id: subscriptionId },
      })
    const handle = async () => {
      const input = await receipt()
      await consumer().handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      return input
    }
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      db = new Pool({ connectionString: url.toString(), max: 1 })
      for (const name of fs
        .readdirSync('prisma/migrations')
        .filter((n) => /^\d{12}_/.test(n))
        .sort())
        await db.query(
          fs.readFileSync(
            'prisma/migrations/' + name + '/migration.sql',
            'utf8'
          )
        )
      platformUrl = await createLoginRole(
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
        ['platform_runtime', role],
        ['app_runtime', businessRole],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + profile + '.sql', 'utf8')
            .replaceAll(profile!, name!)
        )
      platformPool = new Pool({ connectionString: platformUrl, max: 2 })
      businessPool = new Pool({ connectionString: businessUrl, max: 1 })
      platform = new PrismaClient({ adapter: new PrismaPg(platformPool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      ownerId = (
        await inspector.user.create({
          data: { email: 'subscriber-' + suffix + '@example.invalid' },
        })
      ).id
      scope = createPlatformScope(platform)
      receive = createPlatformAsaasIngress({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
      })
      versionId = await scope.withPlatformTransaction(async (tx) => {
        const seed = await tx.planVersion.findFirstOrThrow()
        const plan = await tx.plan.create({
          data: { code: 'synthetic-paid', name: 'Synthetic test plan' },
        })
        return (
          await tx.planVersion.create({
            data: {
              planId: plan.id,
              version: 1,
              amount: '149.90',
              entitlements: seed.entitlements as Prisma.InputJsonValue,
            },
          })
        ).id
      })
    }, 120_000)
    beforeEach(async () => {
      tenantId = 'subscription-test-' + ++counter
      subscriptionId = 'subscription-' + counter
      paymentId = 'pay-' + counter
      read.mockReset().mockImplementation(async () => remote())
      await scope.withPlatformTransaction(async (tx) => {
        await tx.organization.create({
          data: {
            id: tenantId,
            slug: tenantId,
            name: 'Synthetic subscriber',
            origin: 'ONBOARDING',
            ownerUserId: ownerId,
            access: 'SETUP',
            siteIndexable: false,
          },
        })
        await tx.membership.create({
          data: { tenantId, userId: ownerId, role: 'ADMIN', status: 'ACTIVE' },
        })
        await tx.subscription.create({
          data: {
            id: subscriptionId,
            tenantId,
            planVersionId: versionId,
            status: 'INCOMPLETE',
            createdAt: now,
            providerEnvironment: 'sandbox',
            providerCustomerId: 'customer-' + tenantId,
            providerSubscriptionId: 'provider-' + subscriptionId,
          },
        })
      })
    })
    afterAll(async () => {
      if (configured) {
        const runtime = getPlatformDatabaseRuntime()
        await runtime.prisma.$disconnect()
        await runtime.pool.end()
      }
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      for (const p of [platform, inspector, business]) await p?.$disconnect()
      for (const p of [platformPool, businessPool, db]) await p?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const name of [role, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + name + '"')
        await admin.end()
      }
    })
    it('confirms current facts, creates a monthly invoice and commits one state/access/history effect', async () => {
      const input = await receipt({ event: 'PAYMENT_OVERDUE' })
      const worker = consumer()
      await worker.handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      await worker.handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      expect(read).toHaveBeenCalledTimes(1)
      expect(await invoice()).toMatchObject({
        status: 'PAID',
        providerStatus: 'CONFIRMED',
        amount: new Prisma.Decimal('149.90'),
        periodStart: new Date('2026-10-03T00:00:00Z'),
        periodEnd: new Date('2026-11-02T00:00:00Z'),
      })
      expect(await subscription()).toMatchObject({
        status: 'ACTIVE',
        revision: 1,
        currentPeriodEnd: new Date('2026-11-02T00:00:00Z'),
      })
      expect(
        await inspector.organization.findUniqueOrThrow({
          where: { id: tenantId },
        })
      ).toMatchObject({ access: 'FULL', siteIndexable: true })
      expect(
        await inspector.subscriptionEvent.count({ where: { subscriptionId } })
      ).toBe(1)
      expect(
        await inspector.platformOutboxEvent.count({
          where: { aggregateId: subscriptionId, topic: 'subscriptions.notify' },
        })
      ).toBe(1)
      expect(
        await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: { id: input.row.id },
        })
      ).toMatchObject({
        status: 'PROCESSED',
        processingToken: null,
        lockedUntil: null,
      })
    })
    it.each([
      { amount: new Prisma.Decimal('149.91') },
      { customer: 'other-tenant' },
      { subscription: 'other-provider-sub' },
      { externalReference: 'sub:other' },
    ])(
      'mismatched provider binding or value is audited without an invoice/access change: %j',
      async (extra) => {
        read.mockResolvedValue(remote(extra))
        const input = await handle()
        expect(await invoice()).toBeNull()
        expect((await subscription()).status).toBe('INCOMPLETE')
        expect(
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).toMatchObject({
          status: 'IGNORED',
          lastError: 'INVOICE_RECONCILIATION_REQUIRED',
        })
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: input.row.id,
              reasonCategory: 'INVOICE_RECONCILIATION_REQUIRED',
            },
          })
        ).toBe(1)
      }
    )
    it('unknown provider statuses retain the raw code, do not grant access and remain auditable', async () => {
      read.mockResolvedValue(
        remote({
          providerStatus: 'NEW_STATE',
          status: 'PENDING',
          unknownStatus: true,
          paidAt: null,
        })
      )
      const input = await handle()
      expect((await invoice())?.status).toBe('PENDING')
      expect((await subscription()).status).toBe('INCOMPLETE')
      expect(
        (
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).lastError
      ).toBe('UNKNOWN_PROVIDER_STATUS')
    })
    it('a paid invoice cannot regress to overdue, pending or cancelled from a later event', async () => {
      await handle()
      for (const status of ['PENDING', 'OVERDUE', 'CANCELED'] as const) {
        read.mockResolvedValue(remote({ status, providerStatus: status }))
        await handle()
      }
      expect((await invoice())?.status).toBe('PAID')
      expect((await subscription()).status).toBe('ACTIVE')
      expect(
        await inspector.platformAuditLog.count({
          where: { tenantId, reasonCategory: 'INVOICE_STATUS_REGRESSION' },
        })
      ).toBe(3)
    })
    it('chargeback is debt, and a freshly confirmed reversal restores access', async () => {
      await handle()
      read.mockResolvedValue(
        remote({ status: 'CHARGEBACK', providerStatus: 'CHARGEBACK_DISPUTE' })
      )
      await handle()
      expect((await invoice())?.chargebackAt).toEqual(now)
      expect((await subscription()).status).toBe('PAST_DUE')
      read.mockResolvedValue(remote())
      await handle()
      expect((await subscription()).status).toBe('ACTIVE')
      expect((await invoice())?.status).toBe('PAID')
    })
    it('an unknown provider status cannot erase a confirmed chargeback debt', async () => {
      await handle()
      read.mockResolvedValue(
        remote({ status: 'CHARGEBACK', providerStatus: 'CHARGEBACK_DISPUTE' })
      )
      await handle()
      read.mockResolvedValue(
        remote({
          status: 'PENDING',
          providerStatus: 'NEW_STATE',
          unknownStatus: true,
          paidAt: null,
        })
      )
      const input = await handle()
      expect(await invoice()).toMatchObject({
        status: 'CHARGEBACK',
        providerStatus: 'NEW_STATE',
        chargebackAt: now,
      })
      expect((await subscription()).status).toBe('PAST_DUE')
      expect(
        await inspector.platformAuditLog.count({
          where: {
            targetId: input.row.id,
            reasonCategory: 'UNKNOWN_PROVIDER_STATUS',
          },
        })
      ).toBe(1)
    })
    it('an involuntary refund remains debt and cannot silently become paid again', async () => {
      await handle()
      read.mockResolvedValue(
        remote({ status: 'REFUNDED', providerStatus: 'REFUNDED' })
      )
      await handle()
      expect((await invoice())?.status).toBe('REFUNDED')
      read.mockResolvedValue(remote())
      await handle()
      expect((await invoice())?.status).toBe('REFUNDED')
    })
    it('the domain computes suspension from civil due dates and preserves an administrative hold', async () => {
      await inspector.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'TRIALING',
          trialEndsAt: new Date('2026-09-01T00:00:00Z'),
          createdAt: new Date('2026-08-20T00:00:00Z'),
        },
      })
      await scope.withPlatformTransaction((tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { status: 'SUSPENDED', adminHoldReason: 'SYNTHETIC_HOLD' },
        })
      )
      read.mockResolvedValue(
        remote({
          status: 'OVERDUE',
          providerStatus: 'OVERDUE',
          dueDate: '2026-09-10',
          paidAt: null,
        })
      )
      await handle()
      expect(await subscription()).toMatchObject({
        status: 'SUSPENDED',
        suspendedAt: now,
        pastDueSince: new Date('2026-09-02T00:00:00Z'),
      })
      expect(
        await inspector.organization.findUniqueOrThrow({
          where: { id: tenantId },
        })
      ).toMatchObject({
        status: 'SUSPENDED',
        access: 'RESTRICTED',
        adminHoldReason: 'SYNTHETIC_HOLD',
      })
    })
    it('cancellation at the paid period boundary is terminal and queues deactivation instead of provider DELETE', async () => {
      await inspector.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2026-10-02T00:00:00Z'),
          cancelAtPeriodEnd: true,
        },
      })
      await inspector.platformInvoice.create({
        data: {
          tenantId,
          subscriptionId,
          providerPaymentId: paymentId,
          amount: '149.90',
          dueDate: new Date('2026-09-03T00:00:00Z'),
          periodStart: new Date('2026-09-03T00:00:00Z'),
          periodEnd: new Date('2026-10-02T00:00:00Z'),
          status: 'PAID',
          syncedAt: now,
          paidAt: now,
        },
      })
      read.mockResolvedValue(remote({ dueDate: '2026-09-03' }))
      await handle()
      expect(await subscription()).toMatchObject({
        status: 'CANCELED',
        cancelReason: 'OWNER_REQUEST',
        canceledAt: now,
      })
      expect(
        (
          await inspector.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).access
      ).toBe('ARCHIVED')
      expect(
        await inspector.platformOutboxEvent.count({
          where: {
            aggregateId: subscriptionId,
            topic: 'subscriptions.provider-deactivate',
            status: 'PENDING',
          },
        })
      ).toBe(1)
    })
    it('late payment of an old cancelled subscription cannot overwrite a replacement subscription access', async () => {
      await inspector.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELED', canceledAt: now },
      })
      await inspector.subscription.create({
        data: {
          id: subscriptionId + '-new',
          tenantId,
          planVersionId: versionId,
          status: 'TRIALING',
          trialEndsAt: new Date('2026-10-10T00:00:00Z'),
        },
      })
      await scope.withPlatformTransaction((tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { access: 'FULL' },
        })
      )
      await handle()
      expect((await subscription()).status).toBe('CANCELED')
      expect(
        (
          await inspector.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).access
      ).toBe('FULL')
      expect(
        await inspector.subscriptionEvent.count({ where: { subscriptionId } })
      ).toBe(0)
    })
    it('provider failure releases the lease, redacts errors and retries the persisted receipt', async () => {
      const input = await receipt()
      const worker = consumer()
      read.mockRejectedValueOnce(new Error('private-root-key-provider-text'))
      await expect(
        worker.handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      ).rejects.toThrow('SUBSCRIPTION_INVOICE_UNAVAILABLE')
      expect(
        await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: { id: input.row.id },
        })
      ).toMatchObject({
        status: 'FAILED',
        lastError: 'SUBSCRIPTION_INVOICE_UNAVAILABLE',
        processingToken: null,
        lockedUntil: null,
      })
      await worker.handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      expect((await subscription()).status).toBe('ACTIVE')
    })
    it('a contradictory delivery during the read keeps conflict and suppresses the whole effect', async () => {
      const input = await receipt()
      read.mockImplementationOnce(async () => {
        const body = {
          ...input.body,
          payment: { ...input.body.payment, value: 1 },
        }
        await receive({ source: 'ASAAS_ROOT', body, payloadHash: hash(body) })
        return remote()
      })
      await consumer().handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      expect(await invoice()).toBeNull()
      expect((await subscription()).status).toBe('INCOMPLETE')
      expect(
        await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: { id: input.row.id },
        })
      ).toMatchObject({
        status: 'CONFLICT',
        processingToken: null,
        lockedUntil: null,
      })
    })
    it('a plan/binding revision during the provider read discards the old result', async () => {
      const input = await receipt()
      read.mockImplementationOnce(async () => {
        const previous = await subscription()
        await inspector.subscription.update({
          where: { id: subscriptionId },
          data: {
            revision: { increment: 1 },
            updatedAt: new Date(previous.updatedAt.getTime() + 1),
          },
        })
        return remote()
      })
      await expect(
        consumer().handlers[SUBSCRIPTION_INVOICE_TOPIC](input.message)
      ).rejects.toThrow('SUBSCRIPTION_INVOICE_UNAVAILABLE')
      expect(await invoice()).toBeNull()
    })
    it('history-write failure rolls back invoice, projection, notice and receipt completion together', async () => {
      await db.query(
        "CREATE FUNCTION fixture_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit unavailable'; END $$; CREATE TRIGGER fixture_fail_event BEFORE INSERT ON subscription_events FOR EACH ROW EXECUTE FUNCTION fixture_fail_event()"
      )
      try {
        await expect(handle()).rejects.toThrow(
          'SUBSCRIPTION_INVOICE_UNAVAILABLE'
        )
        expect(await invoice()).toBeNull()
        expect((await subscription()).status).toBe('INCOMPLETE')
        expect(
          (
            await inspector.organization.findUniqueOrThrow({
              where: { id: tenantId },
            })
          ).access
        ).toBe('SETUP')
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: subscriptionId },
          })
        ).toBe(0)
      } finally {
        await db.query(
          'DROP TRIGGER fixture_fail_event ON subscription_events; DROP FUNCTION fixture_fail_event()'
        )
      }
    })
    it('wrong tenant or source never invokes the root credential port and app role cannot write billing', async () => {
      const input = await receipt()
      await expect(
        consumer().handlers[SUBSCRIPTION_INVOICE_TOPIC]({
          ...input.message,
          tenantId: 'other',
        })
      ).rejects.toThrow('INVALID_SUBSCRIPTION_MESSAGE')
      const accountReceipt = await inspector.platformWebhookInbox.create({
        data: {
          source: 'ASAAS_ACCOUNT',
          tenantId,
          eventId: input.row.eventId,
          eventType: input.row.eventType,
          payload: input.body,
          payloadHash: input.row.payloadHash,
        },
      })
      await expect(
        consumer().handlers[SUBSCRIPTION_INVOICE_TOPIC]({
          ...input.message,
          aggregateId: accountReceipt.id,
          payload: { inboxId: accountReceipt.id },
        })
      ).rejects.toThrow('INVALID_SUBSCRIPTION_MESSAGE')
      expect(read).not.toHaveBeenCalled()
      const localInvoice = await scope.withPlatformTransaction((tx) =>
        tx.platformInvoice.create({
          data: {
            tenantId,
            subscriptionId,
            providerPaymentId: paymentId,
            amount: '149.90',
            dueDate: new Date('2026-10-03T00:00:00Z'),
            syncedAt: now,
          },
        })
      )
      // app_runtime reads its tenant's invoice projection, but cannot change billing.
      expect(await business.platformInvoice.findMany()).toEqual([])
      const visible = (selectedTenant: string) =>
        business.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.tenant_id',${selectedTenant},true)`
          return tx.platformInvoice.findMany({ where: { id: localInvoice.id } })
        })
      expect(await visible(tenantId)).toHaveLength(1)
      expect(await visible('other')).toEqual([])
      await expect(
        business.platformInvoice.update({
          where: { id: localInvoice.id },
          data: { status: 'PAID' },
        })
      ).rejects.toThrow()
      await expect(
        business.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'ACTIVE' },
        })
      ).rejects.toThrow()
    })
    it('legacy commercial payment jobs convert once without claiming subscription-notification topics', async () => {
      const input = await receipt()
      await inspector.platformOutboxEvent.update({
        where: { id: input.message.id },
        data: { topic: 'platform.webhook.process' },
      })
      const body = {
        id: 'future-subscription-' + counter,
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { id: 'provider-' + subscriptionId },
      }
      await receive({ source: 'ASAAS_ROOT', body, payloadHash: hash(body) })
      const worker = consumer()
      await worker.enqueue()
      await worker.enqueue()
      expect(
        (
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { id: input.message.id },
          })
        ).topic
      ).toBe(SUBSCRIPTION_INVOICE_TOPIC)
      const future = await inspector.platformWebhookInbox.findFirstOrThrow({
        where: { eventId: 'id:' + body.id },
      })
      expect(
        (
          await inspector.platformOutboxEvent.findFirstOrThrow({
            where: { aggregateId: future.id },
          })
        ).topic
      ).toBe('subscriptions.event.webhook')
    })
    it('the actual runtime and both cron adapters confirm invoices using only the root credential', async () => {
      // Drain pending earlier fixtures through the fake reader before testing real composition.
      const worker = consumer()
      await worker.enqueue()
      await createPlatformJobs({
        scope,
        handlers: worker.handlers,
        workerId: randomUUID,
        limit: 50,
        minRemainingMs: 0,
      })()
      // Older scenario subscriptions must not enter this runtime-composition scenario.
      await scope.withPlatformTransaction((tx) =>
        tx.subscription.updateMany({
          where: { id: { not: subscriptionId } },
          data: { providerNextAttemptAt: new Date('2099-01-01T00:00:00Z') },
        })
      )
      vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
      vi.stubEnv('PLATFORM_ASAAS_ENVIRONMENT', 'sandbox')
      vi.stubEnv('PLATFORM_ASAAS_ROOT_API_KEY', 'synthetic-root-only')
      vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'false')
      vi.stubEnv('PLATFORM_ASAAS_EGRESS_PROXY_URL', '')
      vi.stubEnv('PLATFORM_SECRETS_KEK_CURRENT', '')
      vi.stubEnv('PLATFORM_SECRETS_KMS_KEY_ARN', '')
      vi.stubEnv('PLATFORM_SELF_SERVICE_SIGNUP', 'off')
      vi.stubEnv(
        'LOCADORA_INTEGRATION_LOCAL_API_KEY',
        'synthetic-tenant-not-used'
      )
      const fetch = vi
        .fn()
        .mockImplementation(async (url: string, init: RequestInit) => {
          expect((init.headers as Record<string, string>).access_token).toBe(
            'synthetic-root-only'
          )
          expect(init.method).toBe('GET')
          const address = new URL(url)
          const id = address.pathname.split('/').at(-1)!
          if (address.pathname.includes('/subscriptions/'))
            return Response.json({
              id: 'provider-' + subscriptionId,
              customer: 'customer-' + tenantId,
              externalReference: 'sub:' + subscriptionId,
              status: 'ACTIVE',
              cycle: 'MONTHLY',
              value: 149.9,
              deleted: false,
            })
          const payment = {
            id: id === 'payments' ? paymentId : id,
            status: 'CONFIRMED',
            value: 149.9,
            customer: 'customer-' + tenantId,
            subscription: 'provider-' + subscriptionId,
            externalReference: 'sub:' + subscriptionId,
            dueDate: '2026-10-03',
            confirmedDate: '2026-10-03',
            deleted: false,
            billingType: 'PIX',
          }
          if (id === 'payments') {
            expect(address.searchParams.get('subscription')).toBe(
              'provider-' + subscriptionId
            )
            return Response.json({ hasMore: false, data: [payment] })
          }
          return Response.json(payment)
        })
      vi.stubGlobal('fetch', fetch)
      configured = true
      await receipt()
      expect((await runConfiguredPlatformJobs()).status).toBe(200)
      vi.stubEnv('CRON_SECRET', 'synthetic-invoice-cron')
      for (const handler of [legacyCron, apiCron]) {
        await receipt()
        expect(
          (
            await handler(
              new Request('http://localhost/api/cron/platform', {
                headers: { authorization: 'Bearer synthetic-invoice-cron' },
              })
            )
          ).status
        ).toBe(200)
      }
      expect(
        fetch.mock.calls.filter(([url]) =>
          new URL(url).pathname.endsWith('/payments/' + paymentId)
        )
      ).toHaveLength(3)
      expect(
        fetch.mock.calls.filter(([url]) =>
          new URL(url).pathname.includes('/subscriptions/')
        )
      ).toHaveLength(1)
      expect(
        fetch.mock.calls.filter(([url]) =>
          new URL(url).pathname.endsWith('/payments')
        )
      ).toHaveLength(1)
      expect((await subscription()).status).toBe('ACTIVE')
      const eventBody = {
        id: 'runtime-subscription-' + counter,
        event: 'SUBSCRIPTION_UPDATED',
        subscription: {
          id: 'provider-' + subscriptionId,
          externalReference: 'sub:' + subscriptionId,
          status: 'INACTIVE',
          value: 0,
        },
      }
      await receive({
        source: 'ASAAS_ROOT',
        body: eventBody,
        payloadHash: hash(eventBody),
      })
      expect((await runConfiguredPlatformJobs()).status).toBe(200)
      expect(fetch).toHaveBeenCalledTimes(7)
      const eventReceipt =
        await inspector.platformWebhookInbox.findFirstOrThrow({
          where: { eventId: 'id:' + eventBody.id },
        })
      expect(eventReceipt.status).toBe('PROCESSED')
      expect(
        (
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { dedupeKey: 'subscription-receipt:' + eventReceipt.id },
          })
        ).status
      ).toBe('COMPLETED')
      expect((await subscription()).status).toBe('ACTIVE')
      // No key: the invoice stays pending; the dispatcher never borrows a tenant credential.
      vi.stubEnv('PLATFORM_ASAAS_ROOT_API_KEY', '')
      const pending = await receipt()
      const result: ScheduledJobResult = await runConfiguredPlatformJobs()
      expect(result.status).toBe(200)
      expect(fetch).toHaveBeenCalledTimes(7)
      expect(
        (
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { id: pending.message.id },
          })
        ).status
      ).toBe('PENDING')
    })
  }
)
