import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  afterAll,
  afterEach,
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
  createOwnerSubscriptionCancellation,
  createOwnerSubscriptionActivation,
  createOwnerSubscriptionReactivation,
  createSubscriptionIssuance,
  createSubscriptionJobs,
} from '../../packages/backend/src/modules/subscriptions/index'
import {
  BillingProviderError,
  type AsaasPlatformInvoice,
} from '../../packages/backend/src/modules/billing/index'
import {
  SUBSCRIPTION_ISSUE_TOPIC,
  SUBSCRIPTION_RECONCILE_TOPIC,
  SUBSCRIPTION_REACTIVATE_TOPIC,
} from '../../packages/backend/src/modules/subscriptions/topics'
import { RetryDeliveryAtError } from '../../packages/backend/src/modules/outbox/index'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import { SUBSCRIPTION_DEACTIVATE_TOPIC } from '../../packages/backend/src/modules/subscriptions/topics'
import type { TenantPrincipal } from '@gb-locacoes/backend/identity'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'owner cancellation under real isolated platform role',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'owner_cancel_' + suffix + '_test',
      role = 'owner_cancel_' + suffix
    let admin: Pool,
      db: Pool,
      runtimePool: Pool,
      inspector: PrismaClient,
      prisma: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      version: string,
      owner: string,
      staff: string
    let principal: TenantPrincipal,
      id: string,
      tenantId: string,
      instant: Date,
      counter = 0
    const execute = (
      action: 'cancel' | 'undo-cancel',
      key = randomUUID(),
      actor = principal,
      authenticatedAt = instant.getTime() - 30_000
    ) =>
      createOwnerSubscriptionCancellation({
        transaction: scope.withProvisioningTransaction,
        now: () => instant,
      })(actor, { action, key, authenticatedAt })
    const sub = () =>
      inspector.subscription.findUniqueOrThrow({ where: { id } })
    const receipts = () =>
      inspector.subscriptionEvent.findMany({
        where: { tenantId, actorUserId: owner },
      })
    const queued = () =>
      inspector.platformOutboxEvent.findMany({
        where: { tenantId, topic: SUBSCRIPTION_DEACTIVATE_TOPIC },
      })
    const prepareIssuance = async (withConsent = true) =>
      scope.withProvisioningTransaction(tenantId, async (tx) => {
        await tx.organization.update({
          where: { id: tenantId },
          data: {
            documentNormalized: '11222333000181',
            legalName: 'Synthetic fixture only',
            billingEmail: 'billing@example.invalid',
          },
        })
        await tx.subscription.update({
          where: { id },
          data: {
            status: 'INCOMPLETE',
            billingMode: 'ASAAS',
            complimentaryUntil: null,
            providerSync: 'NOT_REQUIRED',
            providerNextAttemptAt: instant,
          },
        })
        if (withConsent)
          for (const kind of [
            'PLATFORM_TERMS',
            'PRIVACY_POLICY',
            'DATA_PROCESSING_AGREEMENT',
            'PAYMENTS_PARTNER_NOTICE',
          ] as const)
            await tx.legalAcceptance.create({
              data: {
                tenantId,
                userId: owner,
                kind,
                version: 'synthetic-not-legal-text',
                textSha256: 'a'.repeat(64),
                acceptedAt: new Date('2026-10-01'),
              },
            })
      })
    const activate = (key = randomUUID(), actor = principal) =>
      createOwnerSubscriptionActivation({
        transaction: scope.withProvisioningTransaction,
        environment: 'sandbox',
        now: () => instant,
      })(actor, { key, authenticatedAt: instant.getTime() - 30_000 })
    const issuance = () => {
      const remoteCustomer = {
        id: 'cus_' + id,
        cpfCnpj: '11222333000181',
        externalReference: 'org:' + tenantId,
        notificationDisabled: true as const,
      }
      const remoteSubscription = {
        id: 'asaas_' + id,
        customer: remoteCustomer.id,
        externalReference: 'sub:' + id,
        cycle: 'MONTHLY',
        status: 'ACTIVE' as const,
        amount: new Prisma.Decimal('149.90'),
      }
      const provider = {
        findCustomer: vi.fn().mockResolvedValue(null),
        createCustomer: vi.fn().mockResolvedValue(remoteCustomer),
        findSubscription: vi.fn().mockResolvedValue(null),
        createSubscription: vi.fn().mockResolvedValue(remoteSubscription),
      }
      const worker = createSubscriptionIssuance({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        provider,
        now: () => instant,
      })
      const run = (payloadId = id, scopedTenant = tenantId) =>
        worker.handlers[SUBSCRIPTION_ISSUE_TOPIC]({
          id: 'synthetic-issue',
          tenantId: scopedTenant,
          topic: SUBSCRIPTION_ISSUE_TOPIC,
          aggregateId: id,
          payload: { subscriptionId: payloadId },
          dedupeKey: 'synthetic-issue',
          attempts: 1,
          lockedBy: 'synthetic-worker',
        })
      return { provider, worker, run, remoteCustomer, remoteSubscription }
    }
    const waitForLock = async (table: string) => {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const result = await admin.query(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock' AND query LIKE '%' || $2 || '%') AS waiting",
          [role, 'FROM ' + table]
        )
        if (result.rows[0].waiting) return
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      throw new Error(
        'Expected command to wait on its actual PostgreSQL row lock'
      )
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
      const roleUrl = await createLoginRole(
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
      runtimePool = new Pool({ connectionString: roleUrl, max: 4 })
      prisma = new PrismaClient({ adapter: new PrismaPg(runtimePool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(prisma)
      owner = (
        await inspector.user.create({
          data: { email: suffix + '-owner@example.invalid' },
        })
      ).id
      staff = (
        await inspector.user.create({
          data: { email: suffix + '-staff@example.invalid' },
        })
      ).id
      version = await scope.withPlatformTransaction(async (tx) => {
        const seed = await tx.planVersion.findFirstOrThrow()
        const plan = await tx.plan.create({
          data: {
            code: 'synthetic-cancel',
            name: 'Synthetic cancellation fixture',
          },
        })
        return (
          await tx.planVersion.create({
            data: {
              planId: plan.id,
              version: 1,
              amount: '149.90',
              entitlements: seed.entitlements as Prisma.InputJsonValue,
              // The commands run on the synthetic clock (`instant`, from 2026-10-04); the column default
              // is the wall clock, which would make the offer "not yet sellable" on any later day.
              sellableFrom: new Date('2026-10-01T00:00:00Z'),
            },
          })
        ).id
      })
    }, 120_000)
    beforeEach(async () => {
      instant = new Date('2026-10-04T16:00:00Z')
      tenantId = 'owner-cancel-' + ++counter
      id = 'owner-cancel-sub-' + counter
      const member = await scope.withProvisioningTransaction(
        tenantId,
        async (tx) => {
          await tx.organization.create({
            data: {
              id: tenantId,
              slug: tenantId,
              name: 'Synthetic owner command',
              origin: 'ONBOARDING',
              ownerUserId: owner,
              access: 'FULL',
            },
          })
          const membership = await tx.membership.create({
            data: { tenantId, userId: owner, role: 'ADMIN', status: 'ACTIVE' },
          })
          await tx.membership.create({
            data: { tenantId, userId: staff, role: 'ADMIN', status: 'ACTIVE' },
          })
          await tx.subscription.create({
            data: {
              id,
              tenantId,
              planVersionId: version,
              status: 'ACTIVE',
              billingMode: 'COMPLIMENTARY',
              complimentaryReason: 'SYNTHETIC_FIXTURE',
              complimentaryUntil: new Date('2026-11-01'),
              createdAt: new Date('2026-10-01T16:00:00Z'),
            },
          })
          return membership.id
        }
      )
      principal = {
        tenantId,
        userId: owner,
        membershipId: member,
        role: 'ADMIN',
      }
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
    describe('owner reactivation and durable predecessor cleanup', () => {
      afterEach(async () => {
        // This suite's real global dispatcher must not consume another test's unfinished fixtures.
        await scope.withPlatformTransaction(async (tx) => {
          await tx.platformOutboxEvent.updateMany({
            where: { tenantId, status: 'PENDING' },
            data: { status: 'FAILED', lastError: 'TEST_FIXTURE_CLOSED' },
          })
          await tx.subscription.updateMany({
            where: { tenantId, status: { not: 'CANCELED' } },
            data: {
              status: 'CANCELED',
              canceledAt: instant,
              cancelReason: 'STAFF',
            },
          })
        })
      })
      const prepare = async (consent = true) => {
        await prepareIssuance(consent)
        await scope.withPlatformTransaction(async (tx) => {
          const offer = await tx.planVersion.findUniqueOrThrow({
            where: { id: version },
          })
          await tx.plan.update({
            where: { id: offer.planId },
            data: { isPublic: true, archivedAt: null },
          })
          await tx.subscription.update({
            where: { id },
            data: {
              status: 'CANCELED',
              canceledAt: new Date(instant.getTime() - 60_000),
              cancelReason: 'NON_PAYMENT',
              providerEnvironment: 'sandbox',
              providerCustomerId: 'customer-' + tenantId,
              providerSubscriptionId: 'provider-' + id,
              providerSync: 'SYNCED',
            },
          })
          await tx.organization.update({
            where: { id: tenantId },
            data: { access: 'ARCHIVED' },
          })
          for (const [suffix, status, dueDate] of [
            ['overdue', 'OVERDUE', '2026-09-20'],
            ['future', 'PENDING', '2026-10-20'],
            ['paid', 'PAID', '2026-09-01'],
          ] as const)
            await tx.platformInvoice.create({
              data: {
                tenantId,
                subscriptionId: id,
                providerPaymentId: 'payment-' + id + '-' + suffix,
                status,
                amount: '149.90',
                dueDate: new Date(dueDate),
                kind: 'CYCLE',
                syncedAt: instant,
              },
            })
        })
      }
      const reactivate = (
        key = randomUUID(),
        planVersionId = version,
        actor = principal,
        authenticatedAt = instant.getTime() - 30_000
      ) =>
        createOwnerSubscriptionReactivation({
          transaction: scope.withProvisioningTransaction,
          environment: 'sandbox',
          now: () => instant,
        })(actor, { key, planVersionId, authenticatedAt })
      const next = () =>
        inspector.subscription.findFirstOrThrow({
          where: { tenantId, status: { not: 'CANCELED' } },
        })
      const cleanup = async () => {
        const old = await sub()
        let remoteStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'
        const remote = () => ({
          id: old.providerSubscriptionId!,
          customer: old.providerCustomerId!,
          externalReference: 'sub:' + old.id,
          amount: new Prisma.Decimal('149.90'),
          cycle: 'MONTHLY',
          status: remoteStatus,
        })
        const payments = new Map<string, AsaasPlatformInvoice>()
        for (const row of await inspector.platformInvoice.findMany({
          where: { subscriptionId: old.id },
        }))
          payments.set(row.providerPaymentId, {
            id: row.providerPaymentId,
            status: row.status,
            providerStatus: row.status,
            unknownStatus: false,
            amount: new Prisma.Decimal('149.90'),
            dueDate: row.dueDate.toISOString().slice(0, 10),
            subscription: old.providerSubscriptionId,
            customer: old.providerCustomerId!,
            externalReference: 'sub:' + old.id,
            billingType: 'PIX',
            invoiceUrl: null,
            paidAt: row.status === 'PAID' ? new Date('2026-09-01') : null,
          })
        const provider = {
          snapshot: vi.fn().mockImplementation(async () => ({
            subscription: remote(),
            invoices: [...payments.values()],
          })),
          subscription: vi.fn().mockImplementation(async () => remote()),
          inactive: vi.fn().mockImplementation(async () => {
            remoteStatus = 'INACTIVE'
          }),
          invoice: vi
            .fn()
            .mockImplementation(async (paymentId: string) =>
              payments.get(paymentId)!
            ),
          cancelInvoice: vi
            .fn()
            .mockImplementation(async (paymentId: string) => {
              const row = payments.get(paymentId)!
              payments.set(paymentId, {
                ...row,
                status: 'CANCELED',
                providerStatus: 'DELETED',
              })
            }),
        }
        const worker = createSubscriptionJobs({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          provider,
          now: () => instant,
        })
        const run = async (override: Record<string, unknown> = {}) => {
          const message = await inspector.platformOutboxEvent.findFirstOrThrow({
            where: { tenantId, topic: SUBSCRIPTION_REACTIVATE_TOPIC },
          })
          return worker.handlers[SUBSCRIPTION_REACTIVATE_TOPIC]!({
            ...message,
            lockedBy: 'fixture-worker',
            ...override,
          })
        }
        return { payments, provider, worker, run, remote }
      }
      it('creates a new INCOMPLETE identity without trial, atomically waives old debt and preserves history under RLS', async () => {
        await prepare()
        expect(await reactivate()).toEqual({ accepted: true })
        const current = await next()
        expect(current.id).not.toBe(id)
        expect(current).toMatchObject({
          status: 'INCOMPLETE',
          trialEndsAt: null,
          currentPeriodEnd: null,
          providerSubscriptionId: null,
          providerCustomerId: null,
          providerEnvironment: 'sandbox',
        })
        expect((await sub()).status).toBe('CANCELED')
        const invoices = await inspector.platformInvoice.findMany({
          where: { subscriptionId: id },
        })
        expect(
          invoices.find((row) => row.providerPaymentId.endsWith('-overdue'))
        ).toMatchObject({
          status: 'CANCELED',
          canceledReason: 'REACTIVATION_WAIVER',
          debtWaivedAt: instant,
          providerCancelState: 'NONE',
        })
        expect(
          invoices.find((row) => row.providerPaymentId.endsWith('-paid'))!
            .status
        ).toBe('PAID')
        expect(
          invoices.find((row) => row.providerPaymentId.endsWith('-future'))!
            .status
        ).toBe('PENDING')
        expect(
          await inspector.organization.findUnique({ where: { id: tenantId } })
        ).toMatchObject({ access: 'SETUP' })
        expect(await receipts()).toMatchObject([
          {
            subscriptionId: current.id,
            reason: 'REACTIVATION_REQUESTED',
            planVersionId: version,
          },
        ])
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('replays a concurrent identical intent once and binds the selected plan to the immutable receipt', async () => {
        await prepare()
        expect(
          await Promise.all(
            Array.from({ length: 6 }, () => reactivate('same-reactivation'))
          )
        ).toEqual(Array.from({ length: 6 }, () => ({ accepted: true })))
        expect(
          await inspector.subscription.count({ where: { tenantId } })
        ).toBe(2)
        expect(await receipts()).toHaveLength(1)
        await expect(
          reactivate('same-reactivation', 'another-plan')
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
        await expect(
          execute('cancel', 'same-reactivation')
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
      })
      it('different concurrent intentions cannot create two live subscriptions', async () => {
        await prepare()
        const results = await Promise.allSettled([
          reactivate('reactivation-one'),
          reactivate('reactivation-two'),
        ])
        expect(
          results.filter((result) => result.status === 'fulfilled')
        ).toHaveLength(1)
        expect(
          results.find((result) => result.status === 'rejected')
        ).toMatchObject({ reason: { code: 'SUBSCRIPTION_NOT_REACTIVATABLE' } })
        expect(
          await inspector.subscription.count({
            where: { tenantId, status: { not: 'CANCELED' } },
          })
        ).toBe(1)
      })
      it('refuses reactivation of a live subscription', async () => {
        await expect(reactivate()).rejects.toMatchObject({
          code: 'SUBSCRIPTION_NOT_REACTIVATABLE',
        })
      })
      it.each(['staff', 'stale', 'foreign'] as const)(
        'rechecks current ownership/session/scope: %s',
        async (variant) => {
          await prepare()
          const actor =
            variant === 'staff'
              ? { ...principal, userId: staff }
              : variant === 'foreign'
                ? { ...principal, tenantId: 'foreign-tenant' }
                : principal
          await expect(
            reactivate(
              'guarded-reactivation',
              version,
              actor,
              variant === 'stale'
                ? instant.getTime() - 600_001
                : instant.getTime()
            )
          ).rejects.toMatchObject({
            code:
              variant === 'stale' ? 'FRESH_SESSION_REQUIRED' : 'OWNER_REQUIRED',
          })
          expect(
            await inspector.subscription.count({ where: { tenantId } })
          ).toBe(1)
        }
      )
      it.each(['hidden', 'archived', 'annual', 'future', 'expired'] as const)(
        'requires a currently published monthly offer: %s',
        async (variant) => {
          await prepare()
          const unavailable = await scope.withPlatformTransaction(
            async (tx) => {
              const original = await tx.planVersion.findUniqueOrThrow({
                where: { id: version },
              })
              const plan = await tx.plan.create({
                data: {
                  code: 'unavailable-' + counter,
                  name: 'Synthetic unavailable',
                  isPublic: variant !== 'hidden',
                  archivedAt: variant === 'archived' ? instant : null,
                },
              })
              return tx.planVersion.create({
                data: {
                  planId: plan.id,
                  version: 1,
                  amount: '149.90',
                  entitlements: original.entitlements as Prisma.InputJsonValue,
                  interval: variant === 'annual' ? 'YEARLY' : 'MONTHLY',
                  sellableFrom:
                    variant === 'future'
                      ? new Date(instant.getTime() + 1)
                      : new Date('2026-10-01'),
                  sellableUntil: variant === 'expired' ? instant : null,
                },
              })
            }
          )
          await expect(
            reactivate('invalid-offer', unavailable.id)
          ).rejects.toMatchObject({ code: 'PLAN_NOT_AVAILABLE' })
          expect(
            await inspector.subscription.count({ where: { tenantId } })
          ).toBe(1)
        }
      )
      it('missing legal consent rolls back the new subscription, waiver, access and outbox', async () => {
        await prepare(false)
        await expect(reactivate()).rejects.toMatchObject({
          code: 'LEGAL_ACCEPTANCE_REQUIRED',
        })
        expect(
          await inspector.subscription.count({ where: { tenantId } })
        ).toBe(1)
        expect(
          await inspector.platformInvoice.count({
            where: { tenantId, canceledReason: 'REACTIVATION_WAIVER' },
          })
        ).toBe(0)
        expect(
          await inspector.organization.findUnique({ where: { id: tenantId } })
        ).toMatchObject({ access: 'ARCHIVED' })
        expect(
          await inspector.platformOutboxEvent.count({ where: { tenantId } })
        ).toBe(0)
      })
      it('neither direct activate nor the issuance cron can bypass predecessor cleanup', async () => {
        await prepare()
        await reactivate()
        const current = await next()
        await expect(activate()).rejects.toMatchObject({
          code: 'REACTIVATION_PENDING',
        })
        const issue = issuance()
        await issue.worker.enqueue()
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
        await expect(
          issue.worker.handlers[SUBSCRIPTION_ISSUE_TOPIC]({
            id: 'fixture',
            tenantId,
            topic: SUBSCRIPTION_ISSUE_TOPIC,
            aggregateId: current.id,
            payload: { subscriptionId: current.id },
            dedupeKey: 'fixture',
            attempts: 1,
            lockedBy: 'fixture',
          })
        ).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(issue.provider.createSubscription).not.toHaveBeenCalled()
        expect((await next()).providerSync).toBe('NOT_REQUIRED')
      })
      it('deactivates the old recurrence, confirms only overdue deletion and opens the existing issuance worker', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        await work.run()
        expect(work.provider.inactive).toHaveBeenCalledExactlyOnceWith(
          'provider-' + id
        )
        expect(work.provider.cancelInvoice).toHaveBeenCalledExactlyOnceWith(
          'payment-' + id + '-overdue'
        )
        const current = await next()
        expect(current.providerSync).toBe('PENDING')
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: 'payment-' + id + '-overdue' },
          })
        ).toMatchObject({
          status: 'CANCELED',
          canceledReason: 'REACTIVATION_WAIVER',
          providerCancelState: 'CONFIRMED',
        })
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(1)
        await work.run()
        expect(work.provider.cancelInvoice).toHaveBeenCalledTimes(1)
      })
      it('imports an overdue provider invoice absent locally without waiving a future cycle', async () => {
        await prepare()
        const work = await cleanup()
        const template = work.payments.get('payment-' + id + '-overdue')!
        work.payments.set('missing-' + id, { ...template, id: 'missing-' + id })
        await reactivate()
        await work.run()
        expect(work.provider.cancelInvoice).toHaveBeenCalledWith(
          'missing-' + id
        )
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: 'missing-' + id },
          })
        ).toMatchObject({
          status: 'CANCELED',
          canceledReason: 'REACTIVATION_WAIVER',
          providerCancelState: 'CONFIRMED',
        })
        expect(work.provider.cancelInvoice).not.toHaveBeenCalledWith(
          'payment-' + id + '-future'
        )
      })
      it('the actual isolated dispatcher finishes cleanup and issues one new recurrence with its own reference', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        const current = await next()
        const remoteCustomer = {
          id: 'customer-' + tenantId,
          cpfCnpj: '11222333000181',
          externalReference: 'org:' + tenantId,
          notificationDisabled: true as const,
        }
        const remoteSubscription = {
          id: 'new-provider-' + current.id,
          customer: remoteCustomer.id,
          externalReference: 'sub:' + current.id,
          cycle: 'MONTHLY',
          status: 'ACTIVE' as const,
          amount: new Prisma.Decimal('149.90'),
        }
        const provider = {
          findCustomer: vi.fn().mockResolvedValue(remoteCustomer),
          createCustomer: vi.fn(),
          findSubscription: vi.fn().mockResolvedValue(null),
          createSubscription: vi.fn().mockResolvedValue(remoteSubscription),
        }
        const issue = createSubscriptionIssuance({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          provider,
          now: () => instant,
        })
        const dispatch = createPlatformJobs({
          scope,
          handlers: { ...work.worker.handlers, ...issue.handlers },
          now: () => instant,
          workerId: randomUUID,
        })
        await dispatch()
        await dispatch()
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect(provider.createSubscription).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            externalReference: 'sub:' + current.id,
            customer: remoteCustomer.id,
            nextDueDate: '2026-10-04',
          })
        )
        expect(await next()).toMatchObject({
          providerSubscriptionId: remoteSubscription.id,
          status: 'INCOMPLETE',
          trialEndsAt: null,
        })
        expect((await sub()).providerSubscriptionId).toBe('provider-' + id)
        expect(work.provider.inactive.mock.invocationCallOrder[0]).toBeLessThan(
          provider.createSubscription.mock.invocationCallOrder[0]!
        )
      })
      it('preserves a late paid old invoice and records a manual-treatment alert, never deleting it', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        const paymentId = 'payment-' + id + '-overdue'
        work.payments.set(paymentId, {
          ...work.payments.get(paymentId)!,
          status: 'PAID',
          providerStatus: 'RECEIVED',
          paidAt: instant,
        })
        await work.run()
        expect(work.provider.cancelInvoice).not.toHaveBeenCalled()
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: paymentId },
          })
        ).toMatchObject({
          status: 'PAID',
          canceledReason: 'REACTIVATION_WAIVER',
          debtWaivedAt: instant,
        })
        expect(
          await inspector.platformAuditLog.count({
            where: {
              tenantId,
              reasonCategory: 'PAID_AFTER_SUBSCRIPTION_CANCEL',
            },
          })
        ).toBe(1)
        expect((await sub()).status).toBe('CANCELED')
        expect((await next()).status).toBe('INCOMPLETE')
      })
      it('uncertain deletion and PROCESSING recovery use only reads until cancellation is authoritative', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        work.provider.cancelInvoice.mockRejectedValueOnce(
          new BillingProviderError('AMBIGUOUS', { maybeApplied: true })
        )
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        const paymentId = 'payment-' + id + '-overdue'
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: paymentId },
          })
        ).toMatchObject({ status: 'CANCELED', providerCancelState: 'UNKNOWN' })
        instant = new Date(instant.getTime() + 300_000)
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(work.provider.cancelInvoice).toHaveBeenCalledTimes(1)
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.update({
            where: { providerPaymentId: paymentId },
            data: { providerCancelState: 'PROCESSING' },
          })
        )
        work.payments.set(paymentId, {
          ...work.payments.get(paymentId)!,
          status: 'CANCELED',
          providerStatus: 'DELETED',
        })
        instant = new Date(instant.getTime() + 300_000)
        await work.run()
        expect(work.provider.cancelInvoice).toHaveBeenCalledTimes(1)
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: paymentId },
          })
        ).toMatchObject({
          providerCancelState: 'CONFIRMED',
          canceledReason: 'REACTIVATION_WAIVER',
        })
      })
      it.each([
        'foreign-tenant',
        'foreign-previous',
        'foreign-amount',
        'unknown-status',
      ] as const)(
        'quarantines inconsistent cleanup binding without deletion or issuance: %s',
        async (variant) => {
          await prepare()
          const work = await cleanup()
          await reactivate()
          if (variant === 'foreign-amount' || variant === 'unknown-status') {
            const paymentId = 'payment-' + id + '-overdue'
            work.payments.set(paymentId, {
              ...work.payments.get(paymentId)!,
              ...(variant === 'foreign-amount'
                ? { amount: new Prisma.Decimal('1.00') }
                : { unknownStatus: true }),
            })
          }
          await expect(
            work.run(
              variant === 'foreign-tenant'
                ? { tenantId: 'foreign' }
                : variant === 'foreign-previous'
                  ? {
                      payload: {
                        subscriptionId: (await next()).id,
                        previousSubscriptionId: 'foreign',
                      },
                    }
                  : {}
            )
          ).rejects.toThrow()
          expect(work.provider.cancelInvoice).not.toHaveBeenCalled()
          expect(
            await inspector.platformOutboxEvent.count({
              where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
            })
          ).toBe(0)
        }
      )
      it('cancellation of the new intent during provider I/O never creates a fresh recurrence', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        work.provider.cancelInvoice.mockImplementationOnce(
          async (paymentId: string) => {
            await execute('cancel')
            work.payments.set(paymentId, {
              ...work.payments.get(paymentId)!,
              status: 'CANCELED',
              providerStatus: 'DELETED',
            })
          }
        )
        await work.run()
        expect(
          await inspector.subscription.count({
            where: { tenantId, status: { not: 'CANCELED' } },
          })
        ).toBe(0)
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('a restored invoice whose prior cancellation was confirmed blocks issuance without deleting it again', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.update({
            where: { providerPaymentId: 'payment-' + id + '-overdue' },
            data: { providerCancelState: 'CONFIRMED' },
          })
        )
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(work.provider.cancelInvoice).not.toHaveBeenCalled()
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('unconfirmed old recurrence deactivation blocks both waiver deletion and new issuance', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        work.provider.inactive.mockImplementationOnce(async () => {})
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(work.provider.cancelInvoice).not.toHaveBeenCalled()
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('404 after DELETE remains PROCESSING; replay never repeats DELETE before authoritative recovery', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate()
        const paymentId = 'payment-' + id + '-overdue'
        work.provider.invoice
          .mockResolvedValueOnce(work.payments.get(paymentId)!)
          .mockRejectedValue(
            new BillingProviderError('REJECTED', {
              reason: 'NOT_FOUND',
              status: 404,
            })
          )
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(
          await inspector.platformInvoice.findUnique({
            where: { providerPaymentId: paymentId },
          })
        ).toMatchObject({
          providerCancelState: 'PROCESSING',
          status: 'CANCELED',
        })
        instant = new Date(instant.getTime() + 300_000)
        await expect(work.run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(work.provider.cancelInvoice).toHaveBeenCalledTimes(1)
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('immutable predecessor linkage survives a second reactivation while the first cleanup is still pending', async () => {
        await prepare()
        const work = await cleanup()
        await reactivate('first-reactivation')
        const first = await next()
        await execute('cancel')
        await reactivate('second-reactivation')
        const second = await next()
        await expect(
          work.run({
            aggregateId: second.id,
            payload: {
              subscriptionId: second.id,
              previousSubscriptionId: first.id,
            },
          })
        ).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(work.provider.inactive).not.toHaveBeenCalled()
        await work.run({
          aggregateId: first.id,
          payload: { subscriptionId: first.id, previousSubscriptionId: id },
        })
        expect(work.provider.cancelInvoice).toHaveBeenCalledExactlyOnceWith(
          'payment-' + id + '-overdue'
        )
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
        expect((await next()).providerSync).toBe('NOT_REQUIRED')
        instant = new Date(instant.getTime() + 300_000)
        await work.run({
          aggregateId: second.id,
          payload: {
            subscriptionId: second.id,
            previousSubscriptionId: first.id,
          },
        })
        expect((await next()).providerSync).toBe('PENDING')
      })
    })
    describe('owner activation and durable two-phase issuance', () => {
      it('the real isolated outbox runner claims and completes issuance without claiming uninstalled reconciliation', async () => {
        await prepareIssuance()
        await activate()
        const { provider, worker } = issuance()
        const dispatch = createPlatformJobs({
          scope,
          handlers: worker.handlers,
          now: () => instant,
          workerId: () => 'synthetic-issuance-runner',
          limit: 2,
        })
        expect(await dispatch()).toMatchObject({
          completed: 1,
          failed: 0,
          retried: 0,
          lostLease: 0,
        })
        expect(
          await inspector.platformOutboxEvent.findFirst({
            where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toMatchObject({ status: 'COMPLETED' })
        expect(
          await inspector.platformOutboxEvent.findFirst({
            where: { aggregateId: id, topic: SUBSCRIPTION_RECONCILE_TOPIC },
          })
        ).toMatchObject({ status: 'PENDING', attempts: 0 })
        expect((await sub()).providerSync).toBe('SYNCED')
        expect(provider.createSubscription).toHaveBeenCalledTimes(1)
      })
      it('commits a replayable activation intent with no provider work or premature access change', async () => {
        await prepareIssuance()
        const { provider } = issuance()
        await Promise.all([
          activate('synthetic-activation'),
          activate('synthetic-activation'),
        ])
        expect((await receipts()).map((r) => r.reason)).toEqual([
          'ACTIVATION_REQUESTED',
        ])
        expect(await sub()).toMatchObject({
          status: 'INCOMPLETE',
          providerSync: 'PENDING',
          providerEnvironment: 'sandbox',
          providerCustomerId: null,
        })
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(1)
        expect(provider.createCustomer).not.toHaveBeenCalled()
        await execute('cancel')
        await activate('synthetic-activation')
        expect((await sub()).status).toBe('CANCELED')
      })
      it('shares action-bound receipts and current ownership checks with cancellation', async () => {
        await prepareIssuance()
        await activate('synthetic-common-key')
        await expect(
          execute('cancel', 'synthetic-common-key')
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
        const staffMembership = await inspector.membership.findFirstOrThrow({
          where: { tenantId, userId: staff },
        })
        await expect(
          activate('synthetic-staff-key', {
            ...principal,
            userId: staff,
            membershipId: staffMembership.id,
            isOwner: true,
          })
        ).rejects.toMatchObject({ code: 'OWNER_REQUIRED' })
      })
      it.each([
        'profile',
        'consent',
        'environment',
        'courtesy',
        'failed',
      ] as const)(
        'rejects unsafe activation (%s) without receipt or outbox',
        async (reason) => {
          await prepareIssuance(reason !== 'consent')
          if (reason === 'profile')
            await scope.withProvisioningTransaction(tenantId, (tx) =>
              tx.organization.update({
                where: { id: tenantId },
                data: { documentNormalized: '00000000000000' },
              })
            )
          if (reason === 'environment')
            await inspector.subscription.update({
              where: { id },
              data: { providerEnvironment: 'production' },
            })
          if (reason === 'courtesy')
            await inspector.subscription.update({
              where: { id },
              data: {
                billingMode: 'COMPLIMENTARY',
                complimentaryReason: 'SYNTHETIC',
              },
            })
          if (reason === 'failed')
            await inspector.subscription.update({
              where: { id },
              data: { providerSync: 'FAILED' },
            })
          await expect(activate()).rejects.toBeInstanceOf(Error)
          expect(await receipts()).toHaveLength(0)
          expect(
            await inspector.platformOutboxEvent.count({
              where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
            })
          ).toBe(0)
        }
      )
      it('persists the customer before the recurring POST and never infers payment from creation', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteSubscription } = issuance()
        provider.createCustomer.mockImplementationOnce(async () => {
          expect(await sub()).toMatchObject({
            providerSync: 'PROCESSING',
            providerCustomerId: null,
          })
          return {
            id: 'cus_' + id,
            cpfCnpj: '11222333000181',
            externalReference: 'org:' + tenantId,
            notificationDisabled: true,
          }
        })
        provider.createSubscription.mockImplementationOnce(async () => {
          expect(await sub()).toMatchObject({
            providerSync: 'PROCESSING',
            providerCustomerId: 'cus_' + id,
            providerAttempts: 2,
          })
          return remoteSubscription
        })
        await run()
        expect(await sub()).toMatchObject({
          providerSync: 'SYNCED',
          status: 'INCOMPLETE',
          providerSubscriptionId: remoteSubscription.id,
        })
        expect(provider.createSubscription.mock.calls[0]![0]).toMatchObject({
          nextDueDate: '2026-10-04',
          externalReference: 'sub:' + id,
        })
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: id, topic: SUBSCRIPTION_RECONCILE_TOPIC },
          })
        ).toBe(1)
      })
      it('uses the trial end as first due date; automatic issuance starts in D-7 only', async () => {
        await prepareIssuance()
        await inspector.subscription.update({
          where: { id },
          data: { status: 'TRIALING', trialEndsAt: new Date('2026-10-15') },
        })
        const { worker, run, provider } = issuance()
        await worker.enqueue()
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
        instant = new Date('2026-10-08T16:00:00Z')
        await worker.enqueue()
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(1)
        await run()
        expect(provider.createSubscription.mock.calls[0]![0].nextDueDate).toBe(
          '2026-10-15'
        )
        expect((await sub()).status).toBe('TRIALING')
      })
      it('binds existing resources by verified references with no POST', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteCustomer, remoteSubscription } = issuance()
        provider.findCustomer.mockResolvedValue(remoteCustomer)
        provider.findSubscription.mockResolvedValue(remoteSubscription)
        await run()
        expect((await sub()).providerSync).toBe('SYNCED')
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect(provider.createSubscription).not.toHaveBeenCalled()
      })
      it.each(['customer', 'subscription'] as const)(
        'never repeats an uncertain %s POST and recovers by reference',
        async (phase) => {
          await prepareIssuance()
          await activate()
          const { provider, run, remoteCustomer, remoteSubscription } =
            issuance()
          const create =
            phase === 'customer'
              ? provider.createCustomer
              : provider.createSubscription
          create.mockRejectedValueOnce(
            new BillingProviderError('AMBIGUOUS', {
              reason: 'TIMEOUT',
              maybeApplied: true,
            })
          )
          await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
          expect((await sub()).providerSync).toBe('UNKNOWN')
          instant = new Date(instant.getTime() + 300_001)
          await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
          expect(create).toHaveBeenCalledTimes(1)
          instant = new Date(instant.getTime() + 300_001)
          if (phase === 'customer')
            provider.findCustomer.mockResolvedValue(remoteCustomer)
          else provider.findSubscription.mockResolvedValue(remoteSubscription)
          await run()
          expect((await sub()).providerSync).toBe('SYNCED')
          expect(create).toHaveBeenCalledTimes(1)
        }
      )
      it('durable PROCESSING after a crash is recovered through GET, never a repeated POST', async () => {
        await prepareIssuance()
        await activate()
        await inspector.subscription.update({
          where: { id },
          data: {
            providerSync: 'PROCESSING',
            providerAttempts: 1,
            providerNextAttemptAt: instant,
          },
        })
        const { provider, run } = issuance()
        await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect((await sub()).providerSync).toBe('UNKNOWN')
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect(provider.createSubscription).not.toHaveBeenCalled()
      })
      it('simultaneous workers reserve one customer POST and one recurrence POST', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteCustomer } = issuance()
        let release!: () => void, entered!: () => void
        const gate = new Promise<void>((resolve) => {
            release = resolve
          }),
          signal = new Promise<void>((resolve) => {
            entered = resolve
          })
        provider.createCustomer.mockImplementationOnce(async () => {
          entered()
          await gate
          return remoteCustomer
        })
        const first = run()
        await signal
        await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        release()
        await first
        expect(provider.createCustomer).toHaveBeenCalledTimes(1)
        expect(provider.createSubscription).toHaveBeenCalledTimes(1)
      })
      it('cancellation during recurrence creation binds history and durably compensates without reopening access', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteSubscription } = issuance()
        provider.createSubscription.mockImplementationOnce(async () => {
          await execute('cancel')
          return remoteSubscription
        })
        await run()
        expect(await sub()).toMatchObject({
          status: 'CANCELED',
          providerSubscriptionId: remoteSubscription.id,
          providerSync: 'SYNCED',
        })
        expect(await queued()).toHaveLength(1)
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).toMatchObject({ access: 'ARCHIVED' })
      })
      it('cancellation during customer creation stops before issuing a recurrence', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteCustomer } = issuance()
        provider.createCustomer.mockImplementationOnce(async () => {
          await execute('cancel')
          return remoteCustomer
        })
        await run()
        expect(await sub()).toMatchObject({
          status: 'CANCELED',
          providerCustomerId: remoteCustomer.id,
          providerSubscriptionId: null,
        })
        expect(provider.createSubscription).not.toHaveBeenCalled()
      })
      it.each(['customer', 'value', 'cycle', 'reference', 'status'] as const)(
        'mismatched remote binding is quarantined (%s)',
        async (mismatch) => {
          await prepareIssuance()
          await activate()
          const { provider, run, remoteSubscription } = issuance()
          provider.findSubscription.mockResolvedValue({
            ...remoteSubscription,
            ...(mismatch === 'customer'
              ? { customer: 'foreign' }
              : mismatch === 'value'
                ? { amount: new Prisma.Decimal('99.99') }
                : mismatch === 'cycle'
                  ? { cycle: 'YEARLY' }
                  : mismatch === 'reference'
                    ? { externalReference: 'sub:foreign' }
                    : { status: 'INACTIVE' }),
          })
          await run()
          expect(await sub()).toMatchObject({
            providerSync: 'FAILED',
            providerSubscriptionId: null,
          })
          expect(provider.createSubscription).not.toHaveBeenCalled()
        }
      )
      it('rejects forged tenant/payload or different provider environment before outbound calls', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run } = issuance()
        await expect(run('other')).rejects.toThrow(
          'INVALID_SUBSCRIPTION_ISSUANCE'
        )
        await expect(run(id, 'foreign-tenant')).rejects.toThrow(
          'SUBSCRIPTION_ISSUANCE_BINDING'
        )
        await inspector.subscription.update({
          where: { id },
          data: { providerEnvironment: 'production' },
        })
        await expect(run()).rejects.toThrow('SUBSCRIPTION_ISSUANCE_BINDING')
        expect(provider.findCustomer).not.toHaveBeenCalled()
      })
      it('rolls back activation receipt, provider state and outbox together on commit failure', async () => {
        await prepareIssuance()
        const command = createOwnerSubscriptionActivation({
          environment: 'sandbox',
          now: () => instant,
          transaction: (tenant, operation) =>
            scope.withProvisioningTransaction(tenant, async (tx) => {
              await operation(tx)
              throw new Error('synthetic-rollback')
            }),
        })
        await expect(
          command(principal, {
            key: 'synthetic-rollback-key',
            authenticatedAt: instant.getTime(),
          })
        ).rejects.toThrow('synthetic-rollback')
        expect((await sub()).providerSync).toBe('NOT_REQUIRED')
        expect(await receipts()).toHaveLength(0)
        expect(
          await inspector.platformOutboxEvent.count({
            where: { aggregateId: id, topic: SUBSCRIPTION_ISSUE_TOPIC },
          })
        ).toBe(0)
      })
      it('an uncertain canceled predecessor blocks a duplicate customer on the same organization', async () => {
        await prepareIssuance()
        await activate()
        await scope.withProvisioningTransaction(tenantId, (tx) =>
          tx.subscription.create({
            data: {
              id: id + '-predecessor',
              tenantId,
              planVersionId: version,
              status: 'CANCELED',
              billingMode: 'ASAAS',
              providerSync: 'UNKNOWN',
              providerEnvironment: 'sandbox',
              canceledAt: instant,
              cancelReason: 'OWNER_REQUEST',
            },
          })
        )
        const { provider, run } = issuance()
        await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect((await sub()).providerSync).toBe('PENDING')
      })
      it.each(['ACTIVE', 'INACTIVE'] as const)(
        'recovery after cancellation binds the ambiguous recurrence (%s) and compensates without another POST',
        async (remoteStatus) => {
          await prepareIssuance()
          await activate()
          const { provider, run, remoteSubscription } = issuance()
          provider.createSubscription.mockRejectedValueOnce(
            new BillingProviderError('AMBIGUOUS', {
              reason: 'TIMEOUT',
              maybeApplied: true,
            })
          )
          await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
          await execute('cancel')
          instant = new Date(instant.getTime() + 300_001)
          provider.findSubscription.mockResolvedValue({
            ...remoteSubscription,
            status: remoteStatus,
          })
          await run()
          expect(await sub()).toMatchObject({
            status: 'CANCELED',
            providerSubscriptionId: remoteSubscription.id,
          })
          expect(provider.createSubscription).toHaveBeenCalledTimes(1)
          expect((await queued()).length).toBeGreaterThan(0)
        }
      )
      it('a company profile changed during discovery cannot reach a creation POST', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run } = issuance()
        provider.findCustomer.mockImplementationOnce(async () => {
          await scope.withProvisioningTransaction(tenantId, (tx) =>
            tx.organization.update({
              where: { id: tenantId },
              data: { billingEmail: 'changed@example.invalid' },
            })
          )
          return null
        })
        await run()
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect(await sub()).toMatchObject({
          providerSync: 'FAILED',
          providerLastError: 'BILLING_PROFILE_CHANGED',
        })
      })
      it('another activation key never clears UNKNOWN or grants permission to retry a write', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run } = issuance()
        provider.createCustomer.mockRejectedValueOnce(
          new BillingProviderError('AMBIGUOUS', {
            reason: 'TIMEOUT',
            maybeApplied: true,
          })
        )
        await expect(run()).rejects.toBeInstanceOf(RetryDeliveryAtError)
        await activate('synthetic-second-intent')
        expect((await sub()).providerSync).toBe('UNKNOWN')
        expect(provider.createCustomer).toHaveBeenCalledTimes(1)
      })
      it('a mismatched recurrence discovered while UNKNOWN becomes FAILED without any repeated write', async () => {
        await prepareIssuance()
        await activate()
        const { provider, run, remoteSubscription } = issuance()
        await inspector.subscription.update({
          where: { id },
          data: { providerSync: 'UNKNOWN', providerCustomerId: 'cus_' + id },
        })
        provider.findSubscription.mockResolvedValue({
          ...remoteSubscription,
          externalReference: 'sub:foreign',
        })
        await run()
        expect((await sub()).providerSync).toBe('FAILED')
        expect(provider.createCustomer).not.toHaveBeenCalled()
        expect(provider.createSubscription).not.toHaveBeenCalled()
      })
    })
    it('schedules courtesy cancellation without archiving before its protected end; undo preserves history', async () => {
      expect(await execute('cancel', 'fixture-cancel')).toEqual({
        accepted: true,
      })
      expect(await sub()).toMatchObject({
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        cancelRequestedAt: instant,
        canceledAt: null,
      })
      expect(await queued()).toHaveLength(0)
      expect(await execute('undo-cancel', 'fixture-undo')).toEqual({
        accepted: true,
      })
      expect(await sub()).toMatchObject({
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
      })
      expect((await receipts()).map((r) => r.reason).sort()).toEqual([
        'CANCEL_REQUESTED',
        'CANCEL_UNDONE',
      ])
      expect(
        await inspector.organization.findUniqueOrThrow({
          where: { id: tenantId },
        })
      ).toMatchObject({ access: 'FULL' })
    })
    it('protects a newly paid cycle even when the persisted period has not yet been reconciled', async () => {
      await inspector.subscription.update({
        where: { id },
        data: {
          billingMode: 'ASAAS',
          complimentaryUntil: null,
          currentPeriodEnd: new Date('2026-10-01'),
        },
      })
      await inspector.platformInvoice.create({
        data: {
          tenantId,
          subscriptionId: id,
          status: 'PAID',
          providerPaymentId: 'fixture-payment-' + id,
          syncedAt: instant,
          amount: '149.90',
          dueDate: new Date('2026-10-01'),
          periodStart: new Date('2026-10-01'),
          periodEnd: new Date('2026-11-01'),
          paidAt: instant,
        },
      })
      await execute('cancel')
      expect(await sub()).toMatchObject({
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-11-01'),
        cancelAtPeriodEnd: true,
      })
      await execute('undo-cancel')
      expect((await sub()).cancelAtPeriodEnd).toBe(false)
      expect(await queued()).toHaveLength(0)
    })
    it.each(['SYNCED', 'UNKNOWN'] as const)(
      'trial cancellation is immediate and queues the existing provider worker (%s)',
      async (providerSync) => {
        await inspector.subscription.update({
          where: { id },
          data: {
            status: 'TRIALING',
            billingMode: 'ASAAS',
            complimentaryUntil: null,
            trialEndsAt: new Date('2026-10-15'),
            providerSync,
            providerEnvironment: 'sandbox',
            providerCustomerId: 'fixture-customer-' + id,
            providerSubscriptionId:
              providerSync === 'UNKNOWN' ? null : 'fixture-provider-' + id,
          },
        })
        await execute('cancel', 'trial-cancellation')
        expect(await sub()).toMatchObject({
          status: 'CANCELED',
          canceledAt: instant,
          cancelReason: 'OWNER_REQUEST',
        })
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).toMatchObject({ access: 'ARCHIVED' })
        expect(await queued()).toHaveLength(1)
        expect(await execute('cancel', 'trial-cancellation')).toEqual({
          accepted: true,
        })
        expect(await queued()).toHaveLength(1)
        await expect(execute('undo-cancel')).rejects.toMatchObject({
          status: 404,
          code: 'SUBSCRIPTION_NOT_FOUND',
        })
      }
    )
    it('rejects undo at the due date even if the scheduler has not projected cancellation yet', async () => {
      await execute('cancel')
      instant = new Date('2026-11-01T03:00:00Z')
      await expect(execute('undo-cancel')).rejects.toMatchObject({
        status: 409,
        code: 'CANCELLATION_ALREADY_DUE',
      })
      expect((await sub()).cancelAtPeriodEnd).toBe(true)
      expect(await receipts()).toHaveLength(1)
    })
    it('concurrent identical requests create exactly one immutable receipt and one revision', async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => execute('cancel', 'parallel-cancel'))
      )
      expect(results).toEqual(
        Array.from({ length: 4 }, () => ({ accepted: true }))
      )
      expect(await receipts()).toHaveLength(1)
      expect((await sub()).revision).toBe(2)
    })
    it('a repeated cancellation after undo cannot silently cancel again', async () => {
      await execute('cancel', 'old-cancel')
      await execute('undo-cancel', 'new-undo')
      await execute('cancel', 'old-cancel')
      expect((await sub()).cancelAtPeriodEnd).toBe(false)
      await expect(execute('undo-cancel', 'old-cancel')).rejects.toMatchObject({
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      })
      expect(await receipts()).toHaveLength(2)
    })
    it('even a no-op undo has a receipt, so its later retry cannot undo a new cancellation', async () => {
      await execute('undo-cancel', 'noop-undo')
      await execute('cancel', 'later-cancel')
      await execute('undo-cancel', 'noop-undo')
      expect((await sub()).cancelAtPeriodEnd).toBe(true)
      expect(await receipts()).toHaveLength(2)
    })
    it('receipt replay after a replacement subscription never changes the replacement', async () => {
      await execute('cancel', 'historic-cancel')
      await inspector.subscription.update({
        where: { id },
        data: { status: 'CANCELED', canceledAt: instant },
      })
      const replacement = await inspector.subscription.create({
        data: {
          tenantId,
          planVersionId: version,
          status: 'ACTIVE',
          billingMode: 'COMPLIMENTARY',
          complimentaryReason: 'SYNTHETIC_FIXTURE',
          complimentaryUntil: new Date('2026-12-01'),
        },
      })
      await execute('cancel', 'historic-cancel')
      expect(
        (
          await inspector.subscription.findUniqueOrThrow({
            where: { id: replacement.id },
          })
        ).cancelAtPeriodEnd
      ).toBe(false)
    })
    it.each([
      'stale',
      'future',
      'inactive-member',
      'nonowner',
      'foreign-tenant',
      'global-role',
    ] as const)(
      'rejects %s without changing facts or writing a receipt',
      async (condition) => {
        let actor = principal,
          timestamp = instant.getTime() - 30_000
        if (condition === 'stale') timestamp = instant.getTime() - 600_001
        if (condition === 'future') timestamp = instant.getTime() + 1
        if (condition === 'inactive-member') {
          await scope.withProvisioningTransaction(tenantId, async (tx) => {
            await tx.organization.update({
              where: { id: tenantId },
              data: { ownerUserId: staff },
            })
            await tx.membership.update({
              where: { id: principal.membershipId },
              data: { status: 'SUSPENDED' },
            })
          })
        }
        if (condition === 'nonowner') {
          const member = await inspector.membership.findFirstOrThrow({
            where: { tenantId, userId: staff },
          })
          actor = {
            ...principal,
            userId: staff,
            membershipId: member.id,
            isOwner: true,
          }
        }
        if (condition === 'foreign-tenant')
          actor = { ...principal, tenantId: 'foreign-tenant' }
        if (condition === 'global-role')
          actor = { ...principal, role: 'OPERATOR', isOwner: true }
        await expect(
          execute('cancel', 'invalid-command', actor, timestamp)
        ).rejects.toMatchObject({
          status: condition === 'stale' || condition === 'future' ? 401 : 403,
        })
        expect((await sub()).cancelAtPeriodEnd).toBe(false)
        expect(await receipts()).toHaveLength(0)
      }
    )
    it('revalidates the organization owner even when an old receipt and principal claim ownership', async () => {
      await execute('cancel', 'before-owner-transfer')
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: staff },
        })
      )
      await expect(
        execute('cancel', 'before-owner-transfer', {
          ...principal,
          isOwner: true,
        })
      ).rejects.toMatchObject({ status: 403, code: 'OWNER_REQUIRED' })
    })
    it('rolls back receipt, flag and projection when the enclosing transaction fails', async () => {
      const command = createOwnerSubscriptionCancellation({
        now: () => instant,
        transaction: (tenant, operation) =>
          scope.withProvisioningTransaction(tenant, async (tx) => {
            await operation(tx)
            throw new Error('fixture abort after write')
          }),
      })
      await expect(
        command(principal, {
          action: 'cancel',
          key: 'rollback-cancel',
          authenticatedAt: instant.getTime(),
        })
      ).rejects.toThrow('fixture abort')
      expect((await sub()).cancelAtPeriodEnd).toBe(false)
      expect(await receipts()).toHaveLength(0)
      expect(await queued()).toHaveLength(0)
    })
    it('a real concurrent ownership transfer wins before an old principal can write', async () => {
      let release!: () => void, entered!: () => void
      const locked = new Promise<void>((resolve) => {
        entered = resolve
      })
      const unlocked = new Promise<void>((resolve) => {
        release = resolve
      })
      const transfer = scope.withProvisioningTransaction(
        tenantId,
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
          entered()
          await unlocked
          await tx.organization.update({
            where: { id: tenantId },
            data: { ownerUserId: staff },
          })
        }
      )
      await locked
      const result = execute('cancel', 'racing-owner').catch((error) => error)
      try {
        await waitForLock('organizations')
      } finally {
        release()
        await transfer
      }
      expect(await result).toMatchObject({
        status: 403,
        code: 'OWNER_REQUIRED',
      })
      expect(await receipts()).toHaveLength(0)
      expect((await sub()).cancelAtPeriodEnd).toBe(false)
    }, 15_000)
    it('authentication expiring while waiting for a real subscription lock cannot authorize a write', async () => {
      let release!: () => void, entered!: () => void
      const locked = new Promise<void>((resolve) => {
        entered = resolve
      })
      const unlocked = new Promise<void>((resolve) => {
        release = resolve
      })
      const hold = scope.withProvisioningTransaction(tenantId, async (tx) => {
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${id} FOR UPDATE`
        entered()
        await unlocked
      })
      await locked
      const authenticatedAt = instant.getTime()
      const result = execute(
        'cancel',
        'racing-expiry',
        principal,
        authenticatedAt
      ).catch((error) => error)
      try {
        await waitForLock('subscriptions')
        instant = new Date(instant.getTime() + 600_001)
      } finally {
        release()
        await hold
      }
      expect(await result).toMatchObject({
        status: 401,
        code: 'FRESH_SESSION_REQUIRED',
      })
      expect(await receipts()).toHaveLength(0)
      expect((await sub()).cancelAtPeriodEnd).toBe(false)
    }, 15_000)
  }
)
