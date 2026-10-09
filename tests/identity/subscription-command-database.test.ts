import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from 'vitest'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createDriverService } from '../../packages/backend/src/modules/operations/drivers'
import { createPaymentRequests } from '../../packages/backend/src/modules/billing/payment-request'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import {
  createQuoteBoletos,
  type QuoteBoletoChargeReader,
} from '../../packages/backend/src/modules/quotations/boleto'
import { createRentalLifecycle } from '../../packages/backend/src/modules/rentals/lifecycle'
import { createQuoteConversion } from '../../packages/backend/src/modules/rentals/conversion'
import { createRentalAdministration } from '../../packages/backend/src/modules/rentals/administration'
import { createClientRentalRequests } from '../../packages/backend/src/modules/rentals/client-requests'
import { createClientRentalPortal } from '../../packages/backend/src/modules/rentals/client-portal'
import { createQuoteRequests } from '../../packages/backend/src/modules/quotations/quote-request'
import { createQuoteUpdates } from '../../packages/backend/src/modules/quotations/update'
import { createQuoteAdjustments } from '../../packages/backend/src/modules/quotations/adjustments'
import { createQuoteAdministration } from '../../packages/backend/src/modules/quotations/administration'
import { createClientQuotePortal } from '../../packages/backend/src/modules/quotations/client-portal'
import { createAdjustedQuoteDelivery } from '../../packages/backend/src/modules/quotations/adjusted-quote'
import { createRentalContracts } from '../../packages/backend/src/modules/documents/rental-contracts'
import { createWhatsAppClient } from '../../packages/backend/src/modules/communications/whatsapp-client'
import { createZohoMailCommands } from '../../packages/backend/src/modules/communications/zoho-command'
import { createZohoMailAttachmentUploader } from '../../packages/backend/src/http/zoho-attachment-upload'
import { createQuoteAdjustmentEffects } from '../../packages/backend/src/modules/communications/quote-adjustment-effects'
import { createFinancialMutations } from '../../packages/backend/src/modules/billing/financial-mutations'
import { createBoletoReissueRequest } from '../../packages/backend/src/modules/billing/boleto-reissue'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createOwnerSubscriptionReadHandlers } from '@gb-locacoes/backend/http'
import {
  SubscriptionSummarySchema,
  PlatformInvoicesResponseSchema,
} from '@gb-locacoes/contracts/subscription'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'transactional subscription admission with restricted RLS roles',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'command_' + suffix + '_test',
      role = 'command_' + suffix,
      platformRole = 'command_platform_' + suffix
    const instant = new Date('2026-10-03T12:00:00Z')
    let admin: Pool, db: Pool, pool: Pool, platformPool: Pool
    let inspector: PrismaClient,
      business: PrismaClient,
      platformClient: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      payments: ReturnType<typeof createPaymentRequests>
    let tenantId: string,
      ownerId: string,
      subscriptionId: string,
      versionId: string,
      counter = 0
    const platform = <T>(
      operation: (_tx: Prisma.TransactionClient) => Promise<T>
    ) => scope.withPlatformTransaction(operation)
    const plan = () =>
      platform(async (tx) => {
        const p = await tx.plan.create({
          data: {
            code: 'command-plan-' + ++counter,
            name: 'Synthetic admission fixture',
          },
        })
        return tx.planVersion.create({
          data: {
            planId: p.id,
            version: 1,
            amount: '0.00',
            entitlements: {
              schema: 1,
              limits: { equipments: 20, staffSeats: 3 },
              features: Object.fromEntries(
                ENTITLEMENT_FEATURES.map((key) => [key, false])
              ),
            },
          },
        })
      })
    const principal = () => ({
      tenantId,
      userId: ownerId,
      membershipId: 'fixture',
      role: 'ADMIN' as const,
      access: 'FULL' as const,
    })
    const create = () =>
      createDriverService(business).createDriver(principal(), {
        name: 'Synthetic driver',
        phone: '00000000',
      })
    const runner = () =>
      createRentalTransaction({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
      })
    const boletos = (readProviderCharge?: QuoteBoletoChargeReader) =>
      createQuoteBoletos({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
        withRentalTransaction: runner().withRentalTransaction,
        obligationError: (status, message, policy) =>
          new PaymentRequestError(status, message, policy),
        readProviderCharge,
      })
    const quote = () =>
      inspector.quote.create({
        data: {
          tenantId,
          name: 'Fixture',
          email: 'fixture@example.invalid',
          phone: '00000000000',
          cpf: '12345678909',
          total: 100,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      })
    const setAccess = (access: 'RESTRICTED' | 'ARCHIVED' | 'SETUP') =>
      platform((tx) =>
        tx.organization.update({ where: { id: tenantId }, data: { access } })
      )
    const override = (target: string, key = 'features.logistics') =>
      platform((tx) =>
        tx.entitlementOverride.create({
          data: {
            tenantId: target,
            key,
            value: true,
            reason: 'Synthetic override fixture',
            grantedByUserId: ownerId,
          },
        })
      )
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      db = new Pool({ connectionString: url.toString(), max: 2 })
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
      const attrs = 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT'
      const businessUrl = await createLoginRole(db, url.toString(), role, attrs)
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/app_runtime.sql', 'utf8')
          .replaceAll('app_runtime', role)
      )
      const platformUrl = await createLoginRole(
        db,
        url.toString(),
        platformRole,
        attrs
      )
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8')
          .replaceAll('platform_runtime', platformRole)
      )
      pool = new Pool({ connectionString: businessUrl, max: 4 })
      platformPool = new Pool({ connectionString: platformUrl, max: 1 })
      business = new PrismaClient({ adapter: new PrismaPg(pool) })
      platformClient = new PrismaClient({ adapter: new PrismaPg(platformPool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(platformClient)
      ownerId = (
        await inspector.user.create({
          data: { email: suffix + '@example.invalid' },
        })
      ).id
      const runner = createRentalTransaction({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
      })
      payments = createPaymentRequests({
        withRentalTransaction: runner.withRentalTransaction,
        readTenantProviderCharge: vi.fn(),
        resolveIntegrationCredential: async () => ({
          apiKey: 'synthetic-fixture',
          environment: 'sandbox',
        }),
      })
    }, 120_000)
    beforeEach(async () => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      versionId = (await plan()).id
      tenantId = 'command-tenant-' + ++counter
      await platform(async (tx) => {
        await tx.organization.create({
          data: {
            id: tenantId,
            slug: tenantId,
            name: tenantId,
            access: 'FULL',
            ownerUserId: ownerId,
          },
        })
        await tx.membership.create({
          data: { tenantId, userId: ownerId, role: 'ADMIN' },
        })
        subscriptionId = (
          await tx.subscription.create({
            data: { tenantId, planVersionId: versionId, status: 'ACTIVE' },
          })
        ).id
      })
    })
    afterAll(async () => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
      await business?.$disconnect()
      await inspector?.$disconnect()
      await platformClient?.$disconnect()
      await pool?.end()
      await platformPool?.end()
      await db?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        await admin.query('DROP ROLE IF EXISTS "' + role + '"')
        await admin.query('DROP ROLE IF EXISTS "' + platformRole + '"')
        await admin.end()
      }
    })
    describe('owner subscription read models', () => {
      const ownerPrincipal = async () => ({
        ...principal(),
        membershipId: (
          await inspector.membership.findFirstOrThrow({
            where: { tenantId, userId: ownerId },
          })
        ).id,
      })
      const reader = () =>
        createOwnerSubscriptionReadHandlers({
          withTenantTransaction: (context, operation, options) =>
            withTenantTransaction(
              business,
              context,
              async (tx) => {
                const result = await operation(tx)
                expect(
                  await tx.$queryRawUnsafe('SHOW transaction_read_only')
                ).toEqual([{ transaction_read_only: 'on' }])
                return result
              },
              options
            ),
          now: () => instant,
        })
      it.each([
        'INCOMPLETE',
        'TRIALING',
        'ACTIVE',
        'PAST_DUE',
        'SUSPENDED',
        'CANCELED',
      ] as const)(
        'reads persisted %s using a non-bypass business role in a read-only snapshot',
        async (status) => {
          const access =
            status === 'INCOMPLETE'
              ? 'SETUP'
              : status === 'SUSPENDED'
                ? 'RESTRICTED'
                : status === 'CANCELED'
                  ? 'ARCHIVED'
                  : 'FULL'
          await platform(async (tx) => {
            await tx.subscription.update({
              where: { id: subscriptionId },
              data: {
                status,
                canceledAt: status === 'CANCELED' ? instant : null,
              },
            })
            await tx.organization.update({
              where: { id: tenantId },
              data: { access },
            })
          })
          const response = await reader().readOwnerSubscription(
            await ownerPrincipal()
          )
          expect(response.status).toBe(200)
          expect(
            SubscriptionSummarySchema.parse(await response.json())
          ).toMatchObject({
            status,
            access,
            plan: { amount: '0.00' },
            usage: { equipments: 0, staffSeats: 1 },
          })
        }
      )
      it('revalidates a transferred owner even with stale owner and FULL principal metadata', async () => {
        const stale = { ...(await ownerPrincipal()), isOwner: true }
        const peer = await inspector.user.create({
          data: { email: randomUUID() + '@example.invalid' },
        })
        await platform(async (tx) => {
          await tx.membership.create({
            data: { tenantId, userId: peer.id, role: 'ADMIN' },
          })
          await tx.organization.update({
            where: { id: tenantId },
            data: { ownerUserId: peer.id },
          })
        })
        for (const read of [
          reader().readOwnerSubscription,
          reader().readOwnerInvoices,
        ]) {
          const response = await read(stale)
          expect(response.status).toBe(403)
          expect(await response.json()).toMatchObject({
            code: 'OWNER_REQUIRED',
          })
        }
      })
      it('does not replace a missing or foreign membership with another ADMIN membership', async () => {
        const actor = {
          ...(await ownerPrincipal()),
          membershipId: 'foreign-membership',
          isOwner: true,
        }
        expect((await reader().readOwnerSubscription(actor)).status).toBe(403)
        expect((await reader().readOwnerInvoices(actor)).status).toBe(403)
      })
      it('includes active staff and equipment models with tenant exceptions, not clients or physical units', async () => {
        const active = await inspector.user.create({
          data: { email: randomUUID() + '@example.invalid' },
        })
        const inactive = await inspector.user.create({
          data: { email: randomUUID() + '@example.invalid' },
        })
        const client = await inspector.user.create({
          data: { email: randomUUID() + '@example.invalid' },
        })
        await platform(async (tx) => {
          await tx.membership.createMany({
            data: [
              { tenantId, userId: active.id, role: 'OPERATOR' },
              {
                tenantId,
                userId: inactive.id,
                role: 'OPERATOR',
                status: 'REVOKED',
              },
              { tenantId, userId: client.id, role: 'CLIENT' },
            ],
          })
          await tx.entitlementOverride.create({
            data: {
              tenantId,
              key: 'limits.equipments',
              value: 40,
              reason: 'Synthetic read fixture',
              grantedByUserId: ownerId,
              createdAt: instant,
            },
          })
        })
        await withTenantTransaction(business, { tenantId }, async (tx) => {
          const category = await tx.category.create({
            data: {
              tenantId,
              name: 'Read fixture',
              slug: 'read-fixture-' + counter,
            },
          })
          return tx.equipment.create({
            data: {
              tenantId,
              categoryId: category.id,
              images: [],
              name: 'Read fixture model',
              pricePerDay: '1.00',
            },
          })
        })
        const response = await reader().readOwnerSubscription(
          await ownerPrincipal()
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          usage: { equipments: 1, staffSeats: 2 },
          entitlements: { limits: { equipments: 40 } },
        })
      })
      it('reads invoices across canceled and current subscriptions without leaking provider or billing data', async () => {
        await platform(async (tx) => {
          await tx.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'CANCELED', canceledAt: instant },
          })
          const current = await tx.subscription.create({
            data: { tenantId, planVersionId: versionId, status: 'ACTIVE' },
          })
          await tx.platformInvoice.createMany({
            data: [subscriptionId, current.id].map((id, index) => ({
              tenantId,
              subscriptionId: id,
              providerPaymentId: randomUUID(),
              amount: '149.90',
              dueDate: new Date('2026-10-04T00:00:00Z'),
              syncedAt: instant,
              invoiceUrl: 'https://www.asaas.com/i/read-fixture',
              billingType: 'PIX',
              id: 'read-' + randomUUID(),
              createdAt: new Date(instant.getTime() + index),
            })),
          })
        })
        const response = await reader().readOwnerInvoices(
          await ownerPrincipal()
        )
        expect(response.status).toBe(200)
        const result = PlatformInvoicesResponseSchema.parse(
          await response.json()
        )
        expect(result.invoices).toHaveLength(2)
        expect(result.invoices.map((i) => i.amount)).toEqual([
          '149.90',
          '149.90',
        ])
        expect(JSON.stringify(result)).not.toMatch(
          /providerPaymentId|subscriptionId|tenantId|providerStatus/
        )
        expect(
          (await reader().readOwnerSubscription(await ownerPrincipal())).status
        ).toBe(200)
      })
      it('refuses inconsistent projection instead of silently changing stored commercial state', async () => {
        await setAccess('ARCHIVED')
        const response = await reader().readOwnerSubscription(
          await ownerPrincipal()
        )
        expect(response.status).toBe(503)
        expect(
          (
            await inspector.subscription.findUniqueOrThrow({
              where: { id: subscriptionId },
            })
          ).status
        ).toBe('ACTIVE')
      })
      it('bounds invoice history to the newest 100 rows in a deterministic order', async () => {
        await platform((tx) =>
          tx.platformInvoice.createMany({
            data: Array.from({ length: 101 }, (_, index) => ({
              id: 'read-limit-' + randomUUID(),
              tenantId,
              subscriptionId,
              providerPaymentId: randomUUID(),
              amount: '10.00',
              dueDate: new Date('2026-10-04T00:00:00Z'),
              syncedAt: instant,
              createdAt: new Date(instant.getTime() + index),
            })),
          })
        )
        const expected = await inspector.platformInvoice.findMany({
          where: { tenantId },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
          select: { id: true },
        })
        const response = await reader().readOwnerInvoices(
          await ownerPrincipal()
        )
        expect(response.status).toBe(200)
        const result = PlatformInvoicesResponseSchema.parse(
          await response.json()
        )
        expect(result.invoices).toHaveLength(100)
        expect(result.invoices.map((i) => i.id)).toEqual(
          expected.map((i) => i.id)
        )
        expect(
          await inspector.platformInvoice.count({ where: { tenantId } })
        ).toBe(101)
      })
    })
    it('uses a non-owner role without RLS bypass or platform write permission', async () => {
      expect(
        (
          await pool.query(
            'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
          )
        ).rows
      ).toEqual([{ rolsuper: false, rolbypassrls: false }])
      expect(await business.subscription.findMany()).toEqual([])
      await expect(
        withTenantTransaction(business, { tenantId }, (tx) =>
          tx.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'SUSPENDED' },
          })
        )
      ).rejects.toThrow()
    })
    it('current module denial leaves no driver, and only this tenant override enables it', async () => {
      await expect(create()).rejects.toMatchObject({
        status: 402,
        policy: { code: 'MODULE_NOT_IN_PLAN', feature: 'logistics' },
      })
      const foreign = 'command-foreign-' + ++counter
      await platform((tx) =>
        tx.organization.create({
          data: { id: foreign, slug: foreign, name: foreign },
        })
      )
      await override(foreign)
      await expect(create()).rejects.toMatchObject({ status: 402 })
      expect(await inspector.driver.count({ where: { tenantId } })).toBe(0)
      await override(tenantId)
      expect((await create()).tenantId).toBe(tenantId)
    })
    it.each(['access', 'plan'] as const)(
      'holds the organization lock until driver INSERT commits during %s change',
      async (change) => {
        await override(tenantId)
        let entered!: () => void, release!: () => void
        const atInsert = new Promise<void>((resolve) => {
          entered = resolve
        })
        const resume = new Promise<void>((resolve) => {
          release = resolve
        })
        const paused = new Proxy(business, {
          get(target, key, receiver) {
            if (key === '$transaction')
              return (
                operation: (_tx: Prisma.TransactionClient) => Promise<unknown>,
                options: unknown
              ) =>
                target.$transaction(async (tx) => {
                  const driver = new Proxy(tx.driver, {
                    get(model, method) {
                      if (method === 'create')
                        return async (
                          input: Parameters<typeof tx.driver.create>[0]
                        ) => {
                          entered()
                          await resume
                          return model.create(input)
                        }
                      return Reflect.get(model, method)
                    },
                  })
                  return operation(
                    new Proxy(tx, {
                      get(model, method) {
                        return method === 'driver'
                          ? driver
                          : Reflect.get(model, method)
                      },
                    })
                  )
                }, options as never)
            return Reflect.get(target, key, receiver)
          },
        })
        const writing = createDriverService(paused).createDriver(principal(), {
          name: 'Locked fixture',
          phone: '000',
        })
        await atInsert
        const changing = platform(async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
          if (change === 'access')
            await tx.organization.update({
              where: { id: tenantId },
              data: { access: 'RESTRICTED' },
            })
          else
            await tx.entitlementOverride.updateMany({
              where: { tenantId, key: 'features.logistics' },
              data: { revokedAt: new Date() },
            })
        })
        try {
          await vi.waitFor(
            async () => {
              const rows = await db.query(
                "SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",
                [platformRole]
              )
              expect(rows.rowCount).toBe(1)
            },
            { timeout: 2000, interval: 20 }
          )
        } finally {
          release()
          await Promise.all([writing, changing])
        }
        await expect(create()).rejects.toMatchObject({
          status: 402,
          policy: {
            code:
              change === 'access'
                ? 'SUBSCRIPTION_RESTRICTED'
                : 'MODULE_NOT_IN_PLAN',
          },
        })
        expect(await inspector.driver.count({ where: { tenantId } })).toBe(1)
        expect(
          (await createDriverService(business).listDrivers(principal())).length
        ).toBe(1)
      }
    )
    it('shadow rolls back a real SQL permission failure and still commits the command', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await db.query('REVOKE SELECT ON subscriptions FROM "' + role + '"')
      try {
        expect((await create()).tenantId).toBe(tenantId)
        expect(warning).toHaveBeenCalledWith('[subscription-command-shadow]', {
          tenantId,
          code: 'SUBSCRIPTION_POLICY_UNAVAILABLE',
        })
      } finally {
        await db.query('GRANT SELECT ON subscriptions TO "' + role + '"')
      }
      expect(await inspector.driver.count({ where: { tenantId } })).toBe(1)
    })
    it('off preserves legacy command behavior without a plan lookup', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
      await platform((tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { access: 'RESTRICTED' },
        })
      )
      await db.query('REVOKE SELECT ON subscriptions FROM "' + role + '"')
      try {
        expect((await create()).tenantId).toBe(tenantId)
      } finally {
        await db.query('GRANT SELECT ON subscriptions TO "' + role + '"')
      }
    })
    const rental = async () => {
      await inspector.clientProfile.create({
        data: {
          tenantId,
          userId: ownerId,
          name: 'Fixture owner',
          email: 'owner@example.invalid',
          document: '12345678909',
        },
      })
      await inspector.tenantIntegration.create({
        data: {
          tenantId,
          provider: 'ASAAS',
          credentialsRef: 'env:LOCADORA_INTEGRATION_FIXTURE',
        },
      })
      return inspector.rentals.create({
        data: {
          id: 'command-rental-' + ++counter,
          tenantId,
          userid: ownerId,
          startdate: instant,
          enddate: new Date('2026-10-10T12:00:00Z'),
          total: '10.00',
          status: 'ACTIVE',
          checkOutAt: new Date(instant.getTime() - 1000),
        },
      })
    }
    it.each(['RESTRICTED', 'ARCHIVED'] as const)(
      'manual quote in %s writes nothing; accepted issuance continues in RLS',
      async (access) => {
        const q = await quote()
        await setAccess(access)
        await expect(
          boletos().requestQuoteBoletoPayment(principal(), q.id)
        ).rejects.toMatchObject({ status: access === 'ARCHIVED' ? 403 : 402 })
        expect(await inspector.payment.count({ where: { tenantId } })).toBe(0)
        expect(await inspector.outboxEvent.count({ where: { tenantId } })).toBe(
          0
        )
        const accepted = await boletos().ensureQuoteBoletoPayment(
          { tenantId },
          q.id
        )
        expect(accepted).toMatchObject({
          amount: 100,
          processing: 'PENDING',
          created: true,
        })
        expect(
          await inspector.outboxEvent.count({
            where: { tenantId, topic: 'payment.issue' },
          })
        ).toBe(1)
      }
    )
    it('manual quote reads current module and scoped override; repeated requests reuse one obligation', async () => {
      const q = await quote()
      await expect(
        boletos().requestQuoteBoletoPayment(principal(), q.id)
      ).rejects.toMatchObject({
        policy: { code: 'MODULE_NOT_IN_PLAN', feature: 'onlinePayments' },
      })
      expect(await inspector.payment.count({ where: { tenantId } })).toBe(0)
      await override(tenantId, 'features.onlinePayments')
      const first = await boletos().requestQuoteBoletoPayment(principal(), q.id)
      expect(
        await boletos().requestQuoteBoletoPayment(principal(), q.id)
      ).toMatchObject({ paymentId: first.paymentId, created: false })
      expect(await inspector.payment.count({ where: { tenantId } })).toBe(1)
      expect(await inspector.outboxEvent.count({ where: { tenantId } })).toBe(1)
    })
    it('provider proof commits but a downgrade between transactions prevents a new manual charge', async () => {
      const q = await quote()
      await override(tenantId, 'features.onlinePayments')
      const integration = await inspector.tenantIntegration.create({
        data: {
          tenantId,
          provider: 'ASAAS',
          credentialsRef: 'env:LOCADORA_INTEGRATION_FIXTURE',
        },
      })
      const old = await inspector.payment.create({
        data: {
          tenantId,
          quoteId: q.id,
          amount: 100,
          method: 'BOLETO',
          type: 'RENTAL',
          status: 'CANCELLED',
          dueDate: new Date('2031-06-10'),
          transactionId: 'fixture-old',
        },
      })
      const read = vi.fn(async () => {
        // This update would wait forever if the provider read retained the organization lock.
        await setAccess('RESTRICTED')
        return {
          integrationId: integration.id,
          charge: {
            id: 'fixture-old',
            value: 100,
            externalReference: 'legacy-fixture',
            billingType: 'BOLETO',
            status: 'PENDING',
            deleted: true,
          },
        }
      })
      await expect(
        boletos(read).requestQuoteBoletoPayment(principal(), q.id)
      ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
      expect(read).toHaveBeenCalledTimes(1)
      expect(await inspector.payment.count({ where: { tenantId } })).toBe(1)
      expect(
        await inspector.paymentAttempt.count({
          where: {
            tenantId,
            paymentId: old.id,
            status: 'CANCELLED',
            cancellationStatus: 'CONFIRMED',
          },
        })
      ).toBe(1)
      expect(
        await inspector.outboxEvent.count({
          where: { tenantId, topic: 'payment.issue' },
        })
      ).toBe(0)
    }, 20_000)
    const customerRental = async () => {
      const user = await inspector.user.create({
        data: { email: 'client-' + randomUUID() + '@example.invalid' },
      })
      await platform((tx) =>
        tx.membership.create({
          data: { tenantId, userId: user.id, role: 'CLIENT' },
        })
      )
      return inspector.rentals.create({
        data: {
          id: 'return-' + randomUUID(),
          tenantId,
          userid: user.id,
          startdate: new Date(),
          enddate: new Date('2031-06-10'),
          total: 10,
          status: 'ACTIVE',
          checkOutAt: new Date(),
        },
      })
    }
    const lifecycle = () =>
      createRentalLifecycle({
        withRentalTransaction: runner().withRentalTransaction,
        assertRentalItemsAvailability: async () => {
          throw new Error('Return/close must not reserve new inventory')
        },
        getMissingClientDocuments: async () => [],
      })
    const manualFixture = async () => {
      const row = await customerRental()
      const category = await inspector.category.create({
        data: { tenantId, name: 'Fixture', slug: 'fixture-' + ++counter },
      })
      const equipment = await inspector.equipment.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: 'Synthetic equipment',
          description: 'Fixture',
          pricePerDay: 10,
          maxStock: 20,
          images: [],
        },
      })
      const q = await quote()
      await inspector.quote.update({
        where: { id: q.id },
        data: { userId: row.userid },
      })
      const customer = {
        ...principal(),
        userId: row.userid,
        role: 'CLIENT' as const,
      }
      const transaction = {
        withTenantTransaction: <T>(
          context: { tenantId: string },
          operation: (_tx: Prisma.TransactionClient) => Promise<T>
        ) => withTenantTransaction(business, context, operation),
        withRentalTransaction: runner().withRentalTransaction,
      }
      const availability = vi.fn(async () => {})
      const cycle = createRentalLifecycle({
        ...transaction,
        assertRentalItemsAvailability: availability,
        getMissingClientDocuments: async () => [],
      })
      const conversion = createQuoteConversion({
        ...transaction,
        assertRentalItemsAvailability: availability,
      })
      const rentalAdmin = createRentalAdministration({
        ...transaction,
        ...conversion,
        ...cycle,
      })
      const quoteAdmin = createQuoteAdministration(transaction)
      const updates = createQuoteUpdates({
        ...transaction,
        ...conversion,
        isEquipmentAvailableForRental: async () => true,
        autoGenerateBoletoOnApproval: () => false,
      })
      const requests = createQuoteRequests({
        ...transaction,
        assertRentalItemsAvailability: availability,
      })
      const adjustments = createQuoteAdjustments(transaction)
      const quotePortal = createClientQuotePortal(transaction)
      const rentalPortal = createClientRentalPortal(transaction)
      const clientRequests = createClientRentalRequests(transaction)
      const input = {
        userId: row.userid,
        startDate: new Date('2031-06-01'),
        endDate: new Date('2031-06-03'),
        items: [
          {
            equipmentId: equipment.id,
            quantity: 1,
            days: 3,
            pricePerDay: new Prisma.Decimal(10),
          },
        ],
      }
      return {
        row,
        q,
        customer,
        equipment,
        availability,
        cycle,
        conversion,
        rentalAdmin,
        quoteAdmin,
        updates,
        requests,
        adjustments,
        quotePortal,
        rentalPortal,
        clientRequests,
        input,
      }
    }
    const communicationFixture = async () => {
      const f = await manualFixture()
      const transaction = {
        withTenantTransaction: <T>(
          context: { tenantId: string },
          operation: (_tx: Prisma.TransactionClient) => Promise<T>
        ) => withTenantTransaction(business, context, operation),
        withRentalTransaction: runner().withRentalTransaction,
      }
      await inspector.clientProfile.create({
        data: {
          tenantId,
          userId: f.row.userid,
          name: 'Synthetic signer',
          email: 'signer@example.invalid',
        },
      })
      await inspector.quote.update({
        where: { id: f.q.id },
        data: {
          finalTotal: 100,
          priceAdjustmentReason: 'Synthetic adjustment',
          priceAdjustedAt: instant,
        },
      })
      await inspector.tenantIntegration.createMany({
        data: [
          {
            tenantId,
            provider: 'WHATSAPP',
            externalAccountId: '11111111',
            credentialsRef: 'env:LOCADORA_INTEGRATION_TEST',
          },
          {
            tenantId,
            provider: 'ZAPSIGN',
            credentialsRef: 'env:LOCADORA_INTEGRATION_TEST',
          },
        ],
      })
      const contract = await inspector.contract.create({
        data: {
          tenantId,
          rentalId: f.row.id,
          content: '<p>Synthetic contract</p>',
          status: 'DRAFT',
        },
      })
      const credentials = vi.fn(async () => ({
        apiKey: 'synthetic-fixture-only',
        environment: 'sandbox',
      }))
      const network = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ messages: [{ id: 'provider-fixture' }] })
          )
        )
      const documents = createRentalContracts({
        ...transaction,
        resolveIntegrationCredential: credentials,
      })
      const whatsapp = createWhatsAppClient({
        ...transaction,
        resolveIntegrationCredential: credentials,
        fetch: network,
      })
      const delivery = createAdjustedQuoteDelivery(transaction)
      return {
        ...f,
        transaction,
        contract,
        credentials,
        network,
        documents,
        whatsapp,
        delivery,
      }
    }
    const communicationSnapshot = async () => ({
      contracts: await inspector.contract.findMany({ where: { tenantId } }),
      attempts: await inspector.contractSignatureAttempt.findMany({
        where: { tenantId },
      }),
      conversations: await inspector.whatsAppConversation.findMany({
        where: { tenantId },
      }),
      messages: await inspector.whatsAppMessage.findMany({
        where: { tenantId },
      }),
      outbox: await inspector.outboxEvent.findMany({ where: { tenantId } }),
      notifications: await inspector.notification.findMany({
        where: { tenantId },
      }),
    })
    const communicationCommands = [
      [
        'WhatsApp',
        (f: Awaited<ReturnType<typeof communicationFixture>>) =>
          f.whatsapp.sendTextMessage(
            principal(),
            '551100000001',
            'Synthetic message'
          ),
      ],
      [
        'contract draft',
        (f: Awaited<ReturnType<typeof communicationFixture>>) =>
          f.documents.generateRentalContract(principal(), f.row.id),
      ],
      [
        'contract signature',
        (f: Awaited<ReturnType<typeof communicationFixture>>) =>
          f.documents.requestContractSignature(principal(), f.contract.id),
      ],
      [
        'adjusted quote delivery',
        (f: Awaited<ReturnType<typeof communicationFixture>>) =>
          f.delivery.requestAdjustedQuoteDelivery(principal(), f.q.id),
      ],
    ] as const
    describe.each(['SETUP', 'RESTRICTED', 'ARCHIVED'] as const)(
      '%s refuses manual durable communication',
      (access) => {
        it.each(communicationCommands)(
          '%s changes no record, intent or provider',
          async (_name, command) => {
            const f = await communicationFixture()
            await setAccess(access)
            const before = await communicationSnapshot()
            await expect(command(f)).rejects.toMatchObject({
              status: access === 'ARCHIVED' ? 403 : 402,
            })
            expect(await communicationSnapshot()).toEqual(before)
            expect(f.network).not.toHaveBeenCalled()
          }
        )
      }
    )
    it.each(['whatsapp', 'contractSignature'] as const)(
      '%s uses the current tenant feature before creating durable intent',
      async (feature) => {
        const f = await communicationFixture()
        const command = () =>
          feature === 'whatsapp'
            ? f.whatsapp.sendTextMessage(
                principal(),
                '551100000001',
                'Synthetic message'
              )
            : f.documents.requestContractSignature(principal(), f.contract.id)
        const before = await communicationSnapshot()
        await expect(command()).rejects.toMatchObject({ status: 402 })
        expect(await communicationSnapshot()).toEqual(before)
        expect(f.network).not.toHaveBeenCalled()
        await override(tenantId, 'features.' + feature)
        await command()
        if (feature === 'whatsapp') {
          expect(
            await inspector.whatsAppMessage.count({
              where: { tenantId, status: 'sent' },
            })
          ).toBe(1)
          expect(f.network).toHaveBeenCalledTimes(1)
        } else {
          await command()
          expect(
            await inspector.contractSignatureAttempt.count({
              where: { tenantId },
            })
          ).toBe(1)
          expect(
            await inspector.outboxEvent.count({
              where: { tenantId, topic: 'contract.signature.request' },
            })
          ).toBe(1)
        }
      }
    )
    it('draft generation and adjusted delivery need FULL but not the premium signature or inbox module', async () => {
      const f = await communicationFixture()
      expect(
        (await f.documents.generateRentalContract(principal(), f.row.id))
          .content
      ).toContain('Synthetic signer')
      await f.delivery.requestAdjustedQuoteDelivery(principal(), f.q.id)
      await f.delivery.requestAdjustedQuoteDelivery(principal(), f.q.id)
      expect(
        await inspector.outboxEvent.count({
          where: { tenantId, topic: 'quote.adjustment.notify' },
        })
      ).toBe(1)
      expect(f.credentials).not.toHaveBeenCalled()
      expect(f.network).not.toHaveBeenCalled()
    })
    it('missing and foreign ownership stay neutral before subscription refusal', async () => {
      const f = await communicationFixture()
      await setAccess('ARCHIVED')
      await expect(
        f.documents.generateRentalContract(principal(), 'foreign')
      ).rejects.toMatchObject({ status: 404, policy: undefined })
      await expect(
        f.documents.requestContractSignature(
          { ...principal(), role: 'CLIENT' },
          f.contract.id
        )
      ).rejects.toMatchObject({ status: 404, policy: undefined })
      await expect(
        f.delivery.requestAdjustedQuoteDelivery(principal(), 'foreign')
      ).rejects.toMatchObject({ status: 404, policy: undefined })
      expect(f.network).not.toHaveBeenCalled()
    })
    it.each(['sent', 'unknown'] as const)(
      'WhatsApp accepted before downgrade completes as %s without replaying admission',
      async (status) => {
        const f = await communicationFixture()
        await override(tenantId, 'features.whatsapp')
        f.network.mockImplementation(async () => {
          const rows = await inspector.whatsAppMessage.findMany({
            where: { tenantId },
          })
          expect(rows).toHaveLength(1)
          expect(rows[0]!.status).toBe('processing')
          await setAccess('RESTRICTED')
          if (status === 'unknown')
            throw new Error('Synthetic provider ambiguity')
          return new Response(
            JSON.stringify({ messages: [{ id: 'provider-fixture' }] })
          )
        })
        const sending = f.whatsapp.sendTextMessage(
          principal(),
          '551100000001',
          'Synthetic message'
        )
        if (status === 'unknown')
          await expect(sending).rejects.toThrow('WHATSAPP_DELIVERY_UNCONFIRMED')
        else expect((await sending).providerMessageId).toBe('provider-fixture')
        expect(
          await inspector.whatsAppMessage.count({ where: { tenantId, status } })
        ).toBe(1)
        expect(f.network).toHaveBeenCalledTimes(1)
        await expect(
          f.whatsapp.sendTextMessage(principal(), '551100000001', 'New request')
        ).rejects.toMatchObject({ status: 402 })
        expect(f.network).toHaveBeenCalledTimes(1)
        expect(
          await inspector.whatsAppMessage.count({ where: { tenantId } })
        ).toBe(1)
      }
    )
    it.each(['RESTRICTED', 'ARCHIVED'] as const)(
      'an accepted adjusted quote still delivers in %s',
      async (access) => {
        const f = await communicationFixture()
        await f.delivery.requestAdjustedQuoteDelivery(principal(), f.q.id)
        const event = await inspector.outboxEvent.findFirstOrThrow({
          where: { tenantId, topic: 'quote.adjustment.notify' },
        })
        await setAccess(access)
        const send = vi
          .fn()
          .mockResolvedValue({ data: { id: 'local-mail' }, error: null })
        const effects = createQuoteAdjustmentEffects({
          ...f.transaction,
          loadTenantBranding: async () => ({
            name: 'Fixture',
            publicBaseUrl: 'https://fixture.example.invalid',
            logoUrl: null,
            phone: null,
            contactEmail: null,
            address: null,
          }),
          getResend: () =>
            ({ emails: { send } }) as unknown as Pick<
              import('resend').Resend,
              'emails'
            >,
          fromEmail: () => 'fixture@example.invalid',
          generateQuoteStatusChangeEmailHTML: () => '<p>Fixture</p>',
        })
        await effects.runQuoteAdjustmentEffects(
          principal(),
          event.id,
          event.payload
        )
        await effects.runQuoteAdjustmentEffects(
          principal(),
          event.id,
          event.payload
        )
        expect(
          await inspector.notification.count({ where: { tenantId } })
        ).toBe(1)
        expect(send).toHaveBeenCalledWith(expect.anything(), {
          idempotencyKey: 'quote-adjusted-' + event.id,
        })
        await expect(
          f.delivery.requestAdjustedQuoteDelivery(principal(), f.q.id)
        ).rejects.toMatchObject({ status: access === 'ARCHIVED' ? 403 : 402 })
      }
    )
    const manualCommands = [
      [
        'quote create',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.requests.createQuoteRequest(
            principal(),
            {
              customerName: 'Fixture',
              customerEmail: 'fixture@example.invalid',
              customerPhone: '000',
              items: [{ equipmentId: f.equipment.id, quantity: 1, days: 3 }],
            },
            f.customer.userId
          ),
      ],
      [
        'quote update',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.updates.updateQuote(principal(), f.q.id, { name: 'Changed' }),
      ],
      [
        'quote delete',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.quoteAdmin.deleteQuote(principal(), f.q.id),
      ],
      [
        'quote adjustment',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.adjustments.createQuoteAdjustment(principal(), f.q.id, {
            category: 'OTHER',
            amount: 1,
            justification: 'Fixture',
            sendEmail: true,
            sendWhatsapp: true,
          }),
      ],
      [
        'quote conversion',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.conversion.convertQuoteToRental(principal(), f.q.id),
      ],
      [
        'quote hide',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.quotePortal.hideClientQuote(f.customer, f.q.id),
      ],
      [
        'rental create',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.cycle.createManualRental(principal(), f.input),
      ],
      [
        'rental checkout',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.cycle.checkoutRental(principal(), f.row.id),
      ],
      [
        'rental extend',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.cycle.extendRental(principal(), f.row.id, { additionalDays: 2 }),
      ],
      [
        'rental late fee',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.rentalAdmin.applyRentalLateFee(principal(), f.row.id),
      ],
      [
        'rental pickup request',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.clientRequests.requestClientRentalAction(
            f.customer,
            f.row.id,
            'PICKUP'
          ),
      ],
      [
        'rental extension request',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.clientRequests.requestClientRentalAction(
            f.customer,
            f.row.id,
            'EXTENSION',
            2
          ),
      ],
      [
        'rental hide',
        (f: Awaited<ReturnType<typeof manualFixture>>) =>
          f.rentalPortal.hideClientRental(f.customer, f.row.id),
      ],
    ] as const
    describe.each(['SETUP', 'RESTRICTED', 'ARCHIVED'] as const)(
      '%s manual admission revalidates stale FULL in RLS',
      (access) => {
        it.each(manualCommands)(
          '%s writes no business data or deferred effect',
          async (_name, command) => {
            const f = await manualFixture()
            await setAccess(access)
            const snapshot = async () => ({
              quotes: await inspector.quote.findMany({ where: { tenantId } }),
              rentals: await inspector.rentals.findMany({
                where: { tenantId },
              }),
              adjustments: await inspector.quoteAdjustment.count({
                where: { tenantId },
              }),
              payments: await inspector.payment.count({ where: { tenantId } }),
              notifications: await inspector.notification.count({
                where: { tenantId },
              }),
              audit: await inspector.auditLog.count({ where: { tenantId } }),
              outbox: await inspector.outboxEvent.count({
                where: { tenantId },
              }),
            })
            const before = await snapshot()
            await expect(command(f)).rejects.toMatchObject({
              status: access === 'ARCHIVED' ? 403 : 402,
              policy: {
                code:
                  access === 'ARCHIVED'
                    ? 'TENANT_ARCHIVED'
                    : 'SUBSCRIPTION_RESTRICTED',
              },
            })
            expect(await snapshot()).toEqual(before)
            expect(f.availability).not.toHaveBeenCalled()
          }
        )
      }
    )
    it('FULL admits rental and quote creation, scoped requests and hiding without requiring optional modules', async () => {
      const f = await manualFixture()
      expect(
        (await f.cycle.createManualRental(principal(), f.input)).status
      ).toBe('PENDING')
      expect(
        (
          await f.requests.createQuoteRequest(
            principal(),
            {
              customerName: 'Fixture',
              customerEmail: 'fixture@example.invalid',
              customerPhone: '000',
              items: [{ equipmentId: f.equipment.id, quantity: 1, days: 3 }],
            },
            f.customer.userId
          )
        ).id
      ).toBeTruthy()
      expect(
        await f.clientRequests.requestClientRentalAction(
          f.customer,
          f.row.id,
          'PICKUP'
        )
      ).toMatchObject({ duplicate: false })
      expect(await f.quotePortal.hideClientQuote(f.customer, f.q.id)).toBe(true)
      expect(await f.rentalPortal.hideClientRental(f.customer, f.row.id)).toBe(
        true
      )
      expect(await f.quotePortal.hideClientQuote(f.customer, 'foreign')).toBe(
        false
      )
      expect(await f.rentalPortal.hideClientRental(f.customer, 'foreign')).toBe(
        false
      )
    })
    it('RESTRICTED preserves ownership misses before subscription refusal', async () => {
      const f = await manualFixture()
      await setAccess('RESTRICTED')
      expect(
        await f.quotePortal.hideClientQuote(
          { ...f.customer, userId: ownerId },
          f.q.id
        )
      ).toBe(false)
      expect(
        await f.rentalPortal.hideClientRental(
          { ...f.customer, userId: ownerId },
          f.row.id
        )
      ).toBe(false)
      await expect(
        f.clientRequests.requestClientRentalAction(
          { ...f.customer, userId: ownerId },
          f.row.id,
          'PICKUP'
        )
      ).rejects.toMatchObject({ status: 404, policy: undefined })
      await expect(
        f.cycle.extendRental(principal(), f.row.id, {
          additionalDays: 1,
          customerId: ownerId,
        })
      ).rejects.toMatchObject({ status: 404, policy: undefined })
    })
    it.each(['RESTRICTED', 'ARCHIVED'] as const)(
      '%s denies manual conversion but completes and reuses an already paid conversion',
      async (access) => {
        const f = await manualFixture()
        await inspector.quoteItem.create({
          data: {
            tenantId,
            quoteId: f.q.id,
            equipmentId: f.equipment.id,
            quantity: 1,
            days: 3,
            pricePerDay: 10,
            total: 100,
            startDate: f.input.startDate,
            endDate: f.input.endDate,
          },
        })
        const payment = await inspector.payment.create({
          data: {
            tenantId,
            quoteId: f.q.id,
            amount: 100,
            method: 'PIX',
            type: 'DEPOSIT',
            status: 'PAID',
            dueDate: new Date(),
          },
        })
        await setAccess(access)
        await expect(
          f.conversion.convertQuoteToRental(principal(), f.q.id)
        ).rejects.toMatchObject({ status: access === 'ARCHIVED' ? 403 : 402 })
        const accepted = await f.conversion.convertPaidQuotePayment(
          { tenantId },
          payment.id
        )
        expect(accepted).toMatchObject({ converted: true })
        expect(
          await f.conversion.convertPaidQuotePayment({ tenantId }, payment.id)
        ).toEqual(accepted)
        expect(
          await inspector.rentals.count({
            where: { tenantId, quoteId: f.q.id },
          })
        ).toBe(1)
        expect(
          (
            await inspector.payment.findUniqueOrThrow({
              where: { id: payment.id },
            })
          ).rentalId
        ).toBe(accepted.rentalId)
      }
    )
    it('RESTRICTED returns existing inventory and records damage debt without accepting a mixed closure', async () => {
      const row = await customerRental()
      await setAccess('RESTRICTED')
      await expect(
        lifecycle().updateRental(principal(), row.id, {
          status: 'COMPLETED',
          extensionDays: 1,
        })
      ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
      expect(
        (await inspector.rentals.findUniqueOrThrow({ where: { id: row.id } }))
          .status
      ).toBe('ACTIVE')
      const result = await lifecycle().checkinRental(principal(), row.id, {
        damageFee: 12.34,
        notes: 'Returned',
      })
      expect(result.rental.status).toBe('COMPLETED')
      expect(result.rental.checkInAt).toBeInstanceOf(Date)
      expect(
        (
          await inspector.payment.findFirstOrThrow({
            where: { tenantId, rentalId: row.id, type: 'DAMAGE' },
          })
        ).amount.toString()
      ).toBe('12.34')
    })
    it('RESTRICTED permits a strict closure and preserves tenant-scoped 404', async () => {
      const row = await customerRental()
      await setAccess('RESTRICTED')
      expect(
        (
          await lifecycle().updateRental(principal(), row.id, {
            status: 'COMPLETED',
            notes: 'Closed',
          })
        ).status
      ).toBe('COMPLETED')
      await expect(
        lifecycle().checkinRental(principal(), 'foreign-rental', {})
      ).rejects.toMatchObject({ status: 404, policy: undefined })
    })
    it.each(['PAID', 'SETTLED'] as const)(
      'RESTRICTED accepts existing %s settlement but does not reopen it',
      async (billingStatus) => {
        const financial = createFinancialMutations({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(business, context, operation),
          withRentalTransaction: runner().withRentalTransaction,
        })
        const row = await inspector.payment.create({
          data: {
            tenantId,
            amount: 10,
            method: 'BOLETO',
            type: 'RENTAL',
            status: 'PENDING',
            dueDate: new Date(),
          },
        })
        await setAccess('RESTRICTED')
        await financial.updateFinancialStatus(principal(), row.id, {
          billingStatus,
        })
        expect(
          (await inspector.payment.findUniqueOrThrow({ where: { id: row.id } }))
            .billingStatus
        ).toBe(billingStatus)
        await expect(
          financial.updateFinancialStatus(principal(), row.id, {
            billingStatus: 'UNPAID',
          })
        ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
      }
    )
    it('RESTRICTED reissues an existing tenant boleto; ARCHIVED cannot enqueue another manual request', async () => {
      const row = await rental()
      const integration = await inspector.tenantIntegration.findFirstOrThrow({
        where: { tenantId },
      })
      const p = await inspector.payment.create({
        data: {
          tenantId,
          rentalId: row.id,
          amount: 10,
          method: 'BOLETO',
          type: 'RENTAL',
          status: 'OVERDUE',
          dueDate: new Date(),
          transactionId: 'old-boleto',
        },
      })
      await inspector.paymentAttempt.create({
        data: {
          tenantId,
          paymentId: p.id,
          integrationId: integration.id,
          provider: 'ASAAS',
          externalId: 'old-boleto',
          idempotencyKey: randomUUID(),
          amount: 10,
          dueDate: new Date(),
          status: 'OVERDUE',
        },
      })
      await setAccess('RESTRICTED')
      const reissue = createBoletoReissueRequest({
        withRentalTransaction: runner().withRentalTransaction,
      })
      await reissue.requestBoletoReissue(principal(), p.id)
      expect(
        await inspector.outboxEvent.count({
          where: { tenantId, topic: 'payment.boleto.reissue' },
        })
      ).toBe(1)
      await setAccess('ARCHIVED')
      await expect(
        reissue.requestBoletoReissue(principal(), p.id)
      ).rejects.toMatchObject({
        status: 403,
        policy: { code: 'TENANT_ARCHIVED' },
      })
      expect(await inspector.outboxEvent.count({ where: { tenantId } })).toBe(1)
    })
    it.each(['PIX', 'BOLETO'] as const)(
      '%s rechecks the module and writes no payment, attempt or outbox on denial',
      async (method) => {
        const row = await rental()
        await expect(
          payments.requestPayment(
            principal(),
            { rentalId: row.id, amount: 10, dueDate: instant },
            method
          )
        ).rejects.toMatchObject({
          policy: { code: 'MODULE_NOT_IN_PLAN', feature: 'onlinePayments' },
        })
        expect(await inspector.payment.count({ where: { tenantId } })).toBe(0)
        expect(
          await inspector.paymentAttempt.count({ where: { tenantId } })
        ).toBe(0)
        expect(await inspector.outboxEvent.count({ where: { tenantId } })).toBe(
          0
        )
      }
    )
    it.each(['PIX', 'BOLETO'] as const)(
      '%s on an ongoing pre-suspension rental retains its owner and historical obligation exception',
      async (method) => {
        const row = await rental()
        await platform(async (tx) => {
          await tx.organization.update({
            where: { id: tenantId },
            data: { access: 'RESTRICTED' },
          })
          await tx.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'SUSPENDED', suspendedAt: instant },
          })
        })
        const result = await payments.requestPayment(
          { ...principal(), role: 'CLIENT' },
          { rentalId: row.id, amount: 10, dueDate: instant },
          method
        )
        expect(result.pending).toBe(true)
        expect(result.payment.tenantId).toBe(tenantId)
        expect(
          await inspector.paymentAttempt.count({ where: { tenantId } })
        ).toBe(1)
        expect(
          await inspector.outboxEvent.count({
            where: { tenantId, topic: 'payment.issue' },
          })
        ).toBe(1)
      }
    )
    describe('durable Zoho provider commands', () => {
      const commands = () =>
        createZohoMailCommands({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(business, context, operation),
        })
      const command = (
        operation:
          'SEND' | 'REPLY' | 'DRAFT' | 'UPDATE' | 'DELETE' | 'UPLOAD' = 'SEND',
        key = 'synthetic-retry-key'
      ) => ({
        userId: ownerId,
        operation,
        accountId: 'account-a',
        key,
        payload: {
          messageId: '9007199254740993125',
          content: 'Synthetic mail; must not be persisted',
        },
      })
      const grant = () =>
        inspector.zohoMailToken.create({
          data: {
            tenantId,
            userId: ownerId,
            accountId: 'account-a',
            accessToken: 'synthetic-token',
            refreshToken: 'synthetic-refresh',
            expiresAt: new Date(Date.now() + 60_000),
          },
        })
      it.each(
        (
          ['SEND', 'REPLY', 'DRAFT', 'UPDATE', 'DELETE', 'UPLOAD'] as const
        ).flatMap((operation) =>
          (['SETUP', 'RESTRICTED', 'ARCHIVED'] as const).map((access) => ({
            operation,
            access,
          }))
        )
      )(
        '$operation accepts no durable command or external call when current access is $access',
        async ({ operation, access }) => {
          await setAccess(access)
          const effect = vi.fn()
          await expect(
            commands().execute(principal(), command(operation), effect)
          ).rejects.toMatchObject({ status: access === 'ARCHIVED' ? 403 : 402 })
          expect(effect).not.toHaveBeenCalled()
          expect(
            await inspector.zohoMailCommand.count({ where: { tenantId } })
          ).toBe(0)
        }
      )
      it('requires the current email module and tenant/user/account grant before admission', async () => {
        const effect = vi.fn()
        await grant()
        await expect(
          commands().execute(principal(), command(), effect)
        ).rejects.toMatchObject({
          body: { code: 'MODULE_NOT_IN_PLAN', feature: 'emailInbox' },
        })
        await override(tenantId, 'features.emailInbox')
        await expect(
          commands().execute(
            principal(),
            { ...command(), accountId: 'foreign-account' },
            effect
          )
        ).rejects.toMatchObject({ code: 'ZOHO_GRANT_CHANGED' })
        expect(effect).not.toHaveBeenCalled()
        expect(
          await inspector.zohoMailCommand.count({ where: { tenantId } })
        ).toBe(0)
      })
      it.each(['SUSPENDED', 'REVOKED', 'CLIENT'] as const)(
        'rechecks membership %s rather than stale administrator metadata',
        async (change) => {
          await override(tenantId, 'features.emailInbox')
          const staff = await inspector.user.create({
            data: { email: randomUUID() + '@example.invalid' },
          })
          await inspector.membership.create({
            data: { tenantId, userId: staff.id, role: 'OPERATOR' },
          })
          await inspector.membership.update({
            where: { tenantId_userId: { tenantId, userId: staff.id } },
            data: change === 'CLIENT' ? { role: change } : { status: change },
          })
          const effect = vi.fn()
          await expect(
            commands().execute(
              { ...principal(), userId: staff.id },
              { ...command(), userId: staff.id },
              effect
            )
          ).rejects.toMatchObject({ code: 'ZOHO_MEMBERSHIP_CHANGED' })
          expect(effect).not.toHaveBeenCalled()
          expect(
            await inspector.zohoMailCommand.count({ where: { tenantId } })
          ).toBe(0)
        }
      )
      it('commits before provider execution and replays after process recreation without another effect or audit', async () => {
        await override(tenantId, 'features.emailInbox')
        const live = await grant()
        const effect = vi.fn(async () => {
          expect(
            await inspector.zohoMailCommand.findFirst({ where: { tenantId } })
          ).toMatchObject({
            status: 'PROCESSING',
            grantId: live.id,
            responseBody: null,
          })
          return Response.json({ success: true })
        })
        const input = {
          ...command(),
          audit: { action: 'SEND', entity: 'EMAIL', entityId: ownerId },
        }
        expect(
          await (await commands().execute(principal(), input, effect)).json()
        ).toEqual({ success: true })
        expect(
          await (await commands().execute(principal(), input, effect)).json()
        ).toEqual({ success: true })
        expect(effect).toHaveBeenCalledTimes(1)
        expect(
          await inspector.auditLog.count({
            where: { tenantId, action: 'SEND' },
          })
        ).toBe(1)
        const row = await inspector.zohoMailCommand.findFirstOrThrow({
          where: { tenantId },
        })
        expect(row.status).toBe('RESOLVED')
        for (const sensitive of [
          'Synthetic mail; must not be persisted',
          'synthetic-token',
          'synthetic-retry-key',
        ])
          expect(JSON.stringify(row)).not.toContain(sensitive)
        await expect(
          commands().execute(
            principal(),
            { ...input, payload: { messageId: 'different' } },
            effect
          )
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
        expect(effect).toHaveBeenCalledTimes(1)
      })
      it.each(['RESTRICTED', 'ARCHIVED'] as const)(
        'finishes an accepted effect after projection changes to %s without retaining the admission lock',
        async (access) => {
          await override(tenantId, 'features.emailInbox')
          await grant()
          const result = await commands().execute(
            principal(),
            command(),
            async () => {
              await setAccess(access)
              return Response.json({ success: true })
            }
          )
          expect(result.status).toBe(200)
          expect(
            await inspector.zohoMailCommand.findFirst({ where: { tenantId } })
          ).toMatchObject({ status: 'RESOLVED' })
        }
      )
      it('blocks an overlapping retry while the accepted provider call is pending', async () => {
        await override(tenantId, 'features.emailInbox')
        await grant()
        let finish!: () => void, entered!: () => void
        const pending = new Promise<void>((resolve) => {
            finish = resolve
          }),
          accepted = new Promise<void>((resolve) => {
            entered = resolve
          })
        const effect = vi.fn(async () => {
          entered()
          await pending
          return Response.json({ success: true })
        })
        const first = commands().execute(principal(), command(), effect)
        try {
          await accepted
          await expect(
            commands().execute(principal(), command(), effect)
          ).rejects.toMatchObject({ code: 'ZOHO_COMMAND_IN_PROGRESS' })
        } finally {
          finish()
        }
        expect((await first).status).toBe(200)
        expect(effect).toHaveBeenCalledTimes(1)
      })
      it('keeps UNKNOWN non-replayable after ambiguous provider failure, even after restart', async () => {
        await override(tenantId, 'features.emailInbox')
        await grant()
        const effect = vi.fn(async () => {
          throw new Error(
            'Synthetic timeout after possible provider acceptance'
          )
        })
        await expect(
          commands().execute(principal(), command(), effect)
        ).rejects.toThrow('Synthetic timeout')
        expect(
          await inspector.zohoMailCommand.findFirst({ where: { tenantId } })
        ).toMatchObject({ status: 'UNKNOWN', responseBody: null })
        await expect(
          commands().execute(principal(), command(), effect)
        ).rejects.toMatchObject({ code: 'ZOHO_RECONCILIATION_REQUIRED' })
        expect(effect).toHaveBeenCalledTimes(1)
      })
      it('an audit failure after provider success rolls back local resolution and forbids automatic resending', async () => {
        await override(tenantId, 'features.emailInbox')
        await grant()
        const effect = vi.fn(async () => Response.json({ success: true }))
        const input = {
          ...command(),
          audit: { action: 'SEND', entity: 'EMAIL', entityId: ownerId },
        }
        const broken = createZohoMailCommands({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(business, context, (tx) =>
              operation({
                ...tx,
                auditLog: {
                  ...tx.auditLog,
                  create: async () => {
                    throw new Error('Synthetic audit failure')
                  },
                },
              } as Prisma.TransactionClient)
            ),
        })
        await expect(
          broken.execute(principal(), input, effect)
        ).rejects.toThrow('Synthetic audit failure')
        expect(
          await inspector.zohoMailCommand.findFirst({ where: { tenantId } })
        ).toMatchObject({ status: 'UNKNOWN' })
        await expect(
          commands().execute(principal(), input, effect)
        ).rejects.toMatchObject({ code: 'ZOHO_RECONCILIATION_REQUIRED' })
        expect(effect).toHaveBeenCalledTimes(1)
      })
      it('RLS hides commands without scope and on another tenant; SQL enforces terminal history and indexed tenant lookups', async () => {
        await override(tenantId, 'features.emailInbox')
        await grant()
        await commands().execute(principal(), command(), async () =>
          Response.json({ success: true })
        )
        const row = await inspector.zohoMailCommand.findFirstOrThrow({
          where: { tenantId },
        })
        expect(await business.zohoMailCommand.findMany()).toEqual([])
        expect(
          await withTenantTransaction(
            business,
            { tenantId: 'foreign-tenant' },
            (tx) => tx.zohoMailCommand.findMany()
          )
        ).toEqual([])
        await expect(
          inspector.zohoMailCommand.update({
            where: { id: row.id },
            data: { status: 'PROCESSING' },
          })
        ).rejects.toThrow('ZOHO_COMMAND_HISTORY_IMMUTABLE')
        await expect(
          inspector.zohoMailCommand.delete({ where: { id: row.id } })
        ).rejects.toThrow('ZOHO_COMMAND_HISTORY_IMMUTABLE')
        await expect(
          inspector.zohoMailCommand.create({
            data: {
              ...row,
              id: 'spoof',
              keyHash: 'a'.repeat(64),
              status: 'RESOLVED',
            },
          })
        ).rejects.toThrow('ZOHO_COMMAND_INVALID_INITIAL_STATE')
        await inspector.zohoMailCommand.createMany({
          data: Array.from({ length: 1200 }, (_, index) => ({
            id: randomUUID(),
            tenantId,
            userId: ownerId,
            operation: 'SEND',
            accountId: row.accountId,
            grantId: row.grantId,
            keyHash: index.toString(16).padStart(64, '0'),
            requestHash: row.requestHash,
            createdAt: new Date(instant.getTime() + index),
          })),
        })
        await inspector.$executeRawUnsafe('ANALYZE zoho_mail_commands')
        const plans = await withTenantTransaction(
          business,
          principal(),
          async (tx) => {
            await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off')
            const lookup = await tx.$queryRaw<
              { 'QUERY PLAN': string }[]
            >`EXPLAIN SELECT id FROM zoho_mail_commands WHERE "tenantId"=${tenantId} AND "userId"=${ownerId} AND operation='SEND' AND "keyHash"=${row.keyHash}`
            const pending = await tx.$queryRaw<
              { 'QUERY PLAN': string }[]
            >`EXPLAIN SELECT id FROM zoho_mail_commands WHERE "tenantId"=${tenantId} AND status='PROCESSING' ORDER BY "createdAt" LIMIT 10`
            return [lookup, pending].map((plan) =>
              plan.map((line) => line['QUERY PLAN']).join('\n')
            )
          }
        )
        expect(plans[0]).toContain(
          'zoho_mail_commands_tenant_user_operation_key'
        )
        expect(plans[1]).toContain('zoho_mail_commands_tenant_status_created')
      })
      it('upload binds file content, not just its name and byte count, while preserving the attachments DTO', async () => {
        await override(tenantId, 'features.emailInbox')
        await grant()
        const attachments = [
          {
            storeName: 'local',
            attachmentName: 'file',
            attachmentPath: 'local/file',
            fileName: 'same.txt',
            size: 2,
          },
        ]
        const upload = vi.fn(async () => attachments)
        const writer = createZohoMailAttachmentUploader({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(business, context, operation),
          getZohoAccessToken: async () => 'synthetic-token',
          getZohoAccountId: async () => 'account-a',
          uploadZohoMailAttachments: upload,
          checkRateLimit: () => ({ allowed: true, response: null }),
          adminApiRateLimit: { maxRequests: 1, windowMs: 1 },
        })
        const request = (bytes: string) => {
          const form = new FormData()
          form.append('files', new File([bytes], 'same.txt'))
          return new Request('https://local.test/upload', {
            method: 'POST',
            headers: { 'x-idempotency-key': 'upload-key' },
            body: form,
          })
        }
        expect(
          await (
            await writer.uploadAttachments(principal(), ownerId, request('ab'))
          ).json()
        ).toEqual({ attachments })
        expect(
          (await writer.uploadAttachments(principal(), ownerId, request('ab')))
            .status
        ).toBe(200)
        const changed = await writer.uploadAttachments(
          principal(),
          ownerId,
          request('cd')
        )
        expect(changed.status).toBe(409)
        expect(await changed.json()).toMatchObject({
          code: 'IDEMPOTENCY_CONFLICT',
        })
        expect(upload).toHaveBeenCalledTimes(1)
      })
      it('off executes without a ledger or transaction; shadow observes denial without activating enforcement', async () => {
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
        const transaction = vi.fn(),
          effect = vi.fn(async () => Response.json({ success: true }))
        expect(
          (
            await createZohoMailCommands({
              withTenantTransaction: transaction,
            }).execute(principal(), command(), effect)
          ).status
        ).toBe(200)
        expect(transaction).not.toHaveBeenCalled()
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
        await setAccess('RESTRICTED')
        const warning = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => undefined)
        expect(
          (await commands().execute(principal(), command(), effect)).status
        ).toBe(200)
        expect(warning).toHaveBeenCalledWith('[subscription-command-shadow]', {
          tenantId,
          code: 'SUBSCRIPTION_RESTRICTED',
        })
        expect(
          await inspector.zohoMailCommand.count({ where: { tenantId } })
        ).toBe(0)
      })
    })
    it('a rental checked out after suspension no longer qualifies even with stale FULL principal metadata', async () => {
      const row = await rental()
      await platform(async (tx) => {
        await tx.organization.update({
          where: { id: tenantId },
          data: { access: 'RESTRICTED' },
        })
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'SUSPENDED',
            suspendedAt: new Date(instant.getTime() - 2000),
          },
        })
      })
      await expect(
        payments.requestPayment(
          principal(),
          { rentalId: row.id, amount: 10, dueDate: instant },
          'PIX'
        )
      ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
      expect(await inspector.payment.count({ where: { tenantId } })).toBe(0)
    })
  }
)
