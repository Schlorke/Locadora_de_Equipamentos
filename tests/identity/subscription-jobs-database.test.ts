import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { createLoginRole } from '../helpers/database-roles'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  createSubscriptionJobs,
  createSubscriptionEventConsumer,
  createSubscriptionInvoiceConsumer,
  SUBSCRIPTION_EVENT_TOPIC,
} from '../../packages/backend/src/modules/subscriptions/index'
import {
  createPlatformAsaasIngress,
  createPlatformAsaasRecovery,
} from '../../packages/backend/src/modules/platform-webhooks/index'
import {
  SUBSCRIPTION_RECONCILE_TOPIC,
  SUBSCRIPTION_DEACTIVATE_TOPIC,
} from '../../packages/backend/src/modules/subscriptions/topics'
type SubscriptionProvider = NonNullable<
  Parameters<typeof createSubscriptionJobs>[0]['provider']
>
import {
  enqueuePlatformOutbox,
  createPlatformOutboxRepository,
} from '../../packages/backend/src/modules/outbox/index'
import { createSubscriptionNotices } from '../../packages/backend/src/modules/subscriptions/notices'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import { runConfiguredPlatformJobs } from '../../packages/backend/src/runtime/platform-jobs'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import {
  BillingProviderError,
  type AsaasPlatformInvoice,
  type AsaasPlatformSubscription,
} from '@gb-locacoes/backend/billing'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'subscription reconciliation and deactivation with restricted PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'subscription_jobs_' + suffix + '_test',
      role = 'platform_' + suffix
    let admin: Pool,
      db: Pool,
      runtimePool: Pool,
      prisma: PrismaClient,
      inspector: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      owner: string,
      platformUrl: string,
      version: string
    let tenantId: string,
      id: string,
      paymentId: string,
      counter = 0,
      instant: Date,
      providerStatus: 'ACTIVE' | 'INACTIVE'
    const payments = new Map<string, AsaasPlatformInvoice>()
    const remote = (): AsaasPlatformSubscription => ({
      id: 'provider-' + id,
      customer: 'customer-' + tenantId,
      externalReference: 'sub:' + id,
      cycle: 'MONTHLY',
      status: providerStatus,
      amount: new Prisma.Decimal('149.90'),
    })
    const provider = {
      snapshot: vi.fn<SubscriptionProvider['snapshot']>(),
      subscription: vi.fn<SubscriptionProvider['subscription']>(),
      inactive: vi.fn<SubscriptionProvider['inactive']>(),
      invoice: vi.fn<SubscriptionProvider['invoice']>(),
      cancelInvoice: vi.fn<SubscriptionProvider['cancelInvoice']>(),
    }
    const worker = (enabled = true) =>
      createSubscriptionJobs({
        transaction: scope.withPlatformTransaction,
        now: () => instant,
        environment: 'sandbox',
        provider: enabled ? provider : undefined,
      })
    const sub = () =>
      inspector.subscription.findUniqueOrThrow({ where: { id } })
    const invoice = () =>
      inspector.platformInvoice.findUnique({
        where: { providerPaymentId: paymentId },
      })
    const message = (topic: string) =>
      scope.withPlatformTransaction(async (tx) => {
        const row = await enqueuePlatformOutbox(tx, {
          tenantId,
          topic,
          aggregateId: id,
          dedupeKey: topic + ':' + randomUUID(),
          payload: { subscriptionId: id },
        })
        return { ...row, lockedBy: 'fixture-worker' }
      })
    const run = async (topic = SUBSCRIPTION_RECONCILE_TOPIC) =>
      worker().handlers[topic]!(await message(topic))
    const cancel = async (reason = 'OWNER_REQUEST') =>
      scope.withPlatformTransaction((tx) =>
        tx.subscription.update({
          where: { id },
          data: {
            status: 'CANCELED',
            cancelReason: reason,
            canceledAt: instant,
            currentPeriodEnd: new Date('2026-10-02T00:00:00Z'),
          },
        })
      )
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
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8')
          .replaceAll('platform_runtime', role)
      )
      runtimePool = new Pool({ connectionString: platformUrl, max: 2 })
      prisma = new PrismaClient({ adapter: new PrismaPg(runtimePool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(prisma)
      owner = (
        await inspector.user.create({
          data: { email: suffix + '@example.invalid' },
        })
      ).id
      version = await scope.withPlatformTransaction(async (tx) => {
        const seed = await tx.planVersion.findFirstOrThrow()
        const plan = await tx.plan.create({
          data: { code: 'synthetic-jobs', name: 'Synthetic jobs plan' },
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
      instant = new Date('2026-10-03T16:00:00Z')
      providerStatus = 'ACTIVE'
      tenantId = 'jobs-tenant-' + ++counter
      id = 'jobs-sub-' + counter
      paymentId = 'jobs-payment-' + counter
      payments.clear()
      payments.set(paymentId, {
        id: paymentId,
        customer: 'customer-' + tenantId,
        subscription: 'provider-' + id,
        externalReference: 'sub:' + id,
        amount: new Prisma.Decimal('149.90'),
        status: 'PAID',
        providerStatus: 'CONFIRMED',
        unknownStatus: false,
        dueDate: '2026-10-03',
        billingType: 'PIX',
        paidAt: instant,
        invoiceUrl: null,
      })
      provider.snapshot.mockReset().mockImplementation(async () => ({
        subscription: remote(),
        invoices: [...payments.values()],
      }))
      provider.subscription.mockReset().mockImplementation(async () => remote())
      provider.inactive.mockReset().mockImplementation(async () => {
        providerStatus = 'INACTIVE'
      })
      provider.invoice
        .mockReset()
        .mockImplementation(async (payment) => ({ ...payments.get(payment)! }))
      provider.cancelInvoice.mockReset().mockImplementation(async (payment) => {
        payments.set(payment, {
          ...payments.get(payment)!,
          status: 'CANCELED',
          providerStatus: 'PENDING',
        })
      })
      await scope.withPlatformTransaction(async (tx) => {
        await tx.organization.create({
          data: {
            id: tenantId,
            slug: tenantId,
            name: 'Synthetic jobs subscriber',
            origin: 'ONBOARDING',
            ownerUserId: owner,
            siteIndexable: false,
          },
        })
        await tx.membership.create({
          data: { tenantId, userId: owner, role: 'ADMIN', status: 'ACTIVE' },
        })
        await tx.subscription.create({
          data: {
            id,
            tenantId,
            planVersionId: version,
            status: 'INCOMPLETE',
            createdAt: instant,
            providerEnvironment: 'sandbox',
            providerCustomerId: 'customer-' + tenantId,
            providerSubscriptionId: 'provider-' + id,
            providerNextAttemptAt: new Date('2026-01-01T00:00:00Z'),
          },
        })
      })
    })
    afterAll(async () => {
      for (const client of [prisma, inspector]) await client?.$disconnect()
      for (const pool of [runtimePool, db]) await pool?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        await admin.query('DROP ROLE IF EXISTS "' + role + '"')
        await admin.end()
      }
    })
    it('recovers a lost payment webhook and projects invoice/history/access together', async () => {
      await run()
      expect((await invoice())?.status).toBe('PAID')
      expect((await sub()).status).toBe('ACTIVE')
      expect(
        (
          await inspector.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).access
      ).toBe('FULL')
      expect(
        await inspector.subscriptionEvent.findFirst({
          where: { subscriptionId: id },
        })
      ).toMatchObject({ source: 'JOB', toStatus: 'ACTIVE' })
      await run()
      expect(
        await inspector.subscriptionEvent.count({
          where: { subscriptionId: id },
        })
      ).toBe(1)
    })
    it.each([
      { amount: new Prisma.Decimal('150.00') },
      { customer: 'other' },
      { status: 'INACTIVE' as const },
    ])(
      'audits provider divergence without changing access or silently repairing it: %j',
      async (extra) => {
        provider.snapshot.mockResolvedValue({
          subscription: { ...remote(), ...extra },
          invoices: [...payments.values()],
        })
        await run()
        expect(await invoice()).toBeNull()
        expect((await sub()).status).toBe('INCOMPLETE')
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: id,
              reasonCategory: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
            },
          })
        ).toBe(1)
        expect(provider.inactive).not.toHaveBeenCalled()
      }
    )
    it('reconciles UNKNOWN by its own reference, binds the found resource and never creates again', async () => {
      await scope.withPlatformTransaction((tx) =>
        tx.subscription.update({
          where: { id },
          data: { providerSubscriptionId: null, providerSync: 'UNKNOWN' },
        })
      )
      await run()
      expect(provider.snapshot).toHaveBeenCalledWith({
        id: null,
        reference: 'sub:' + id,
        knownPaymentIds: [],
      })
      expect(await sub()).toMatchObject({
        providerSubscriptionId: 'provider-' + id,
        providerSync: 'SYNCED',
        status: 'ACTIVE',
      })
    })
    it('an absent UNKNOWN match stays unknown without changing access or issuing a write', async () => {
      await scope.withPlatformTransaction((tx) =>
        tx.subscription.update({
          where: { id },
          data: { providerSubscriptionId: null, providerSync: 'UNKNOWN' },
        })
      )
      provider.snapshot.mockResolvedValue({ subscription: null, invoices: [] })
      await run()
      expect(await sub()).toMatchObject({
        providerSubscriptionId: null,
        providerSync: 'UNKNOWN',
        status: 'INCOMPLETE',
        providerLastError: 'SUBSCRIPTION_UNKNOWN_NOT_FOUND',
      })
      expect(provider.inactive).not.toHaveBeenCalled()
      expect(provider.cancelInvoice).not.toHaveBeenCalled()
    })
    it('time alone advances local trial state without a root credential or provider request', async () => {
      await scope.withPlatformTransaction((tx) =>
        tx.subscription.update({
          where: { id },
          data: {
            providerSubscriptionId: null,
            status: 'TRIALING',
            trialEndsAt: new Date('2026-08-20T00:00:00Z'),
            createdAt: new Date('2026-08-01T00:00:00Z'),
          },
        })
      )
      await worker(false).handlers[SUBSCRIPTION_RECONCILE_TOPIC]!(
        await message(SUBSCRIPTION_RECONCILE_TOPIC)
      )
      expect((await sub()).status).toBe('CANCELED')
      expect((await sub()).cancelReason).toBe('TRIAL_EXPIRED')
      expect(provider.snapshot).not.toHaveBeenCalled()
      expect(
        await inspector.platformOutboxEvent.count({
          where: { aggregateId: id, topic: SUBSCRIPTION_DEACTIVATE_TOPIC },
        })
      ).toBe(0)
    })
    it('paid facts from a concurrently changed binding are not applied', async () => {
      provider.snapshot.mockImplementation(async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.update({
            where: { id },
            data: { revision: { increment: 1 } },
          })
        )
        return { subscription: remote(), invoices: [...payments.values()] }
      })
      await expect(run()).rejects.toThrow('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
      expect(await invoice()).toBeNull()
      expect((await sub()).status).toBe('INCOMPLETE')
    })
    it('all invoice bindings are validated before committing any payment fact', async () => {
      payments.set('wrong', {
        ...payments.get(paymentId)!,
        id: 'wrong',
        customer: 'other',
      })
      await expect(run()).rejects.toThrow('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
      expect(await invoice()).toBeNull()
      expect((await sub()).status).toBe('INCOMPLETE')
    })
    it('a rate limit persists backoff, redacts provider details and avoids another request', async () => {
      provider.snapshot.mockRejectedValue(
        new BillingProviderError('UNAVAILABLE', {
          reason: 'RATE_LIMITED',
          retryAfterSeconds: 7200,
        })
      )
      await expect(run()).rejects.toThrow('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
      expect((await sub()).providerNextAttemptAt).toEqual(
        new Date('2026-10-03T18:00:00Z')
      )
      await expect(run()).rejects.toThrow('SUBSCRIPTION_PROVIDER_BACKOFF')
      expect(provider.snapshot).toHaveBeenCalledTimes(1)
    })
    it('owner cancellation inactivates recurrence and only removes eligible unpaid future invoices', async () => {
      const original = payments.get(paymentId)!
      payments.set(paymentId, {
        ...original,
        status: 'PENDING',
        providerStatus: 'PENDING',
        paidAt: null,
      })
      payments.set('past-overdue', {
        ...original,
        id: 'past-overdue',
        status: 'OVERDUE',
        providerStatus: 'OVERDUE',
        dueDate: '2026-09-01',
        paidAt: null,
      })
      payments.set('paid-future', {
        ...original,
        id: 'paid-future',
        dueDate: '2026-11-03',
      })
      await cancel()
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect(provider.inactive).toHaveBeenCalledWith('provider-' + id)
      expect(provider.cancelInvoice).toHaveBeenCalledTimes(1)
      expect(provider.cancelInvoice).toHaveBeenCalledWith(paymentId)
      expect(await invoice()).toMatchObject({
        status: 'CANCELED',
        canceledReason: 'FUTURE_AFTER_CANCEL',
        providerCancelState: 'CONFIRMED',
      })
      expect((await sub()).status).toBe('CANCELED')
    })
    it('non-payment termination preserves unpaid/overdue invoices and only inactivates recurrence', async () => {
      await cancel('NON_PAYMENT')
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect(provider.inactive).toHaveBeenCalledTimes(1)
      expect(provider.cancelInvoice).not.toHaveBeenCalled()
      expect(provider.snapshot).not.toHaveBeenCalled()
    })
    it('a timeout after INACTIVE is confirmed with a read and is not mistaken for failed cancellation', async () => {
      provider.inactive.mockImplementation(async () => {
        providerStatus = 'INACTIVE'
        throw new BillingProviderError('AMBIGUOUS', {
          maybeApplied: true,
          reason: 'TIMEOUT',
        })
      })
      await cancel('NON_PAYMENT')
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect(provider.subscription).toHaveBeenCalledTimes(2)
      expect(
        await inspector.platformAuditLog.count({
          where: { targetId: id, action: 'subscription.provider.deactivated' },
        })
      ).toBe(1)
    })
    it('an uncertain payment DELETE is reconciled on retry without sending it twice', async () => {
      payments.set(paymentId, {
        ...payments.get(paymentId)!,
        status: 'PENDING',
        providerStatus: 'PENDING',
        paidAt: null,
      })
      provider.cancelInvoice.mockRejectedValue(
        new BillingProviderError('AMBIGUOUS', {
          maybeApplied: true,
          reason: 'NETWORK',
        })
      )
      await cancel()
      await expect(run(SUBSCRIPTION_DEACTIVATE_TOPIC)).rejects.toThrow(
        'SUBSCRIPTION_PROVIDER_UNAVAILABLE'
      )
      expect((await invoice())?.providerCancelState).toBe('UNKNOWN')
      instant = new Date('2026-10-03T16:06:00Z')
      await expect(run(SUBSCRIPTION_DEACTIVATE_TOPIC)).rejects.toThrow(
        'SUBSCRIPTION_PROVIDER_UNAVAILABLE'
      )
      expect(provider.cancelInvoice).toHaveBeenCalledTimes(1)
      payments.set(paymentId, {
        ...payments.get(paymentId)!,
        status: 'CANCELED',
      })
      instant = new Date('2026-10-03T16:12:00Z')
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect((await invoice())?.providerCancelState).toBe('CONFIRMED')
      expect(provider.cancelInvoice).toHaveBeenCalledTimes(1)
    })
    it('a crash after reserving the DELETE never allows a blind second DELETE', async () => {
      payments.set(paymentId, {
        ...payments.get(paymentId)!,
        status: 'PENDING',
        providerStatus: 'PENDING',
        paidAt: null,
      })
      await scope.withPlatformTransaction((tx) =>
        tx.platformInvoice.create({
          data: {
            tenantId,
            subscriptionId: id,
            providerPaymentId: paymentId,
            amount: '149.90',
            dueDate: new Date('2026-10-03T00:00:00Z'),
            syncedAt: instant,
            providerCancelState: 'PROCESSING',
          },
        })
      )
      await cancel()
      await expect(run(SUBSCRIPTION_DEACTIVATE_TOPIC)).rejects.toThrow(
        'SUBSCRIPTION_PROVIDER_UNAVAILABLE'
      )
      expect(provider.cancelInvoice).not.toHaveBeenCalled()
    })
    it('404 after a payment DELETE is not proof of cancellation', async () => {
      payments.set(paymentId, {
        ...payments.get(paymentId)!,
        status: 'PENDING',
        providerStatus: 'PENDING',
        paidAt: null,
      })
      provider.invoice
        .mockResolvedValueOnce({ ...payments.get(paymentId)! })
        .mockRejectedValue(
          new BillingProviderError('REJECTED', {
            reason: 'NOT_FOUND',
            status: 404,
          })
        )
      await cancel()
      await expect(run(SUBSCRIPTION_DEACTIVATE_TOPIC)).rejects.toThrow(
        'SUBSCRIPTION_PROVIDER_UNAVAILABLE'
      )
      expect((await invoice())?.providerCancelState).toBe('PROCESSING')
      expect((await invoice())?.status).toBe('PENDING')
    })
    it('a payment confirmed between listing and cancellation is preserved and audited', async () => {
      const paid = { ...payments.get(paymentId)! }
      provider.snapshot.mockImplementation(async () => ({
        subscription: remote(),
        invoices: [{ ...paid, status: 'PENDING', paidAt: null }],
      }))
      provider.invoice.mockResolvedValue(paid)
      await cancel()
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect(provider.cancelInvoice).not.toHaveBeenCalled()
      expect((await invoice())?.status).toBe('PAID')
      expect(
        await inspector.platformAuditLog.count({
          where: {
            targetId: id,
            reasonCategory: 'PAID_AFTER_SUBSCRIPTION_CANCEL',
          },
        })
      ).toBe(1)
    })
    it('wrong tenant never calls a provider port', async () => {
      const input = await message(SUBSCRIPTION_RECONCILE_TOPIC)
      await expect(
        worker().handlers[SUBSCRIPTION_RECONCILE_TOPIC]!({
          ...input,
          tenantId: 'other',
        })
      ).rejects.toThrow('INVALID_SUBSCRIPTION_JOB')
      expect(provider.snapshot).not.toHaveBeenCalled()
    })
    it('enqueue is bounded, deduplicated and missing root configuration cannot claim external work', async () => {
      await worker(false).enqueue()
      expect(
        await inspector.platformOutboxEvent.count({
          where: { aggregateId: id, topic: SUBSCRIPTION_RECONCILE_TOPIC },
        })
      ).toBe(0)
      await worker().enqueue()
      await worker().enqueue()
      expect(
        await inspector.platformOutboxEvent.count({
          where: {
            aggregateId: id,
            topic: SUBSCRIPTION_RECONCILE_TOPIC,
            status: 'PENDING',
          },
        })
      ).toBe(1)
      expect(Object.keys(worker(false).handlers)).not.toContain(
        SUBSCRIPTION_DEACTIVATE_TOPIC
      )
    })
    it('a bounded backlog processes the oldest twenty while retaining the rest', async () => {
      await scope.withPlatformTransaction(async (tx) => {
        await tx.subscription.updateMany({
          data: { providerNextAttemptAt: new Date('2099-01-01T00:00:00Z') },
        })
        for (let index = 0; index < 23; index++) {
          const tenant = 'jobs-backlog-' + index
          await tx.organization.create({
            data: {
              id: tenant,
              slug: tenant,
              name: 'Synthetic backlog',
              origin: 'ONBOARDING',
              ownerUserId: owner,
            },
          })
          await tx.membership.create({
            data: {
              tenantId: tenant,
              userId: owner,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          })
          await tx.subscription.create({
            data: {
              id: 'backlog-' + String(index).padStart(2, '0'),
              status: 'INCOMPLETE',
              tenantId: tenant,
              planVersionId: version,
              providerSubscriptionId: 'backlog-provider-' + index,
              providerCustomerId: 'backlog-customer-' + index,
              providerEnvironment: 'sandbox',
              providerNextAttemptAt: instant,
              reconciledAt: new Date(instant.getTime() - (23 - index) * 1000),
            },
          })
        }
      })
      await worker().enqueue()
      expect(
        (
          await inspector.platformOutboxEvent.findMany({
            where: {
              aggregateId: { startsWith: 'backlog-' },
              topic: SUBSCRIPTION_RECONCILE_TOPIC,
            },
            orderBy: { aggregateId: 'asc' },
          })
        ).map((event) => event.aggregateId)
      ).toEqual(
        Array.from(
          { length: 20 },
          (_, index) => 'backlog-' + String(index).padStart(2, '0')
        )
      )
      await worker().enqueue()
      expect(
        await inspector.platformOutboxEvent.count({
          where: {
            aggregateId: { startsWith: 'backlog-' },
            topic: SUBSCRIPTION_RECONCILE_TOPIC,
          },
        })
      ).toBe(23)
    })
    it('a proven rejected DELETE clears intent for a later safe retry and the database rejects invalid states', async () => {
      payments.set(paymentId, {
        ...payments.get(paymentId)!,
        status: 'PENDING',
        providerStatus: 'PENDING',
        paidAt: null,
      })
      provider.cancelInvoice.mockRejectedValueOnce(
        new BillingProviderError('REJECTED', {
          maybeApplied: false,
          status: 429,
          reason: 'RATE_LIMITED',
          retryAfterSeconds: 600,
        })
      )
      await cancel()
      await expect(run(SUBSCRIPTION_DEACTIVATE_TOPIC)).rejects.toThrow(
        'SUBSCRIPTION_PROVIDER_UNAVAILABLE'
      )
      expect((await invoice())?.providerCancelState).toBe('NONE')
      await expect(
        scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.update({
            where: { providerPaymentId: paymentId },
            data: { providerCancelState: 'INVALID' },
          })
        )
      ).rejects.toThrow()
      instant = new Date('2026-10-03T16:11:00Z')
      await run(SUBSCRIPTION_DEACTIVATE_TOPIC)
      expect((await invoice())?.providerCancelState).toBe('CONFIRMED')
      expect(provider.cancelInvoice).toHaveBeenCalledTimes(2)
    })
    describe('durable commercial notifications', () => {
      const NOTIFY = 'subscriptions.notify',
        MAIL = 'subscriptions.mail',
        SCAN = 'subscriptions.dunning'
      const send = vi.fn<
        (
          _mail: {
            to: string
            from: string
            subject: string
            html: string
            text: string
          },
          _key: string
        ) => Promise<void>
      >()
      const notices = (from = 'Platform <platform@example.invalid>') =>
        createSubscriptionNotices({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          panelUrl: 'https://app.example.com/admin',
          from,
          send,
          now: () => instant,
        })
      const repository = () =>
        createPlatformOutboxRepository(scope.withPlatformTransaction, [MAIL])
      const queued = () =>
        inspector.platformOutboxEvent.findMany({
          where: { aggregateId: id, topic: MAIL },
        })
      const transition = () =>
        scope.withPlatformTransaction(async (tx) => {
          await tx.subscription.update({
            where: { id },
            data: { status: 'ACTIVE' },
          })
          const event = await tx.subscriptionEvent.create({
            data: {
              subscriptionId: id,
              tenantId,
              fromStatus: 'INCOMPLETE',
              toStatus: 'ACTIVE',
              reason: 'INVOICE_PAID',
              source: 'WEBHOOK',
              dedupeKey: randomUUID(),
              occurredAt: instant,
            },
          })
          const row = await enqueuePlatformOutbox(tx, {
            topic: NOTIFY,
            aggregateId: id,
            tenantId,
            dedupeKey: 'subscription-notice:' + event.id,
            payload: { subscriptionEventId: event.id },
            availableAt: instant,
          })
          return { ...row, lockedBy: 'coordinator' }
        })
      const prepare = async () => {
        const parent = await transition()
        await notices().handlers[NOTIFY](parent)
        const job = await repository().claim('notice-worker', instant, 300_000)
        expect(job).not.toBeNull()
        return job!
      }
      const reminder = async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.create({
            data: {
              tenantId,
              subscriptionId: id,
              providerPaymentId: paymentId,
              amount: '149.90',
              dueDate: new Date('2026-10-03T00:00:00Z'),
              status: 'PENDING',
              invoiceUrl: 'https://sandbox.asaas.com/i/fixture',
              syncedAt: instant,
            },
          })
        )
        const row = await scope.withPlatformTransaction((tx) =>
          enqueuePlatformOutbox(tx, {
            tenantId,
            aggregateId: id,
            topic: SCAN,
            dedupeKey: 'fixture-scan:' + id,
            payload: { subscriptionId: id, day: '2026-10-03' },
            availableAt: instant,
          })
        )
        const message = { ...row, lockedBy: 'coordinator' }
        await notices().handlers[SCAN](message)
        const parent = await inspector.platformOutboxEvent.findFirstOrThrow({
          where: { aggregateId: id, topic: NOTIFY },
        })
        await notices().handlers[NOTIFY]({ ...parent, lockedBy: 'coordinator' })
        const job = await repository().claim('notice-worker', instant, 300_000)
        expect(job).not.toBeNull()
        return { job: job!, scan: message }
      }
      beforeEach(async () => {
        send.mockReset().mockResolvedValue()
        await inspector.platformOutboxEvent.updateMany({
          where: { topic: { in: [NOTIFY, MAIL, SCAN] } },
          data: {
            availableAt: new Date('2099-01-01'),
            lockedUntil: new Date('2099-01-01'),
          },
        })
      })
      it('fans out once to distinct current contacts and finance members, with no global-role or sibling recipients', async () => {
        const ownerEmail = (
          await inspector.user.findUniqueOrThrow({ where: { id: owner } })
        ).email!
        await scope.withPlatformTransaction(async (tx) => {
          await tx.subscription.update({
            where: { id },
            data: { billingEmail: ownerEmail.toUpperCase() },
          })
          await tx.organization.update({
            where: { id: tenantId },
            data: { billingEmail: 'billing@example.invalid' },
          })
        })
        const finance = await inspector.user.create({
          data: {
            email: 'finance-' + counter + '@example.invalid',
            role: 'CLIENT',
          },
        })
        const excluded = await inspector.user.create({
          data: {
            email: 'excluded-' + counter + '@example.invalid',
            role: 'FINANCIAL',
          },
        })
        await scope.withPlatformTransaction(async (tx) => {
          await tx.membership.create({
            data: { tenantId, userId: finance.id, role: 'FINANCIAL' },
          })
          await tx.membership.create({
            data: { tenantId, userId: excluded.id, role: 'CLIENT' },
          })
          await tx.organization.create({
            data: {
              id: 'mail-sibling-' + counter,
              slug: 'mail-sibling-' + counter,
              name: 'Sibling',
            },
          })
          await tx.membership.create({
            data: {
              tenantId: 'mail-sibling-' + counter,
              userId: excluded.id,
              role: 'FINANCIAL',
            },
          })
        })
        const parent = await transition()
        await Promise.all(
          Array.from({ length: 6 }, () => notices().handlers[NOTIFY](parent))
        )
        expect(await queued()).toHaveLength(3)
        for (let n = 0; n < 3; n++) {
          const job = await repository().claim(
            'notice-worker',
            instant,
            300_000
          )
          await notices().handlers[MAIL](job!)
          await repository().complete(job!, instant)
        }
        expect(send.mock.calls.map(([mail]) => mail.to).sort()).toEqual(
          [ownerEmail, finance.email!, 'billing@example.invalid'].sort()
        )
        expect(
          send.mock.calls.every(([mail]) => typeof mail.to === 'string')
        ).toBe(true)
      })
      it('revalidates removed financial membership before sending', async () => {
        const finance = await inspector.user.create({
          data: { email: 'removed-' + counter + '@example.invalid' },
        })
        const membership = await scope.withPlatformTransaction((tx) =>
          tx.membership.create({
            data: { tenantId, userId: finance.id, role: 'FINANCIAL' },
          })
        )
        await notices().handlers[NOTIFY](await transition())
        await scope.withPlatformTransaction((tx) =>
          tx.membership.update({
            where: { id: membership.id },
            data: { status: 'REVOKED' },
          })
        )
        for (let n = 0; n < 2; n++) {
          const job = await repository().claim(
            'notice-worker',
            instant,
            300_000
          )
          await notices().handlers[MAIL](job!)
          await repository().complete(job!, instant)
        }
        expect(send).toHaveBeenCalledTimes(1)
        expect(send.mock.calls[0]![0].to).not.toBe(finance.email)
      })
      it('suppresses an obsolete transition after the subscription changes again', async () => {
        const parent = await transition()
        await scope.withPlatformTransaction(async (tx) => {
          await tx.subscription.update({
            where: { id },
            data: { status: 'SUSPENDED' },
          })
          await tx.subscriptionEvent.create({
            data: {
              subscriptionId: id,
              tenantId,
              fromStatus: 'ACTIVE',
              toStatus: 'SUSPENDED',
              reason: 'GRACE_ELAPSED',
              source: 'JOB',
              dedupeKey: randomUUID(),
              occurredAt: new Date(instant.getTime() + 1),
            },
          })
        })
        await notices().handlers[NOTIFY](parent)
        expect(await queued()).toEqual([])
      })
      it('rejects a different tenant or environment before producing a mail job', async () => {
        const parent = await transition()
        await expect(
          notices().handlers[NOTIFY]({ ...parent, tenantId: 'other' })
        ).rejects.toThrow('INVALID_SUBSCRIPTION_NOTICE')
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.update({
            where: { id },
            data: { providerEnvironment: 'production' },
          })
        )
        await expect(notices().handlers[NOTIFY](parent)).rejects.toThrow(
          'INVALID_SUBSCRIPTION_NOTICE'
        )
        expect(await queued()).toEqual([])
      })
      it('reminds once per invoice step, without sending when the invoice is paid before delivery', async () => {
        const { job, scan } = await reminder()
        await notices().handlers[SCAN](scan)
        expect(await queued()).toHaveLength(1)
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.update({
            where: { providerPaymentId: paymentId },
            data: { status: 'PAID', paidAt: instant },
          })
        )
        await notices().handlers[MAIL](job)
        expect(send).not.toHaveBeenCalled()
      })
      it('uses the current hosted invoice link and never calls a billing/provider mutation', async () => {
        const { job } = await reminder()
        await notices().handlers[MAIL](job)
        expect(send.mock.calls[0]![0]).toMatchObject({
          subject: expect.stringContaining('vence hoje'),
          text: expect.stringContaining('149,90'),
        })
        expect(send.mock.calls[0]![0].html).toContain(
          'https://sandbox.asaas.com/i/fixture'
        )
        expect(provider.inactive).not.toHaveBeenCalled()
        expect(provider.cancelInvoice).not.toHaveBeenCalled()
      })
      it('keeps exactly the first envelope/key after an uncertain timeout and a sender configuration change', async () => {
        const job = await prepare()
        send.mockRejectedValueOnce(
          new Error('provider secret and private recipient must not escape')
        )
        await expect(notices().handlers[MAIL](job)).rejects.toThrow(
          'PLATFORM_MAIL_DELIVERY_FAILED'
        )
        const first = send.mock.calls[0]!
        await repository().fail(job, 'DELIVERY_FAILED', instant, false)
        const retry = await repository().claim('retry-worker', instant, 300_000)
        await notices('Changed <changed@example.invalid>').handlers[MAIL](
          retry!
        )
        expect(send.mock.calls[1]).toEqual(first)
        expect(
          (
            await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: job.id },
            })
          ).payload
        ).toMatchObject({
          firstAttemptAt: instant.toISOString(),
          envelope: { to: first[0].to, from: first[0].from },
        })
      })
      it('does not blindly repeat an uncertain send after the idempotency window', async () => {
        const job = await prepare()
        send.mockRejectedValueOnce(new Error('timeout'))
        await expect(notices().handlers[MAIL](job)).rejects.toThrow()
        await repository().fail(job, 'DELIVERY_FAILED', instant, false)
        instant = new Date(instant.getTime() + 23 * 60 * 60_000)
        const retry = await repository().claim('retry-worker', instant, 300_000)
        await expect(notices().handlers[MAIL](retry!)).rejects.toThrow(
          'SUBSCRIPTION_MAIL_RECONCILIATION_REQUIRED'
        )
        expect(send).toHaveBeenCalledTimes(1)
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: job.id,
              reasonCategory: 'IDEMPOTENCY_WINDOW_EXPIRED',
            },
          })
        ).toBe(1)
      })
      it('does not send when a current contact changes between fan-out and delivery', async () => {
        const job = await prepare()
        await inspector.user.update({
          where: { id: owner },
          data: { email: 'changed-' + counter + '@example.invalid' },
        })
        await notices().handlers[MAIL](job)
        expect(send).not.toHaveBeenCalled()
      })
      it('preserves lease fencing and prevents a stale worker from sending', async () => {
        const job = await prepare()
        await expect(
          notices().handlers[MAIL]({ ...job, attempts: job.attempts - 1 })
        ).rejects.toThrow('SUBSCRIPTION_MAIL_LEASE_LOST')
        expect(send).not.toHaveBeenCalled()
      })
      it('rolls back all recipient jobs if the coordinator transaction fails', async () => {
        const parent = await transition()
        await db.query(`CREATE FUNCTION notice_fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.topic='subscriptions.mail' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER notice_fixture_fail BEFORE INSERT ON platform_outbox_events FOR EACH ROW EXECUTE FUNCTION notice_fixture_fail();`)
        try {
          await expect(notices().handlers[NOTIFY](parent)).rejects.toThrow()
          expect(await queued()).toEqual([])
        } finally {
          await db.query(
            'DROP TRIGGER notice_fixture_fail ON platform_outbox_events; DROP FUNCTION notice_fixture_fail()'
          )
        }
        await notices().handlers[NOTIFY](parent)
        expect(await queued()).toHaveLength(1)
      })
      it('expires historical reminder scans instead of flooding users with missed days', async () => {
        const { scan } = await reminder()
        instant = new Date('2026-10-04T16:00:00Z')
        const prior = await queued()
        await notices().handlers[SCAN](scan)
        expect(await queued()).toHaveLength(prior.length)
      })
      it('bounds the fair scan batch at twenty and uses durable keys on repeat', async () => {
        const backlog = Array.from(
          { length: 21 },
          (_, index) => `notice-backlog-${counter}-${index}`
        )
        await scope.withPlatformTransaction(async (tx) => {
          await tx.subscription.update({
            where: { id },
            data: { status: 'ACTIVE' },
          })
          for (const fixture of backlog) {
            await tx.organization.create({
              data: {
                id: fixture,
                slug: fixture,
                name: 'Synthetic notification backlog',
                origin: 'ONBOARDING',
                ownerUserId: owner,
              },
            })
            await tx.membership.create({
              data: {
                tenantId: fixture,
                userId: owner,
                role: 'ADMIN',
                status: 'ACTIVE',
              },
            })
            await tx.subscription.create({
              data: {
                id: fixture,
                tenantId: fixture,
                planVersionId: version,
                status: 'ACTIVE',
                providerEnvironment: 'sandbox',
              },
            })
          }
        })
        const count = () =>
          inspector.platformOutboxEvent.count({
            where: {
              topic: SCAN,
              payload: { path: ['day'], equals: '2026-10-03' },
            },
          })
        const before = await count()
        await notices().enqueue()
        const after = await count()
        expect(after - before).toBe(20)
        await Promise.all(Array.from({ length: 3 }, () => notices().enqueue()))
        expect(
          await inspector.platformOutboxEvent.count({
            where: { topic: SCAN, aggregateId: { in: backlog } },
          })
        ).toBe(21)
        const settled = await count()
        await notices().enqueue()
        expect(await count()).toBe(settled)
      })
      it('uses the shared dispatcher and only acknowledges provider success', async () => {
        const parent = await transition()
        const run = createPlatformJobs({
          scope,
          handlers: notices().handlers,
          workerId: () => 'dispatcher',
          now: () => instant,
          limit: 3,
          minRemainingMs: 0,
        })
        expect((await run()).completed).toBe(2)
        expect(send).toHaveBeenCalledTimes(1)
        expect(
          (
            await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: parent.id },
            })
          ).status
        ).toBe('COMPLETED')
        expect((await queued())[0]?.status).toBe('COMPLETED')
      })
      it('composes the real runtime through existing mail configuration and keeps missing transport pending', async () => {
        const parent = await transition()
        // Hide unrelated older fixture work; only this subscription's notice is live.
        await inspector.platformOutboxEvent.updateMany({
          where: { id: { not: parent.id } },
          data: {
            availableAt: new Date('2099-01-01'),
            lockedUntil: new Date('2099-01-01'),
          },
        })
        await inspector.subscription.updateMany({
          where: { id: { not: id } },
          data: { providerNextAttemptAt: new Date('2099-01-01') },
        })
        const fetch = vi
          .fn<typeof globalThis.fetch>()
          .mockImplementation(async (url) => {
            if (String(url) !== 'https://api.resend.com/emails')
              throw new Error('unexpected external request')
            return Response.json({ id: 'fixture-runtime-mail' })
          })
        vi.stubGlobal('fetch', fetch)
        vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
        vi.stubEnv('PLATFORM_ENV', 'staging')
        vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'example.com')
        vi.stubEnv('PLATFORM_ASAAS_ENVIRONMENT', 'sandbox')
        vi.stubEnv('PLATFORM_ASAAS_ROOT_API_KEY', '')
        vi.stubEnv('RESEND_API_KEY', '')
        vi.stubEnv('FROM_EMAIL', 'Platform <platform@example.invalid>')
        vi.stubEnv('PLATFORM_KMS_PROVIDER', '')
        vi.stubEnv('PLATFORM_KMS_LOCAL_KEY', '')
        let runtime: ReturnType<typeof getPlatformDatabaseRuntime> | undefined
        try {
          expect((await runConfiguredPlatformJobs()).status).toBe(200)
          runtime = getPlatformDatabaseRuntime()
          expect(
            (
              await inspector.platformOutboxEvent.findUniqueOrThrow({
                where: { id: parent.id },
              })
            ).status
          ).toBe('PENDING')
          expect(fetch).not.toHaveBeenCalled()
          vi.stubEnv('RESEND_API_KEY', 'synthetic-test-key')
          expect((await runConfiguredPlatformJobs()).status).toBe(200)
          expect(
            (
              await inspector.platformOutboxEvent.findUniqueOrThrow({
                where: { id: parent.id },
              })
            ).status
          ).toBe('COMPLETED')
          expect(fetch).toHaveBeenCalledTimes(1)
          const input = fetch.mock.calls[0]![1] as RequestInit
          const body = JSON.parse(input.body as string)
          expect(body.to).toBe(
            (await inspector.user.findUniqueOrThrow({ where: { id: owner } }))
              .email
          )
          expect(body.html).toContain('https://app.example.com/admin')
        } finally {
          if (runtime) {
            await runtime.prisma.$disconnect()
            await runtime.pool.end()
          }
          vi.unstubAllGlobals()
          vi.unstubAllEnvs()
        }
      })
    })
    describe('subscription events and route recovery', () => {
      let eventCounter = 0,
        lateCounter = 0
      const eventBody = (type = 'SUBSCRIPTION_UPDATED') => ({
        id: 'event-' + counter + '-' + ++eventCounter,
        event: type,
        subscription: {
          id: 'provider-' + id,
          externalReference: 'sub:' + id,
          status: 'INACTIVE',
          value: 0,
        },
      })
      const consumer = (environment: 'sandbox' | 'production' = 'sandbox') =>
        createSubscriptionEventConsumer({
          transaction: scope.withPlatformTransaction,
          environment,
          now: () => instant,
        })
      const receive = async (body: { id: string }, environment = 'sandbox') => {
        const payloadHash = createHash('sha256')
          .update(JSON.stringify(body))
          .digest('hex')
        await createPlatformAsaasIngress({
          transaction: scope.withPlatformTransaction,
          environment,
        })({ source: 'ASAAS_ROOT', body, payloadHash })
        return inspector.platformWebhookInbox.findUniqueOrThrow({
          where: {
            source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:' + body.id },
          },
        })
      }
      const delivery = async (inboxId: string) => ({
        ...(await inspector.platformOutboxEvent.findFirstOrThrow({
          where: { aggregateId: inboxId },
        })),
        lockedBy: 'fixture-worker',
      })
      const handoff = async (body = eventBody()) => {
        const receipt = await receive(body)
        await consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](
          await delivery(receipt.id)
        )
        const job = await inspector.platformOutboxEvent.findUniqueOrThrow({
          where: { dedupeKey: 'subscription-receipt:' + receipt.id },
        })
        return { receipt, job: { ...job, lockedBy: 'fixture-worker' }, body }
      }
      const currentReceipt = (inboxId: string) =>
        inspector.platformWebhookInbox.findUniqueOrThrow({
          where: { id: inboxId },
        })
      const recover = (environment: 'sandbox' | 'production' = 'sandbox') =>
        createPlatformAsaasRecovery(
          scope.withPlatformTransaction,
          environment
        )()
      const lateSubscription = async (
        localId: string,
        providerId: string,
        environment = 'sandbox'
      ) =>
        scope.withPlatformTransaction(async (tx) => {
          const tenant = 'late-tenant-' + ++lateCounter
          await tx.organization.create({
            data: {
              id: tenant,
              slug: tenant,
              name: 'Synthetic late subscriber',
              origin: 'ONBOARDING',
              ownerUserId: owner,
            },
          })
          await tx.membership.create({
            data: {
              tenantId: tenant,
              userId: owner,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          })
          return tx.subscription.create({
            data: {
              id: localId,
              tenantId: tenant,
              status: 'INCOMPLETE',
              planVersionId: version,
              providerEnvironment: environment,
              providerCustomerId: 'customer-' + tenant,
              providerSubscriptionId: providerId,
              providerNextAttemptAt: new Date('2026-01-01T00:00:00Z'),
            },
          })
        })
      it.each([
        'SUBSCRIPTION_CREATED',
        'SUBSCRIPTION_UPDATED',
        'SUBSCRIPTION_INACTIVATED',
        'SUBSCRIPTION_DELETED',
        'SUBSCRIPTION_SPLIT_DISABLED',
        'SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK',
        'SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED',
      ])(
        'uses %s only as a trigger and derives access from confirmed provider facts',
        async (type) => {
          const input = await handoff(eventBody(type))
          expect((await currentReceipt(input.receipt.id)).status).toBe(
            'PROCESSED'
          )
          expect(provider.snapshot).not.toHaveBeenCalled()
          expect(await invoice()).toBeNull()
          expect(input.job.payload).toEqual({
            subscriptionId: id,
            sourceInboxId: input.receipt.id,
          })
          await worker().handlers[input.job.topic]!(input.job)
          expect(provider.snapshot).toHaveBeenCalledTimes(1)
          expect((await sub()).status).toBe('ACTIVE')
          expect((await invoice())?.status).toBe('PAID')
          expect(
            (
              await inspector.organization.findUniqueOrThrow({
                where: { id: tenantId },
              })
            ).access
          ).toBe('FULL')
        }
      )
      it('concurrent duplicate handoffs persist exactly one follow-up and no financial effect', async () => {
        const receipt = await receive(eventBody())
        const message = await delivery(receipt.id)
        await Promise.all(
          Array.from({ length: 8 }, () =>
            consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](message)
          )
        )
        expect(
          await inspector.platformOutboxEvent.count({
            where: { dedupeKey: 'subscription-receipt:' + receipt.id },
          })
        ).toBe(1)
        expect((await currentReceipt(receipt.id)).attempts).toBe(1)
        expect(await invoice()).toBeNull()
      })
      it('a payload claiming ACTIVE cannot turn a currently pending invoice into a payment', async () => {
        payments.set(paymentId, {
          ...payments.get(paymentId)!,
          status: 'PENDING',
          providerStatus: 'PENDING',
          paidAt: null,
        })
        const input = await handoff({
          ...eventBody(),
          subscription: {
            id: 'provider-' + id,
            externalReference: 'sub:' + id,
            status: 'ACTIVE',
            value: 149.9,
          },
        })
        await worker().handlers[input.job.topic]!(input.job)
        expect((await sub()).status).toBe('INCOMPLETE')
        expect((await invoice())?.status).toBe('PENDING')
        expect(
          (
            await inspector.organization.findUniqueOrThrow({
              where: { id: tenantId },
            })
          ).access
        ).toBe('SETUP')
      })
      it('a conflicting receipt invalidates queued reconciliation before a provider call', async () => {
        const input = await handoff()
        await receive({
          ...input.body,
          subscription: { ...input.body.subscription, value: 1 },
        })
        await worker().handlers[input.job.topic]!(input.job)
        expect((await currentReceipt(input.receipt.id)).status).toBe('CONFLICT')
        expect(provider.snapshot).not.toHaveBeenCalled()
        expect(await invoice()).toBeNull()
      })
      it('a conflict arriving during provider confirmation prevents every invoice/access/history write', async () => {
        const input = await handoff()
        provider.snapshot.mockImplementation(async () => {
          await receive({
            ...input.body,
            subscription: { ...input.body.subscription, value: 1 },
          })
          return { subscription: remote(), invoices: [...payments.values()] }
        })
        await worker().handlers[input.job.topic]!(input.job)
        expect(await invoice()).toBeNull()
        expect((await sub()).status).toBe('INCOMPLETE')
        expect(
          await inspector.subscriptionEvent.count({
            where: { subscriptionId: id },
          })
        ).toBe(0)
      })
      it('contradictory provider ID and reference are audited without scheduling financial work', async () => {
        const receipt = await receive({
          ...eventBody(),
          subscription: {
            id: 'provider-' + id,
            externalReference: 'sub:other',
          },
        })
        await consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](
          await delivery(receipt.id)
        )
        expect((await currentReceipt(receipt.id)).status).toBe('IGNORED')
        expect(
          await inspector.platformOutboxEvent.count({
            where: { dedupeKey: 'subscription-receipt:' + receipt.id },
          })
        ).toBe(0)
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: receipt.id,
              reasonCategory: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
            },
          })
        ).toBe(1)
      })
      it('the environment and tenant of the receipt must match its consumer before handoff', async () => {
        const receipt = await receive(eventBody()),
          message = await delivery(receipt.id)
        await expect(
          consumer('production').handlers[SUBSCRIPTION_EVENT_TOPIC](message)
        ).rejects.toThrow('INVALID_SUBSCRIPTION_MESSAGE')
        await expect(
          consumer().handlers[SUBSCRIPTION_EVENT_TOPIC]({
            ...message,
            tenantId: 'other',
          })
        ).rejects.toThrow('INVALID_SUBSCRIPTION_MESSAGE')
        expect((await currentReceipt(receipt.id)).status).toBe('RECEIVED')
      })
      it('an account receipt cannot masquerade as a commercial root subscription receipt', async () => {
        const body = eventBody()
        const receipt = await inspector.platformWebhookInbox.create({
          data: {
            source: 'ASAAS_ACCOUNT',
            tenantId,
            eventId: body.id,
            eventType: body.event,
            payload: body,
            payloadHash: createHash('sha256')
              .update(JSON.stringify(body))
              .digest('hex'),
          },
        })
        const message = {
          id: 'fixture',
          tenantId,
          topic: SUBSCRIPTION_EVENT_TOPIC,
          aggregateId: receipt.id,
          payload: { inboxId: receipt.id },
          dedupeKey: body.id,
          attempts: 0,
          lockedBy: 'fixture-worker',
        }
        await expect(
          consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](message)
        ).rejects.toThrow('INVALID_SUBSCRIPTION_MESSAGE')
        expect(
          await inspector.platformOutboxEvent.count({
            where: { dedupeKey: 'subscription-receipt:' + receipt.id },
          })
        ).toBe(0)
      })
      it('rollback of the follow-up enqueue also rolls back receipt processing', async () => {
        const receipt = await receive(eventBody())
        await db.query(
          "CREATE FUNCTION fixture_fail_followup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.topic='subscriptions.reconcile' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_fail_followup BEFORE INSERT ON platform_outbox_events FOR EACH ROW EXECUTE FUNCTION fixture_fail_followup()"
        )
        try {
          await expect(
            consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](
              await delivery(receipt.id)
            )
          ).rejects.toThrow()
          expect(await currentReceipt(receipt.id)).toMatchObject({
            status: 'RECEIVED',
            attempts: 0,
            processedAt: null,
          })
          expect(
            await inspector.platformOutboxEvent.count({
              where: { dedupeKey: 'subscription-receipt:' + receipt.id },
            })
          ).toBe(0)
        } finally {
          await db.query(
            'DROP TRIGGER fixture_fail_followup ON platform_outbox_events; DROP FUNCTION fixture_fail_followup()'
          )
        }
      })
      it('a live receipt lease is honored and an expired lease can recover', async () => {
        const receipt = await receive(eventBody())
        await inspector.platformWebhookInbox.update({
          where: { id: receipt.id },
          data: {
            processingToken: 'other-worker',
            lockedUntil: new Date(instant.getTime() + 1000),
          },
        })
        await expect(
          consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](
            await delivery(receipt.id)
          )
        ).rejects.toThrow('SUBSCRIPTION_RECEIPT_BUSY')
        await inspector.platformWebhookInbox.update({
          where: { id: receipt.id },
          data: { lockedUntil: new Date(instant.getTime() - 1) },
        })
        await consumer().handlers[SUBSCRIPTION_EVENT_TOPIC](
          await delivery(receipt.id)
        )
        expect(await currentReceipt(receipt.id)).toMatchObject({
          status: 'PROCESSED',
          processingToken: null,
          lockedUntil: null,
        })
      })
      it('a creation event can recover UNKNOWN through confirmed reference lookup without repeating creation', async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.update({
            where: { id },
            data: { providerSubscriptionId: null, providerSync: 'UNKNOWN' },
          })
        )
        const input = await handoff(eventBody('SUBSCRIPTION_CREATED'))
        await worker().handlers[input.job.topic]!(input.job)
        expect(await sub()).toMatchObject({
          providerSubscriptionId: 'provider-' + id,
          providerSync: 'SYNCED',
          status: 'ACTIVE',
        })
        expect(provider.snapshot).toHaveBeenCalledWith({
          id: null,
          reference: 'sub:' + id,
          knownPaymentIds: [],
        })
      })
      it('a cancellation racing an UNKNOWN creation recovers the resource before inactivating it', async () => {
        await cancel('NON_PAYMENT')
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.update({
            where: { id },
            data: { providerSubscriptionId: null, providerSync: 'UNKNOWN' },
          })
        )
        const input = await handoff(eventBody('SUBSCRIPTION_CREATED'))
        expect(input.job.topic).toBe(SUBSCRIPTION_DEACTIVATE_TOPIC)
        await worker().handlers[input.job.topic]!(input.job)
        expect(await sub()).toMatchObject({
          providerSubscriptionId: 'provider-' + id,
          providerSync: 'SYNCED',
          status: 'CANCELED',
        })
        expect(provider.inactive).toHaveBeenCalledWith('provider-' + id)
        expect(provider.cancelInvoice).not.toHaveBeenCalled()
      })
      it('an UNKNOWN reference cannot bind a found provider resource to a different event ID', async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.update({
            where: { id },
            data: { providerSubscriptionId: null, providerSync: 'UNKNOWN' },
          })
        )
        const input = await handoff({
          ...eventBody(),
          subscription: {
            id: 'different-provider-id',
            externalReference: 'sub:' + id,
            status: 'ACTIVE',
            value: 149.9,
          },
        })
        await worker().handlers[input.job.topic]!(input.job)
        expect(await sub()).toMatchObject({
          providerSubscriptionId: null,
          providerSync: 'UNKNOWN',
          status: 'INCOMPLETE',
        })
        expect(await invoice()).toBeNull()
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: id,
              reasonCategory: 'SUBSCRIPTION_EVENT_BINDING_MISMATCH',
            },
          })
        ).toBe(1)
      })
      it('backlog relabeling preserves job identity and does not capture invoice or tenant topics', async () => {
        const receipt = await receive(eventBody()),
          original = await delivery(receipt.id)
        await inspector.platformOutboxEvent.update({
          where: { id: original.id },
          data: { topic: 'platform.webhook.process' },
        })
        const paymentBody = {
          id: 'invoice-kind-' + counter,
          event: 'PAYMENT_CONFIRMED',
          payment: {
            id: paymentId,
            subscription: 'provider-' + id,
            externalReference: 'sub:' + id,
            value: 149.9,
            status: 'CONFIRMED',
          },
        }
        const paymentReceipt = await receive(paymentBody),
          paymentJob = await delivery(paymentReceipt.id)
        await consumer().enqueue()
        await consumer().enqueue()
        expect(
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { id: original.id },
          })
        ).toMatchObject({
          id: original.id,
          topic: SUBSCRIPTION_EVENT_TOPIC,
          dedupeKey: original.dedupeKey,
          aggregateId: original.aggregateId,
          attempts: 0,
        })
        expect((await delivery(paymentReceipt.id)).topic).toBe(paymentJob.topic)
      })
      it('a late local subscription makes an authenticated unrouted receipt routable exactly once', async () => {
        const localId = 'late-sub-' + counter,
          providerId = 'late-provider-' + counter
        const body = {
          ...eventBody(),
          subscription: {
            id: providerId,
            externalReference: 'sub:' + localId,
            status: 'ACTIVE',
            value: 149.9,
          },
        }
        const receipt = await receive(body)
        expect(receipt).toMatchObject({
          status: 'UNROUTED',
          tenantId: null,
          sourceEnvironment: 'sandbox',
        })
        const late = await lateSubscription(localId, providerId)
        const results = await Promise.all(
          Array.from({ length: 6 }, () => recover())
        )
        expect(results.reduce((sum, n) => sum + n, 0)).toBe(1)
        expect(await currentReceipt(receipt.id)).toMatchObject({
          status: 'RECEIVED',
          tenantId: late.tenantId,
          payload: receipt.payload,
          payloadHash: receipt.payloadHash,
          eventId: receipt.eventId,
          sourceEnvironment: 'sandbox',
        })
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: receipt.id },
          })
        ).toBe(1)
        expect(
          await inspector.platformAuditLog.count({
            where: { targetId: receipt.id, action: 'webhook.route.recovered' },
          })
        ).toBe(1)
      })
      it('a late inv reference recovers payment routing and the original invoice consumer confirms it', async () => {
        const localInvoice = 'late-invoice-' + counter
        const fact = {
          ...payments.get(paymentId)!,
          externalReference: 'inv:' + localInvoice,
          subscription: null,
        }
        const body = {
          id: 'late-invoice-event-' + counter,
          event: 'PAYMENT_CONFIRMED',
          payment: {
            id: paymentId,
            value: 149.9,
            status: 'CONFIRMED',
            externalReference: fact.externalReference,
          },
        }
        const receipt = await receive(body)
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.create({
            data: {
              id: localInvoice,
              tenantId,
              subscriptionId: id,
              providerPaymentId: paymentId,
              amount: '149.90',
              dueDate: new Date('2026-10-03T00:00:00Z'),
              syncedAt: instant,
            },
          })
        )
        expect(await recover()).toBe(1)
        const invoiceConsumer = createSubscriptionInvoiceConsumer({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          read: async () => fact,
          now: () => instant,
        })
        const job = await delivery(receipt.id)
        await invoiceConsumer.handlers[job.topic]!(job)
        expect((await invoice())?.status).toBe('PAID')
        expect((await sub()).status).toBe('ACTIVE')
      })
      it('environment switching cannot recover an old root receipt, and cross-environment identity collision is a conflict', async () => {
        const localId = 'other-env-sub-' + counter,
          providerId = 'other-env-provider-' + counter
        const body = {
          ...eventBody(),
          subscription: {
            id: providerId,
            externalReference: 'sub:' + localId,
            status: 'ACTIVE',
            value: 149.9,
          },
        }
        const receipt = await receive(body)
        await lateSubscription(localId, providerId, 'production')
        expect(await recover('production')).toBe(0)
        expect((await currentReceipt(receipt.id)).status).toBe('UNROUTED')
        await receive(body, 'production')
        expect((await currentReceipt(receipt.id)).status).toBe('CONFLICT')
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: receipt.id },
          })
        ).toBe(0)
      })
      it('legacy unrouted receipts with unknown environment are never guessed or automatically rebound', async () => {
        const body = eventBody()
        const receipt = await inspector.platformWebhookInbox.create({
          data: {
            source: 'ASAAS_ROOT',
            eventId: body.id,
            eventType: body.event,
            payload: body,
            payloadHash: createHash('sha256')
              .update(JSON.stringify(body))
              .digest('hex'),
            status: 'UNROUTED',
          },
        })
        await recover()
        expect(await currentReceipt(receipt.id)).toMatchObject({
          sourceEnvironment: null,
          status: 'UNROUTED',
          tenantId: null,
        })
      })
      it('root environment is validated at insert and is immutable even to the platform role', async () => {
        const receipt = await receive(eventBody())
        await expect(
          scope.withPlatformTransaction((tx) =>
            tx.platformWebhookInbox.update({
              where: { id: receipt.id },
              data: { sourceEnvironment: 'production' },
            })
          )
        ).rejects.toThrow('WEBHOOK_ENVIRONMENT_IMMUTABLE')
        await expect(
          scope.withPlatformTransaction((tx) =>
            tx.platformWebhookInbox.create({
              data: {
                source: 'ASAAS_ROOT',
                sourceEnvironment: 'unknown',
                eventId: randomUUID(),
                eventType: 'SUBSCRIPTION_UPDATED',
                payload: {},
                payloadHash: '0'.repeat(64),
              },
            })
          )
        ).rejects.toThrow()
        expect((await currentReceipt(receipt.id)).sourceEnvironment).toBe(
          'sandbox'
        )
      })
      it('bounded recovery skips older unresolvable receipts and leaves only its remaining backlog', async () => {
        const localId = 'recover-backlog-sub-' + counter,
          providerId = 'recover-backlog-provider-' + counter
        for (let index = 0; index < 25; index++)
          await receive({
            ...eventBody(),
            subscription: {
              id: 'never-' + counter + '-' + index,
              externalReference: 'sub:never-' + counter + '-' + index,
              status: 'ACTIVE',
              value: 149.9,
            },
          })
        const receipts = []
        for (let index = 0; index < 23; index++)
          receipts.push(
            await receive({
              ...eventBody(),
              subscription: {
                id: providerId,
                externalReference: 'sub:' + localId,
                status: 'ACTIVE',
                value: 149.9,
              },
            })
          )
        await lateSubscription(localId, providerId)
        expect(await recover()).toBe(20)
        expect(
          await inspector.platformWebhookInbox.count({
            where: {
              id: { in: receipts.map((r) => r.id) },
              status: 'UNROUTED',
            },
          })
        ).toBe(3)
        expect(await recover()).toBe(3)
        expect(await recover()).toBe(0)
      })
    })
  }
)
