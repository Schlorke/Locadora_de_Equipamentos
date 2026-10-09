import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { FakeAsaas } from '../helpers/fake-asaas'
import {
  calcularDigitosCnpj,
  formatarCnpj,
} from '../../packages/domain/src/documento/cnpj'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  createEnvKeyring,
  createSecretVault,
} from '../../packages/backend/src/modules/secrets/index'
import {
  AsaasSecretValue,
  assertReceivingAccountReady,
  createAsaasAccountWebhooks,
  createAsaasSubaccounts,
  readAsaasAccountHealth,
  readAsaasConnectedAccount,
  ReceivingAccountNotReadyError,
  type AsaasFetch,
} from '../../packages/backend/src/modules/billing/index'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/index'
import { createPlatformAsaasIngress } from '../../packages/backend/src/modules/platform-webhooks/index'
import { PLATFORM_EDGE_HEADER } from '@gb-locacoes/contracts/platform'
import { handleConfiguredPaymentAccountCreation } from '@gb-locacoes/backend/runtime'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import { GET as legacyCron } from '../../app/api/cron/platform/route'
import { GET as apiCron } from '../../apps/services/api/src/app/api/cron/platform/route'
import {
  companyDataVersion,
  readSubaccountCompany,
} from '../../packages/backend/src/modules/payment-accounts/subaccount-company'
import {
  ACCOUNT_WEBHOOK_TOPIC,
  createAccountWebhookConsumer,
  createConnectedAccountConfiguration,
  createOwnerPaymentAccountConnection,
  createOwnerSubaccountRequest,
  createProvisioningRequestsMaintenance,
  createSubaccountProvisioning,
  createUncertainSubaccountRecovery,
  type SubaccountCreationSettings,
} from '../../packages/backend/src/modules/payment-accounts/index'

/**
 * Wave 134 (S9): owner request and creation worker of the receiving account on PostgreSQL with the canonical
 * roles (FORCE RLS, platform-only request table) and the Asaas contract double. No real provider is called.
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'receiving-account creation on isolated PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'subaccounts_' + suffix + '_test',
      platformRole = 'subaccount_platform_' + suffix,
      businessRole = 'subaccount_business_' + suffix
    let admin: Pool, db: Pool, pool: Pool, businessPool: Pool
    let platformDatabaseUrl: string
    let platform: PrismaClient, business: PrismaClient, unsafe: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      readScope: ReturnType<typeof createPlatformScope>
    const ring = createEnvKeyring('K1', { K1: Buffer.alloc(32, 41) })
    const fingerprintKey = Buffer.alloc(32, 42)
    const vault = createSecretVault({
      current: ring,
      providers: [ring],
      fingerprintKey,
    })
    let clock: Date
    const now = () => clock
    const advance = (ms: number) => {
      clock = new Date(clock.getTime() + ms)
    }
    // One double for the whole file: its account ids never repeat, as in the provider.
    const fake = new FakeAsaas()
    let outbound = false
    let transport: AsaasFetch
    let counter = 0
    const site = (slug: string) => 'https://' + slug + '.locadora.example.test'
    const settings = (
      extra: Partial<SubaccountCreationSettings> = {}
    ): SubaccountCreationSettings => ({
      environment: 'sandbox',
      model: 'STANDARD',
      requiresPaid: false,
      site,
      ...extra,
    })
    const commercial = {
      incomeValue: '98765.43',
      mobilePhone: '11987654321',
      companyDataConfirmed: true as const,
    }
    /**
     * Forms of the legacy `document` column, which migration 202610030104 left without `documentNormalized` and
     * `receivingDocument` accepts: the CNPJ mask, plain digits, or another typed mask with the same digits.
     */
    type LegacyForm = 'formatted' | 'digits' | 'free-form'
    const legacyDocument = (form: LegacyForm, digits: string) =>
      form === 'formatted'
        ? formatarCnpj(digits)
        : form === 'digits'
          ? digits
          : digits.slice(0, 8) +
            '/' +
            digits.slice(8, 12) +
            '-' +
            digits.slice(12)

    async function company(
      options: {
        document?: string
        verified?: boolean
        notice?: boolean
        emailVerified?: boolean
        phone?: string
        /** As the legacy registration stored it: only the free-text `document`, no normalized column. */
        legacy?: LegacyForm
      } = {}
    ) {
      const n = ++counter
      const tenantId = 'receiving-' + n + '-' + suffix.slice(0, 6)
      const base = '730000000' + String(n).padStart(3, '0')
      const document = options.document ?? base + calcularDigitosCnpj(base)
      const owner = await unsafe.user.create({
        data: {
          email: tenantId + '@example.test',
          authEmailVerified: options.emailVerified ?? true,
        },
      })
      await scope.withPlatformTransaction((tx) =>
        tx.organization.create({
          data: {
            id: tenantId,
            slug: tenantId,
            name: 'Locadora sintetica ' + n,
            legalName: 'Locadora Sintetica ' + n + ' Ltda',
            companyType: 'LIMITED',
            ...(options.legacy
              ? {
                  document: legacyDocument(options.legacy, document),
                  documentNormalized: null,
                }
              : { document, documentNormalized: document }),
            ...(options.verified ? { documentVerifiedAt: clock } : {}),
            phone: options.phone ?? '11987654321',
            addressLine: 'Rua Sintetica',
            addressNumber: String(100 + n),
            district: 'Centro',
            postalCode: '01001000',
            city: 'Sao Paulo',
            state: 'SP',
          },
        })
      )
      const membership = await unsafe.membership.create({
        data: { tenantId, userId: owner.id, role: 'ADMIN', status: 'ACTIVE' },
      })
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: owner.id },
        })
      )
      if (options.notice ?? true)
        await unsafe.legalAcceptance.create({
          data: {
            userId: owner.id,
            tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'a'.repeat(64),
            acceptedAt: new Date(clock.getTime() - 60_000),
          },
        })
      const actor = {
        tenantId,
        userId: owner.id,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      return { tenantId, document, owner, actor }
    }
    type Company = Awaited<ReturnType<typeof company>>

    const owner = (
      extra: Partial<Parameters<typeof createOwnerSubaccountRequest>[0]> = {}
    ) =>
      createOwnerSubaccountRequest({
        readTransaction: readScope.withProvisioningTransaction,
        transaction: scope.withProvisioningTransaction,
        configuration: () => settings(),
        enforcement: () => 'off',
        now,
        ...extra,
      })
    const current = (tenantId: string) =>
      unsafe.paymentAccount.findFirstOrThrow({
        where: { tenantId, disconnectedAt: null },
        include: { integration: true },
      })
    async function requested(f: Company, flow = owner()) {
      const offer = await flow.offer(f.actor)
      expect(offer).toMatchObject({ available: true, blocker: null })
      await flow.request(
        f.actor,
        { ...commercial, companyDataVersion: offer.companyDataVersion },
        clock.getTime()
      )
      return current(f.tenantId)
    }
    const rootProvider = () =>
      createAsaasSubaccounts({
        credential: new AsaasSecretValue(fake.rootApiKey),
        environment: 'sandbox',
        fetch: (url, init) => transport(url, init),
        policy: () => ({
          outboundDisabled: outbound,
          egress: { kind: 'direct' },
        }),
      })
    const worker = (
      extra: Partial<Parameters<typeof createSubaccountProvisioning>[0]> = {}
    ) =>
      createSubaccountProvisioning({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        model: 'STANDARD',
        origin: 'https://api.example.test',
        email: 'ops@example.test',
        provider: rootProvider(),
        vault,
        site,
        now,
        sleep: async () => {},
        ...extra,
      })
    const delivery = (
      account: { id: string; tenantId: string },
      topic = 'payment-accounts.provisioning'
    ) => ({
      id: 'delivery-' + randomUUID(),
      tenantId: account.tenantId,
      topic,
      aggregateId: account.id,
      payload: { accountId: account.id },
      dedupeKey: 'local-' + randomUUID(),
      attempts: 1,
      lockedBy: 'local-worker',
    })
    const deliver = (account: { id: string; tenantId: string }, w = worker()) =>
      w.handlers['payment-accounts.provisioning'](delivery(account))
    const inspect = (account: { id: string; tenantId: string }) =>
      createUncertainSubaccountRecovery({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        provider: rootProvider(),
        now,
      }).handlers['payment-accounts.provisioning-recovery'](
        delivery(account, 'payment-accounts.provisioning-recovery')
      )
    const posts = (document: string) =>
      fake.requests.filter(
        (row) =>
          row.method === 'POST' &&
          row.path === '/accounts' &&
          (row.body as { cpfCnpj?: string } | null)?.cpfCnpj === document
      ).length
    const lookups = (document: string) =>
      fake.requests.filter(
        (row) =>
          row.method === 'GET' &&
          row.path === '/accounts' &&
          row.query.cpfCnpj === document
      ).length
    const account = (id: string) =>
      unsafe.paymentAccount.findUniqueOrThrow({
        where: { id },
        include: { integration: true },
      })
    const request = (paymentAccountId: string) =>
      unsafe.paymentAccountProvisioningRequest.findUniqueOrThrow({
        where: { paymentAccountId },
      })
    const audits = (tenantId: string) =>
      unsafe.platformAuditLog.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    const outbox = (aggregateId: string) =>
      unsafe.platformOutboxEvent.findMany({
        where: { aggregateId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    const secrets = (integrationId: string) =>
      unsafe.integrationSecret.findMany({ where: { integrationId } })
    const purged = (reason: string) => ({
      incomeValue: null,
      mobilePhone: null,
      purgeReason: reason,
      purgedAt: expect.any(Date),
    })
    const live = {
      incomeValue: expect.objectContaining({}),
      mobilePhone: '11987654321',
      purgedAt: null,
      purgeReason: null,
    }
    /** Rejects with an owner error carrying this status and code. */
    const refused = (status: number, code: string) =>
      expect.objectContaining({ status, code })
    /** Another ADMIN becomes the owner (the previous one keeps an ADMIN membership). */
    async function changeOwner(f: Company) {
      const next = await unsafe.user.create({
        data: {
          email: 'next-' + f.tenantId + '@example.test',
          authEmailVerified: true,
        },
      })
      const membership = await unsafe.membership.create({
        data: {
          tenantId: f.tenantId,
          userId: next.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
      await scope.withProvisioningTransaction(f.tenantId, (tx) =>
        tx.organization.update({
          where: { id: f.tenantId },
          data: { ownerUserId: next.id },
        })
      )
      return {
        tenantId: f.tenantId,
        userId: next.id,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
    }
    /** Version of the data the owner would confirm now, read without the offer's blockers. */
    const versionFor = async (tenantId: string, userId: string) =>
      (await scope.withPlatformTransaction((tx) =>
        readSubaccountCompany(tx, tenantId, userId, site)
      ))!.version

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
      const platformUrl = await createLoginRole(
        db,
        url.toString(),
        platformRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      const businessUrl = await createLoginRole(
        db,
        url.toString(),
        businessRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (const [file, name] of [
        ['app_runtime', businessRole],
        ['platform_runtime', platformRole],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + file + '.sql', 'utf8')
            .replaceAll(file!, name!)
        )
      platformDatabaseUrl = platformUrl
      pool = new Pool({ connectionString: platformUrl, max: 6 })
      businessPool = new Pool({ connectionString: businessUrl, max: 1 })
      platform = new PrismaClient({ adapter: new PrismaPg(pool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      unsafe = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(platform)
      readScope = createPlatformScope(platform, { readOnly: true })
      clock = new Date(Date.now() + 1000)
    }, 120_000)
    beforeEach(() => {
      // DB-default availableAt uses real time; allow 1 s of skew without undoing the explicit 15 s/DAY advances.
      clock = new Date(Math.max(clock.getTime(), Date.now() + 1000))
      fake.clearRecords()
      transport = (url, init) => fake.fetch(url, init)
      outbound = false
    })
    // Same budget as the setup: under load DROP DATABASE outlasted the 10 s default and left the two roles behind.
    afterAll(async () => {
      for (const client of [platform, business, unsafe])
        await client?.$disconnect()
      for (const connection of [pool, businessPool, db]) await connection?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const role of [platformRole, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + role + '"')
        await admin.end()
      }
    }, 120_000)

    describe('owner request (B4)', () => {
      it('the offer runs in a real READ ONLY transaction and shows exactly the data that will be sent', async () => {
        const f = await company()
        const offer = await owner().offer(f.actor)
        expect(offer).toEqual({
          available: true,
          blocker: null,
          model: 'STANDARD',
          company: {
            legalName: expect.stringMatching(/^Locadora Sintetica \d+ Ltda$/),
            cnpj: expect.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
            companyType: 'LIMITED',
            loginEmail: f.tenantId + '@example.test',
            email: f.tenantId + '@example.test',
            address: {
              street: 'Rua Sintetica',
              number: expect.any(String),
              complement: null,
              district: 'Centro',
              postalCode: '01001000',
            },
            site: site(f.tenantId),
          },
          suggestedMobilePhone: '11987654321',
          companyDataVersion: expect.stringMatching(/^[a-f0-9]{64}$/),
          lastRequestOutcome: null,
        })
        expect(fake.requests).toHaveLength(0)
      })

      it('202 writes integration, account, platform-only request, audit and outbox together, without the provider', async () => {
        const f = await company()
        const offer = await owner().offer(f.actor)
        expect(
          await owner().request(
            f.actor,
            { ...commercial, companyDataVersion: offer.companyDataVersion },
            clock.getTime()
          )
        ).toEqual({ accepted: true })
        const created = await current(f.tenantId)
        expect(created).toMatchObject({
          mode: 'ASAAS_SUBACCOUNT',
          subaccountModel: 'STANDARD',
          status: 'PROVISIONING',
          environment: 'sandbox',
          requestedByUserId: f.owner.id,
          provisioningAttempts: 0,
          nextAttemptAt: clock,
          integration: {
            provider: 'ASAAS',
            credentialSource: 'VAULT',
            status: 'PROVISIONING',
            environment: 'sandbox',
            webhookTokenHash: null,
          },
        })
        const stored = await request(created.id)
        expect(stored).toMatchObject({
          ...live,
          tenantId: f.tenantId,
          companyDataVersion: offer.companyDataVersion,
        })
        expect(stored.incomeValue?.toFixed(2)).toBe('98765.43')
        expect(await audits(f.tenantId)).toEqual([
          expect.objectContaining({
            actorKind: 'OWNER',
            actorUserId: f.owner.id,
            action: 'payment-account.provisioning.requested',
            targetId: created.id,
            reasonCategory: 'STANDARD',
          }),
        ])
        const queued = await outbox(created.id)
        expect(queued).toEqual([
          expect.objectContaining({
            topic: 'payment-accounts.provisioning',
            tenantId: f.tenantId,
            payload: { accountId: created.id },
            availableAt: clock,
            dedupeKey: 'pa:create:' + created.id + ':' + clock.toISOString(),
          }),
        ])
        const evidence = JSON.stringify([
          await audits(f.tenantId),
          queued,
          created,
        ])
        expect(evidence).not.toContain('98765')
        expect(evidence).not.toContain('11987654321')
        expect(fake.requests).toHaveLength(0)
      })

      it.each([
        'tenantIntegration',
        'paymentAccount',
        'paymentAccountProvisioningRequest',
        'platformAuditLog',
        'platformOutboxEvent',
      ])('a failure writing %s rolls every artifact back', async (model) => {
        const f = await company()
        const offer = await owner().offer(f.actor)
        const failing: typeof scope.withProvisioningTransaction = (
          tenantId,
          operation
        ) =>
          scope.withProvisioningTransaction(tenantId, (tx) =>
            operation(
              new Proxy(tx, {
                get(target, property) {
                  const value = Reflect.get(target, property)
                  if (property !== model)
                    return typeof value === 'function'
                      ? value.bind(target)
                      : value
                  return new Proxy(value as object, {
                    get(delegate, method) {
                      const call = Reflect.get(delegate, method) as (
                        ...args: unknown[]
                      ) => Promise<unknown>
                      if (method !== 'create' && method !== 'upsert')
                        return typeof call === 'function'
                          ? call.bind(delegate)
                          : call
                      // The write itself succeeds; the failure comes right after, inside the transaction.
                      return async (...args: unknown[]) => {
                        await call.apply(delegate, args)
                        throw new Error('synthetic-write-failure')
                      }
                    },
                  })
                },
              }) as Prisma.TransactionClient
            )
          )
        await expect(
          owner({ transaction: failing }).request(
            f.actor,
            { ...commercial, companyDataVersion: offer.companyDataVersion },
            clock.getTime()
          )
        ).rejects.toThrow('synthetic-write-failure')
        expect(
          await unsafe.paymentAccount.count({ where: { tenantId: f.tenantId } })
        ).toBe(0)
        expect(
          await unsafe.tenantIntegration.count({
            where: { tenantId: f.tenantId },
          })
        ).toBe(0)
        expect(
          await unsafe.paymentAccountProvisioningRequest.count({
            where: { tenantId: f.tenantId },
          })
        ).toBe(0)
        expect(await audits(f.tenantId)).toEqual([])
        expect(
          await unsafe.platformOutboxEvent.count({
            where: { tenantId: f.tenantId },
          })
        ).toBe(0)
      })

      it('an identical replay is accepted without effects; another value conflicts; concurrent requests create one account', async () => {
        const f = await company()
        const flow = owner()
        const offer = await flow.offer(f.actor)
        const input = {
          ...commercial,
          companyDataVersion: offer.companyDataVersion,
        }
        const results = await Promise.allSettled([
          flow.request(f.actor, input, clock.getTime()),
          flow.request(f.actor, input, clock.getTime()),
        ])
        expect(results.map((result) => result.status)).toEqual([
          'fulfilled',
          'fulfilled',
        ])
        expect(
          await unsafe.paymentAccount.count({ where: { tenantId: f.tenantId } })
        ).toBe(1)
        expect(await flow.request(f.actor, input, clock.getTime())).toEqual({
          accepted: true,
        })
        expect(await audits(f.tenantId)).toHaveLength(1)
        await expect(
          flow.request(
            f.actor,
            { ...input, incomeValue: '98765.44' },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS'))
        await expect(
          flow.request(
            f.actor,
            { ...input, mobilePhone: '11900000000' },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS'))
        expect(
          await unsafe.platformOutboxEvent.count({
            where: { tenantId: f.tenantId },
          })
        ).toBe(1)
      })

      it('a replay needs the same company data version: a second request after the data changed conflicts, never a second acceptance', async () => {
        const f = await company()
        const created = await requested(f)
        const confirmed = (await request(created.id)).companyDataVersion
        // Another tab, opened after the registration changed, sends the same value and phone with the new version.
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { addressNumber: '999' },
          })
        )
        const changed = await versionFor(f.tenantId, f.owner.id)
        expect(changed).not.toBe(confirmed)
        await expect(
          owner().request(
            f.actor,
            { ...commercial, companyDataVersion: changed },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS'))
        // Only the version differs: the very same body with the confirmed version is still the replay.
        expect(
          await owner().request(
            f.actor,
            { ...commercial, companyDataVersion: confirmed },
            clock.getTime()
          )
        ).toEqual({ accepted: true })
        expect(await request(created.id)).toMatchObject({
          ...live,
          companyDataVersion: confirmed,
        })
        expect(await audits(f.tenantId)).toHaveLength(1)
        expect(
          await unsafe.platformOutboxEvent.count({
            where: { tenantId: f.tenantId },
          })
        ).toBe(1)
        // The request confirmed with the old data is cancelled by the worker, without any call.
        await deliver(created)
        expect(fake.requests).toHaveLength(0)
        expect(await account(created.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'COMPANY_DATA_CHANGED',
        })
      })

      it('refuses changed data, missing first payment and missing partner notice, in that order of checks', async () => {
        const f = await company({ notice: false })
        const offer = await owner({
          configuration: () => settings({ requiresPaid: true }),
        }).offer(f.actor)
        expect(offer).toMatchObject({
          available: false,
          blocker: 'FIRST_PAYMENT_REQUIRED',
        })
        const free = owner()
        await unsafe.legalAcceptance.create({
          data: {
            userId: f.owner.id,
            tenantId: f.tenantId,
            kind: 'PLATFORM_TERMS',
            version: '2026-10-01',
            textSha256: 'c'.repeat(64),
            acceptedAt: new Date(clock.getTime() - 1000),
          },
        })
        expect(await free.offer(f.actor)).toMatchObject({
          available: false,
          blocker: 'PAYMENTS_NOTICE_REQUIRED',
        })
        await unsafe.legalAcceptance.create({
          data: {
            userId: f.owner.id,
            tenantId: f.tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'b'.repeat(64),
            acceptedAt: new Date(clock.getTime() - 1000),
          },
        })
        const version = (await free.offer(f.actor)).companyDataVersion!
        await expect(
          free.request(
            f.actor,
            { ...commercial, companyDataVersion: 'c'.repeat(64) },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'COMPANY_DATA_CHANGED'))
        await expect(
          owner({
            configuration: () => settings({ requiresPaid: true }),
          }).request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'FIRST_PAYMENT_REQUIRED'))
        // A paid first invoice (not refunded) lifts the requirement.
        const plan = await scope.withPlatformTransaction(async (tx) => {
          const row = await tx.plan.create({
            data: {
              code: 's9-' + ++counter + '-' + suffix.slice(0, 8),
              name: 'Synthetic',
            },
          })
          return tx.planVersion.create({
            data: {
              planId: row.id,
              version: 1,
              amount: '199.90',
              entitlements: {
                schema: 1,
                limits: { equipments: null, staffSeats: 2 },
                features: Object.fromEntries(
                  ENTITLEMENT_FEATURES.map((key) => [key, true])
                ),
              },
            },
          })
        })
        await scope.withPlatformTransaction(async (tx) => {
          await tx.subscription.create({
            data: {
              id: 'subscription-' + f.tenantId,
              tenantId: f.tenantId,
              planVersionId: plan.id,
              status: 'ACTIVE',
            },
          })
          await tx.platformInvoice.create({
            data: {
              tenantId: f.tenantId,
              subscriptionId: 'subscription-' + f.tenantId,
              status: 'REFUNDED',
              providerPaymentId: 'pay_refunded_' + f.tenantId,
              amount: '199.90',
              dueDate: clock,
              paidAt: clock,
              syncedAt: clock,
            },
          })
          await tx.platformInvoice.create({
            data: {
              tenantId: f.tenantId,
              subscriptionId: 'subscription-' + f.tenantId,
              status: 'PAID',
              providerPaymentId: 'pay_chargeback_' + f.tenantId,
              amount: '199.90',
              dueDate: clock,
              paidAt: clock,
              chargebackAt: clock,
              syncedAt: clock,
            },
          })
        })
        await expect(
          owner({
            configuration: () => settings({ requiresPaid: true }),
          }).request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'FIRST_PAYMENT_REQUIRED'))
        await scope.withPlatformTransaction((tx) =>
          tx.platformInvoice.create({
            data: {
              tenantId: f.tenantId,
              subscriptionId: 'subscription-' + f.tenantId,
              status: 'PAID',
              providerPaymentId: 'pay_' + f.tenantId,
              amount: '199.90',
              dueDate: clock,
              paidAt: clock,
              syncedAt: clock,
            },
          })
        )
        expect(
          await owner({
            configuration: () => settings({ requiresPaid: true }),
          }).request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).toEqual({ accepted: true })
      })

      it('refuses unverified e-mail, a non-owner administrator, a stale session and an archived company', async () => {
        const unverified = await company({ emailVerified: false })
        expect(await owner().offer(unverified.actor)).toMatchObject({
          blocker: 'EMAIL_NOT_VERIFIED',
        })
        await expect(
          owner().request(
            unverified.actor,
            { ...commercial, companyDataVersion: 'a'.repeat(64) },
            clock.getTime()
          )
        ).rejects.toEqual(refused(403, 'EMAIL_NOT_VERIFIED'))
        const f = await company()
        const version = (await owner().offer(f.actor)).companyDataVersion!
        const admin = await unsafe.user.create({
          data: { email: 'admin-' + f.tenantId + '@example.test' },
        })
        const membership = await unsafe.membership.create({
          data: {
            tenantId: f.tenantId,
            userId: admin.id,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        })
        const other = {
          tenantId: f.tenantId,
          userId: admin.id,
          membershipId: membership.id,
          role: 'ADMIN' as const,
        }
        await expect(owner().offer(other)).rejects.toEqual(
          refused(403, 'OWNER_REQUIRED')
        )
        // The owner's own principal with another role is refused, even with an ADMIN membership row.
        await expect(
          owner().offer({ ...f.actor, role: 'FINANCIAL' })
        ).rejects.toEqual(refused(403, 'OWNER_REQUIRED'))
        await expect(
          owner().request(
            other,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(403, 'OWNER_REQUIRED'))
        await expect(
          owner().request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime() - 600_001
          )
        ).rejects.toEqual(refused(401, 'FRESH_SESSION_REQUIRED'))
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { access: 'ARCHIVED' },
          })
        )
        await expect(owner().offer(f.actor)).rejects.toEqual(
          refused(403, 'TENANT_ARCHIVED')
        )
        await expect(
          owner().request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(403, 'TENANT_ARCHIVED'))
        expect(
          await unsafe.paymentAccount.count({ where: { tenantId: f.tenantId } })
        ).toBe(0)
      })

      it('a CNPJ verified by another company, or with another current account, is in use (ownership of the CNPJ)', async () => {
        const verified = await company({ verified: true })
        const same = await company({ document: verified.document })
        expect(await owner().offer(same.actor)).toMatchObject({
          available: false,
          blocker: 'DOCUMENT_IN_USE',
        })
        const first = await company()
        await requested(first)
        const second = await company({ document: first.document })
        expect(await owner().offer(second.actor)).toMatchObject({
          blocker: 'DOCUMENT_IN_USE',
        })
        expect((await owner().offer(first.actor)).blocker).toBe(
          'ACCOUNT_EXISTS'
        )
        await expect(
          owner().request(
            second.actor,
            {
              ...commercial,
              companyDataVersion: (await requestedVersion(second))!,
            },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'DOCUMENT_IN_USE'))
      })

      it.each(['cancelled', 'returned by the provider'] as const)(
        'a %s request of another company never holds the CNPJ: only a current account does',
        async (outcome) => {
          const first = await company()
          const ended = await requested(first)
          if (outcome === 'cancelled')
            await scope.withProvisioningTransaction(first.tenantId, (tx) =>
              tx.organization.update({
                where: { id: first.tenantId },
                data: { addressNumber: '999' },
              })
            )
          else
            fake.inject({
              method: 'POST',
              path: '/accounts',
              fault: {
                kind: 'status',
                status: 400,
                body: {
                  errors: [{ code: 'invalid_incomeValue', description: 'x' }],
                },
              },
            })
          await deliver(ended)
          expect(await account(ended.id)).toMatchObject({
            status: 'DISCONNECTED',
            disconnectedAt: expect.any(Date),
            lastErrorCode:
              outcome === 'cancelled'
                ? 'COMPANY_DATA_CHANGED'
                : 'SUBACCOUNT_CREATE_REJECTED',
          })
          // The legitimate owner of the CNPJ asks next: the account that ended elsewhere does not stop it.
          const second = await company({ document: first.document })
          const offer = await owner().offer(second.actor)
          expect(offer).toMatchObject({ available: true, blocker: null })
          expect(
            await owner().request(
              second.actor,
              { ...commercial, companyDataVersion: offer.companyDataVersion },
              clock.getTime()
            )
          ).toEqual({ accepted: true })
          // Now the second company holds a current account for it, and the first one is the one refused.
          expect(await owner().offer(first.actor)).toMatchObject({
            available: false,
            blocker: 'DOCUMENT_IN_USE',
          })
        }
      )

      it.each(['formatted', 'digits'] as const)(
        'a legacy company with the %s CNPJ only in the legacy column still holds it with its current account',
        async (form) => {
          const legacy = await company({ legacy: form })
          expect(
            await unsafe.organization.findUniqueOrThrow({
              where: { id: legacy.tenantId },
              select: { document: true, documentNormalized: true },
            })
          ).toEqual({
            document: legacyDocument(form, legacy.document),
            documentNormalized: null,
          })
          await requested(legacy)
          const other = await company({ document: legacy.document })
          expect(await owner().offer(other.actor)).toMatchObject({
            available: false,
            blocker: 'DOCUMENT_IN_USE',
          })
          await expect(
            owner().request(
              other.actor,
              {
                ...commercial,
                companyDataVersion: await versionFor(
                  other.tenantId,
                  other.owner.id
                ),
              },
              clock.getTime()
            )
          ).rejects.toEqual(refused(409, 'DOCUMENT_IN_USE'))
          expect(
            await unsafe.paymentAccount.count({
              where: { tenantId: other.tenantId },
            })
          ).toBe(0)
        }
      )

      it('with enforcement on, a plan without online payments and a restricted subscription are blockers (D-4)', async () => {
        const f = await company()
        const plan = await scope.withPlatformTransaction(async (tx) => {
          const row = await tx.plan.create({
            data: {
              code: 's9-' + ++counter + '-' + suffix.slice(0, 8),
              name: 'Synthetic',
            },
          })
          return tx.planVersion.create({
            data: {
              planId: row.id,
              version: 1,
              amount: '99.90',
              entitlements: {
                schema: 1,
                limits: { equipments: null, staffSeats: 2 },
                features: Object.fromEntries(
                  ENTITLEMENT_FEATURES.map((key) => [
                    key,
                    key !== 'onlinePayments',
                  ])
                ),
              },
            },
          })
        })
        await scope.withPlatformTransaction((tx) =>
          tx.subscription.create({
            data: {
              tenantId: f.tenantId,
              planVersionId: plan.id,
              status: 'ACTIVE',
            },
          })
        )
        const enforced = owner({ enforcement: () => 'on' })
        expect(await enforced.offer(f.actor)).toMatchObject({
          available: false,
          blocker: 'MODULE_NOT_IN_PLAN',
        })
        const version = (await owner().offer(f.actor)).companyDataVersion!
        await expect(
          enforced.request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(402, 'MODULE_NOT_IN_PLAN'))
        const shadowed: unknown[] = []
        expect(
          await owner({
            enforcement: () => 'shadow',
            shadow: (entry) => shadowed.push(entry),
          }).offer(f.actor)
        ).toMatchObject({ available: true })
        expect(shadowed).toEqual([
          { tenantId: f.tenantId, code: 'MODULE_NOT_IN_PLAN' },
        ])
        // An invalid enforcement value fails closed, as `on`.
        const invalid = owner({ enforcement: () => 'enforce' })
        expect(await invalid.offer(f.actor)).toMatchObject({
          available: false,
          blocker: 'MODULE_NOT_IN_PLAN',
        })
        await expect(
          invalid.request(
            f.actor,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(402, 'MODULE_NOT_IN_PLAN'))
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { access: 'RESTRICTED' },
          })
        )
        expect(await enforced.offer(f.actor)).toMatchObject({
          blocker: 'SUBSCRIPTION_RESTRICTED',
        })
        expect(await owner().offer(f.actor)).toMatchObject({
          available: true,
        })
      })

      it('an identical request after the worker claimed the first one is refused, never accepted again', async () => {
        const f = await company()
        const created = await requested(f)
        fake.inject({
          method: 'GET',
          path: '/accounts',
          fault: { kind: 'status', status: 503 },
        })
        await deliver(created)
        expect(await account(created.id)).toMatchObject({
          status: 'PROVISIONING',
          provisioningAttempts: 1,
        })
        const pending = await request(created.id)
        expect(pending).toMatchObject(live)
        await expect(
          owner().request(
            f.actor,
            { ...commercial, companyDataVersion: pending.companyDataVersion },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS'))
      })

      it('the offer suggests the registered phone only when it is a mobile number', async () => {
        const landline = await company({ phone: '(11) 3333-4444' })
        expect(await owner().offer(landline.actor)).toMatchObject({
          available: true,
          suggestedMobilePhone: null,
        })
        const mobile = await company({ phone: '(21) 99876-5432' })
        expect(await owner().offer(mobile.actor)).toMatchObject({
          available: true,
          suggestedMobilePhone: '21998765432',
        })
      })

      it('the offer reports the outcome of the most recent returned request', async () => {
        const f = await company()
        const rejected = await requested(f)
        fake.inject({
          method: 'POST',
          path: '/accounts',
          fault: {
            kind: 'status',
            status: 400,
            body: {
              errors: [{ code: 'invalid_incomeValue', description: 'x' }],
            },
          },
        })
        await deliver(rejected)
        expect(await owner().offer(f.actor)).toMatchObject({
          available: true,
          lastRequestOutcome: 'REJECTED_DATA',
        })
        advance(60_000)
        const cancelled = await requested(f)
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { addressNumber: '999' },
          })
        )
        await deliver(cancelled)
        expect(await account(cancelled.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'COMPANY_DATA_CHANGED',
        })
        expect(await owner().offer(f.actor)).toMatchObject({
          available: true,
          lastRequestOutcome: 'CANCELLED',
        })
      })

      it('the version covers every field sent, the site included: another site is another version', async () => {
        const f = await company()
        const data = await scope.withPlatformTransaction((tx) =>
          readSubaccountCompany(tx, f.tenantId, f.owner.id, site)
        )
        const sent = data!.company
        const changes: Record<string, string> = {
          name: 'Outra Locadora Ltda',
          cpfCnpj: '11222333000181',
          email: 'outro@example.test',
          loginEmail: 'outro-login@example.test',
          companyType: 'MEI',
          address: 'Rua Outra',
          addressNumber: '1',
          complement: 'Sala 2',
          province: 'Outro Bairro',
          postalCode: '02002000',
          site: 'https://outra.example.test',
        }
        expect(Object.keys(sent).filter((key) => !(key in changes))).toEqual([])
        for (const [key, value] of Object.entries(changes))
          expect(companyDataVersion({ ...sent, [key]: value }), key).not.toBe(
            data!.version
          )
        const moved = (slug: string) =>
          'https://' + slug + '.outra.example.test'
        const before = await owner().offer(f.actor)
        const elsewhere = owner({
          configuration: () => settings({ site: moved }),
        })
        const after = await elsewhere.offer(f.actor)
        expect(after.company?.site).toBe(moved(f.tenantId))
        expect(after.companyDataVersion).not.toBe(before.companyDataVersion)
        await expect(
          elsewhere.request(
            f.actor,
            { ...commercial, companyDataVersion: before.companyDataVersion },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'COMPANY_DATA_CHANGED'))
        // The worker sends the site of its own configuration: a request confirmed under another one is cancelled.
        const created = await requested(f)
        await deliver(created, worker({ site: moved }))
        expect(fake.requests).toHaveLength(0)
        expect(await account(created.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'COMPANY_DATA_CHANGED',
        })
      })

      it('only a current acceptance of the partner notice counts: a future one does not; a withdrawn one cannot exist', async () => {
        const f = await company({ notice: false })
        await unsafe.legalAcceptance.create({
          data: {
            userId: f.owner.id,
            tenantId: f.tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'b'.repeat(64),
            acceptedAt: new Date(clock.getTime() + 60_000),
          },
        })
        expect(await owner().offer(f.actor)).toMatchObject({
          available: false,
          blocker: 'PAYMENTS_NOTICE_REQUIRED',
        })
        // `withdrawnAt: null` is defense in depth: the database refuses a withdrawn partner notice.
        await expect(
          db.query(
            `INSERT INTO legal_acceptances (id, "userId", "tenantId", kind, version, "textSha256", "acceptedAt", "withdrawnAt")
             VALUES ($1, $2, $3, 'PAYMENTS_PARTNER_NOTICE', '2026-10-01', $4, $5, $6)`,
            [
              'withdrawn-' + f.tenantId,
              f.owner.id,
              f.tenantId,
              'c'.repeat(64),
              new Date(clock.getTime() - 60_000),
              clock,
            ]
          )
        ).rejects.toThrow(/legal_withdrawal_marketing_only/)
        advance(60_000)
        expect(await owner().offer(f.actor)).toMatchObject({
          available: true,
          blocker: null,
        })
      })

      it("only the current owner's acceptance of the partner notice counts, never the previous owner's", async () => {
        const f = await company()
        // The previous owner accepted the notice; the new owner, another ADMIN of the company, has not.
        const next = await changeOwner(f)
        expect(
          await unsafe.legalAcceptance.count({
            where: {
              tenantId: f.tenantId,
              userId: f.owner.id,
              kind: 'PAYMENTS_PARTNER_NOTICE',
            },
          })
        ).toBe(1)
        expect(await owner().offer(next)).toMatchObject({
          available: false,
          blocker: 'PAYMENTS_NOTICE_REQUIRED',
        })
        const version = await versionFor(f.tenantId, next.userId)
        await expect(
          owner().request(
            next,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENTS_NOTICE_REQUIRED'))
        expect(
          await unsafe.paymentAccount.count({ where: { tenantId: f.tenantId } })
        ).toBe(0)
        await unsafe.legalAcceptance.create({
          data: {
            userId: next.userId,
            tenantId: f.tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'd'.repeat(64),
            acceptedAt: new Date(clock.getTime() - 1000),
          },
        })
        const offer = await owner().offer(next)
        expect(offer).toMatchObject({ available: true, blocker: null })
        expect(offer.companyDataVersion).toBe(version)
        expect(
          await owner().request(
            next,
            { ...commercial, companyDataVersion: version },
            clock.getTime()
          )
        ).toEqual({ accepted: true })
      })

      it('legacy or credentialed integrations block; a disabled shell of a cancelled request does not (create and connect)', async () => {
        const legacy = await company()
        await scope.withPlatformTransaction((tx) =>
          tx.tenantIntegration.create({
            data: {
              tenantId: legacy.tenantId,
              provider: 'ASAAS',
              credentialsRef: 'env:LOCADORA_INTEGRATION_LEGACY',
              status: 'DISABLED',
            },
          })
        )
        expect(await owner().offer(legacy.actor)).toMatchObject({
          blocker: 'ACCOUNT_EXISTS',
        })
        await expect(
          owner().request(
            legacy.actor,
            {
              ...commercial,
              companyDataVersion: (await requestedVersion(legacy))!,
            },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_INTEGRATION_ALREADY_EXISTS'))
        const shell = await company()
        const cancelled = await requested(shell)
        await createProvisioningRequestsMaintenance({
          transaction: scope.withPlatformTransaction,
          creation: { enabled: false, model: null },
          now,
        }).run()
        expect(await account(cancelled.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'CREATION_DISABLED',
          integration: { status: 'DISABLED', webhookTokenHash: null },
        })
        expect(await owner().offer(shell.actor)).toMatchObject({
          available: true,
          lastRequestOutcome: 'CANCELLED',
        })
        const apiKey = '$aact_hmlg_' + 'shellconnection'.repeat(4)
        expect(
          await createOwnerPaymentAccountConnection({
            transaction: scope.withProvisioningTransaction,
            vault,
            environment: 'sandbox',
            read: async () => ({
              document: shell.document,
              status: {
                id: 'status',
                commercialInfo: 'PENDING' as const,
                bankAccountInfo: 'PENDING' as const,
                documentation: 'PENDING' as const,
                general: 'PENDING' as const,
              },
            }),
            now,
          })(shell.actor, { apiKey, authenticatedAt: clock.getTime() })
        ).toEqual({ accepted: true })
        expect(
          await unsafe.tenantIntegration.count({
            where: { tenantId: shell.tenantId },
          })
        ).toBe(2)
      })

      it('an unavailable creation refuses the request and the offer says so', async () => {
        const f = await company()
        const off = owner({ configuration: () => null })
        expect(await off.offer(f.actor)).toEqual({
          available: false,
          blocker: 'CREATION_UNAVAILABLE',
          model: null,
          company: null,
          suggestedMobilePhone: null,
          companyDataVersion: null,
          lastRequestOutcome: null,
        })
        await expect(
          off.request(
            f.actor,
            { ...commercial, companyDataVersion: 'a'.repeat(64) },
            clock.getTime()
          )
        ).rejects.toEqual(refused(409, 'PAYMENT_ACCOUNT_CREATION_UNAVAILABLE'))
        await expect(
          owner().request(
            f.actor,
            {
              ...commercial,
              incomeValue: 98765.43,
              companyDataVersion: 'a'.repeat(64),
            },
            clock.getTime()
          )
        ).rejects.toEqual(refused(400, 'INVALID_INPUT'))
      })
    })

    async function requestedVersion(f: Company) {
      const offer = await owner({ enforcement: () => 'off' }).offer(f.actor)
      if (offer.companyDataVersion) return offer.companyDataVersion
      // A blocked offer hides the version: recompute it from an unrestricted reading of the same data.
      const { readSubaccountCompany } =
        await import('../../packages/backend/src/modules/payment-accounts/subaccount-company')
      return scope.withPlatformTransaction(
        async (tx) =>
          (await readSubaccountCompany(tx, f.tenantId, f.owner.id, site))
            ?.version
      )
    }

    describe('creation worker (B5)', () => {
      const TOKEN = 'synthetic-creation-webhook-token-' + 'x'.repeat(16)
      const timeout = () => new DOMException('synthetic', 'TimeoutError')
      let postAttempts = 0
      /** Intercepts POST /accounts at the transport (before the double) and counts every attempt. */
      function onPost(
        hook: (url: string, init: RequestInit) => Promise<Response>
      ) {
        const base = transport
        transport = async (url, init) => {
          if (
            init.method === 'POST' &&
            new URL(url).pathname === '/v3/accounts'
          ) {
            postAttempts++
            return hook(url, init)
          }
          return base(url, init)
        }
      }
      beforeEach(() => {
        postAttempts = 0
        onPost((url, init) => fake.fetch(url, init))
      })
      const tokenWorker = (
        extra: Partial<Parameters<typeof createSubaccountProvisioning>[0]> = {}
      ) => worker({ token: () => new AsaasSecretValue(TOKEN), ...extra })
      const keyOf = (integrationId: string) =>
        scope.withPlatformTransaction(async (tx) => {
          const row = await account(
            (
              await unsafe.paymentAccount.findFirstOrThrow({
                where: { integrationId },
              })
            ).id
          )
          return vault.reveal(tx, {
            tenantId: row.tenantId,
            integrationId,
            purpose: 'ASAAS_API_KEY',
            environment: 'sandbox',
          })
        })
      /** A subaccount the root already created for this CNPJ (outside the platform flow). */
      async function remoteAccount(document: string) {
        const response = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/accounts',
          {
            method: 'POST',
            headers: {
              access_token: fake.rootApiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              name: 'Remote company',
              email: 'remote@example.test',
              cpfCnpj: document,
              companyType: 'LIMITED',
              mobilePhone: '11911112222',
              incomeValue: 1000,
              address: 'Rua Remota',
              addressNumber: '1',
              province: 'Centro',
              postalCode: '01001000',
            }),
          }
        )
        const body = (await response.json()) as { id: string }
        fake.clearRecords()
        return body.id
      }
      const actions = async (tenantId: string) =>
        (await audits(tenantId)).map((row) => row.action)

      it('S1/S26: one GET, the durable intent, one POST and the key sealed by the first transaction after the response', async () => {
        const f = await company()
        const created = await requested(f)
        const events: string[] = []
        const traced: typeof scope.withPlatformTransaction = (operation) => {
          events.push('transaction')
          return scope.withPlatformTransaction(operation)
        }
        const tracedVault = {
          store: (...args: Parameters<typeof vault.store>) => {
            events.push('store')
            return vault.store(...args)
          },
          activate: vault.activate,
          fingerprint: vault.fingerprint,
        }
        onPost(async (url, init) => {
          events.push('post')
          return fake.fetch(url, init)
        })
        await deliver(
          created,
          tokenWorker({ transaction: traced, vault: tracedVault })
        )
        const afterPost = events.slice(events.indexOf('post') + 1)
        expect(afterPost.slice(0, 2)).toEqual(['transaction', 'store'])
        expect(lookups(f.document)).toBe(1)
        expect(posts(f.document)).toBe(1)
        const row = await account(created.id)
        expect(row).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
          healthIssue: null,
          lockedUntil: null,
          provisioningAttempts: 1,
          nextAttemptAt: new Date(clock.getTime() + 15_000),
          integration: {
            status: 'PROVISIONING',
            externalAccountId: row.providerAccountId,
            webhookTokenHash: createHash('sha256').update(TOKEN).digest('hex'),
          },
        })
        expect(row.providerAccountId).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(row.walletId).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(await request(created.id)).toMatchObject(purged('CREATED'))
        const stored = await secrets(created.integrationId)
        expect(stored).toEqual([
          expect.objectContaining({
            state: 'ACTIVE',
            purpose: 'ASAAS_API_KEY',
          }),
        ])
        // The sealed key is the one the provider issued for this very account.
        const key = await keyOf(created.integrationId)
        const status = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/myAccount/status',
          { headers: { access_token: key.use((value) => value) } }
        )
        expect(((await status.json()) as { id: string }).id).toBe(
          row.providerAccountId
        )
        // The exact declared values, and nothing else, are the body of the only POST and the account's data.
        expect(
          fake.requests
            .filter((r) => r.method === 'POST' && r.path === '/accounts')
            .map((r) => r.body)
        ).toEqual([
          expect.objectContaining({
            cpfCnpj: f.document,
            incomeValue: 98765.43,
            mobilePhone: '11987654321',
          }),
        ])
        const info = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/myAccount/commercialInfo',
          { headers: { access_token: key.use((value) => value) } }
        )
        expect(await info.json()).toMatchObject({
          cpfCnpj: f.document,
          incomeValue: 98765.43,
          mobilePhone: '11987654321',
        })
        // The embedded webhook: same name and URL the health worker looks for, authenticated by the random token.
        fake.setAccountStatus(row.providerAccountId!, { general: 'APPROVED' })
        const hook = fake.deliveries.at(-1)!
        expect(hook.url).toBe(
          'https://api.example.test/api/webhooks/asaas/' + created.integrationId
        )
        expect(
          fake.deliveryRequest(hook).headers.get('asaas-access-token')
        ).toBe(TOKEN)
        const hooks = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/webhooks',
          { headers: { access_token: key.use((value) => value) } }
        )
        expect(((await hooks.json()) as { data: unknown[] }).data).toEqual([
          expect.objectContaining({
            name: 'Locadora-' + created.integrationId,
            url:
              'https://api.example.test/api/webhooks/asaas/' +
              created.integrationId,
          }),
        ])
        const queued = await outbox(created.id)
        const next = new Date(clock.getTime() + 15_000)
        expect(queued.map((event) => [event.topic, event.dedupeKey])).toEqual(
          expect.arrayContaining([
            [
              'payment-accounts.provisioning',
              'pa:create:' + created.id + ':' + clock.toISOString(),
            ],
            [
              'payment-accounts.provisioning-recovery',
              'subaccount-recovery:' +
                created.id +
                ':' +
                new Date(clock.getTime() + 300_000).toISOString(),
            ],
            [
              'payment-accounts.health',
              'account-health:' + created.id + ':' + next.toISOString(),
            ],
          ])
        )
        expect(
          queued.find((event) => event.topic === 'payment-accounts.health')
            ?.availableAt
        ).toEqual(next)
        expect((await actions(f.tenantId)).sort()).toEqual([
          'payment-account.provisioning.create-requested',
          'payment-account.provisioning.created',
          'payment-account.provisioning.requested',
        ])
        const evidence = JSON.stringify([await audits(f.tenantId), queued, row])
        for (const marker of [
          '98765',
          '11987654321',
          TOKEN,
          key.use((value) => value),
        ])
          expect(evidence).not.toContain(marker)
      })

      it('S2: a key in accessToken keeps its provider id, expiry and idle expiry', async () => {
        const f = await company()
        const created = await requested(f)
        // The same issued key, in the accessToken shape (VERIFICAR-SANDBOX: which one each model returns).
        onPost(async (url, init) => {
          const response = await fake.fetch(url, init)
          const { apiKey, ...body } = (await response.json()) as Record<
            string,
            unknown
          >
          return Response.json({
            ...body,
            accessToken: {
              id: 'token_' + f.tenantId.replaceAll('-', '_'),
              apiKey,
              expirationDate: '2027-10-07 00:00:00',
              projectedExpirationDateByLackOfUse: '2027-01-05 00:00:00',
            },
          })
        })
        await deliver(created, tokenWorker())
        const [secret] = await secrets(created.integrationId)
        expect(secret).toMatchObject({
          state: 'ACTIVE',
          providerCredentialId: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
          expiresAt: expect.any(Date),
        })
        expect((await account(created.id)).keyIdleExpiresAt).toEqual(
          expect.any(Date)
        )
      })

      it('S3: an account the root already has is bound for manual key recovery, without any POST', async () => {
        const f = await company()
        const created = await requested(f)
        const remote = await remoteAccount(f.document)
        await deliver(created)
        expect(lookups(f.document)).toBe(1)
        expect(postAttempts).toBe(0)
        expect(await account(created.id)).toMatchObject({
          status: 'KEY_RECOVERY_REQUIRED',
          lastErrorCode: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
          providerAccountId: remote,
          integration: { externalAccountId: remote },
        })
        expect(await secrets(created.integrationId)).toEqual([])
        expect(await request(created.id)).toMatchObject(
          purged('EXISTING_ACCOUNT')
        )
      })

      it.each([
        [
          'ambiguous',
          {
            object: 'list',
            hasMore: false,
            totalCount: 2,
            limit: 2,
            offset: 0,
            data: [
              { id: 'acc_one', cpfCnpj: '', walletId: 'w_one' },
              { id: 'acc_two', cpfCnpj: '', walletId: 'w_two' },
            ],
          },
        ],
        ['malformed', 'not json'],
      ] as const)(
        'S4: a %s lookup goes to review without any POST',
        async (_label, body) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'GET',
            path: '/accounts',
            fault: {
              kind: 'body',
              body:
                typeof body === 'string'
                  ? body
                  : {
                      ...body,
                      data: body.data.map((row) => ({
                        ...row,
                        cpfCnpj: f.document,
                      })),
                    },
            },
          })
          await deliver(created)
          expect(postAttempts).toBe(0)
          expect(await account(created.id)).toMatchObject({
            status: 'BLOCKED',
            lastErrorCode: 'SUBACCOUNT_LOOKUP_INVALID',
          })
          expect(await request(created.id)).toMatchObject(purged('BLOCKED'))
        }
      )

      it.each([
        [503, undefined, 300_000],
        [429, '900', 900_000],
      ] as const)(
        'S5: an unavailable lookup (%s, Retry-After %s) keeps the request; the sweep re-delivers under a new key when due',
        async (status, retryAfter, wait) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'GET',
            path: '/accounts',
            fault: {
              kind: 'status',
              status,
              ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
            },
          })
          await deliver(created)
          expect(postAttempts).toBe(0)
          const waiting = await account(created.id)
          expect(waiting).toMatchObject({
            status: 'PROVISIONING',
            lastErrorCode: 'SUBACCOUNT_LOOKUP_UNAVAILABLE',
            lockedUntil: null,
            provisioningAttempts: 1,
            nextAttemptAt: new Date(clock.getTime() + wait),
          })
          expect(await request(created.id)).toMatchObject(live)
          // A delivery before the due instant ends without any provider call or change.
          await deliver(created)
          expect(lookups(f.document)).toBe(1)
          expect(await account(created.id)).toMatchObject({
            provisioningAttempts: 1,
            updatedAt: waiting.updatedAt,
          })
          expect(await worker().enqueue()).toBe(0)
          advance(wait)
          expect(await worker().enqueue()).toBeGreaterThanOrEqual(1)
          expect(
            (await outbox(created.id)).filter(
              (event) =>
                event.dedupeKey ===
                'pa:create:' + created.id + ':' + clock.toISOString()
            )
          ).toHaveLength(1)
          await deliver(created, tokenWorker())
          expect(lookups(f.document)).toBe(2)
          expect(postAttempts).toBe(1)
          expect((await account(created.id)).status).toBe('AWAITING_OWNER')
        }
      )

      it.each([
        ['S6 timeout', async () => Promise.reject(timeout())],
        [
          'S7 applied then timeout',
          async (url: string, init: RequestInit) => {
            await fake.fetch(url, init)
            throw timeout()
          },
        ],
        [
          'S9 network',
          async () => Promise.reject(new TypeError('synthetic network')),
        ],
      ] as const)(
        '%s: never repeats the POST; only the GET inspection decides',
        async (label, hook) => {
          const f = await company()
          const created = await requested(f)
          onPost(hook)
          await deliver(created)
          expect(await account(created.id)).toMatchObject({
            status: 'UNKNOWN',
            lastErrorCode: 'SUBACCOUNT_CREATE_UNKNOWN',
            lockedUntil: null,
          })
          expect(await request(created.id)).toMatchObject(purged('UNCERTAIN'))
          expect(await actions(f.tenantId)).toContain(
            'payment-account.provisioning.uncertain'
          )
          for (let cycle = 0; cycle < 2; cycle++) {
            advance(300_000)
            await inspect(created)
            await deliver(created)
          }
          expect(postAttempts).toBe(1)
          const after = await account(created.id)
          if (label.startsWith('S7'))
            expect(after).toMatchObject({
              status: 'KEY_RECOVERY_REQUIRED',
              providerAccountId: expect.any(String),
            })
          else
            expect(after).toMatchObject({
              status: 'UNKNOWN',
              lastErrorCode: 'SUBACCOUNT_NOT_OBSERVED',
            })
          expect(await secrets(created.integrationId)).toEqual([])
        }
      )

      it.each([500, 502, 503] as const)(
        'S8: a %s answer to the POST is uncertain and never repeated',
        async (status) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'POST',
            path: '/accounts',
            fault: { kind: 'status', status },
          })
          await deliver(created)
          await deliver(created)
          expect(postAttempts).toBe(1)
          expect(await account(created.id)).toMatchObject({
            status: 'UNKNOWN',
            lastErrorCode: 'SUBACCOUNT_CREATE_UNKNOWN',
          })
        }
      )

      it.each([
        [400, 'SUBACCOUNT_CREATE_REJECTED', 'REJECTED_DATA'],
        [403, 'SUBACCOUNT_CREATE_FORBIDDEN', 'REJECTED_PROVIDER'],
      ] as const)(
        'S10/S11: a definite %s without an account is returned to the owner, who can ask again (D-3)',
        async (status, code, outcome) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'POST',
            path: '/accounts',
            fault: {
              kind: 'status',
              status,
              body: {
                errors: [{ code: 'invalid_mobilePhone', description: 'x' }],
              },
            },
          })
          await deliver(created)
          expect(await account(created.id)).toMatchObject({
            status: 'DISCONNECTED',
            disconnectedAt: expect.any(Date),
            lastErrorCode: code,
            integration: {
              status: 'DISABLED',
              webhookTokenHash: null,
              externalAccountId: null,
            },
          })
          expect(await request(created.id)).toMatchObject(purged('REJECTED'))
          const rejected = (await audits(f.tenantId)).find(
            (row) => row.action === 'payment-account.provisioning.rejected'
          )
          expect(rejected).toMatchObject({
            reasonCategory: code,
            metadata: { status, providerCodes: ['invalid_mobilePhone'] },
          })
          // The inspection queued before the POST finds nothing to do.
          advance(300_000)
          await inspect(created)
          expect((await account(created.id)).status).toBe('DISCONNECTED')
          expect(await owner().offer(f.actor)).toMatchObject({
            available: true,
            lastRequestOutcome: outcome,
          })
          const again = await requested(f)
          expect(again.id).not.toBe(created.id)
          expect(again.integrationId).not.toBe(created.integrationId)
          await deliver(again)
          expect(lookups(f.document)).toBe(2)
          expect(postAttempts).toBe(2)
          expect((await account(again.id)).status).toBe('AWAITING_OWNER')
        }
      )

      it.each([
        [undefined, 300_000],
        ['900', 900_000],
      ] as const)(
        'S12: 429 (Retry-After %s) was not sent: the request waits and the next delivery looks up again',
        async (retryAfter, wait) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'POST',
            path: '/accounts',
            fault: {
              kind: 'status',
              status: 429,
              ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
            },
          })
          await deliver(created)
          expect(await account(created.id)).toMatchObject({
            status: 'PROVISIONING',
            lastErrorCode: 'SUBACCOUNT_CREATE_NOT_SENT',
            lockedUntil: null,
            nextAttemptAt: new Date(clock.getTime() + wait),
            integration: { webhookTokenHash: null },
          })
          expect(await request(created.id)).toMatchObject(live)
          advance(wait)
          expect(await worker().enqueue()).toBeGreaterThanOrEqual(1)
          await deliver(created, tokenWorker())
          expect(lookups(f.document)).toBe(2)
          expect(postAttempts).toBe(2)
          expect((await account(created.id)).status).toBe('AWAITING_OWNER')
        }
      )

      it.each([
        ['an unexpected shape', { id: 42 }],
        ['an illegible body', 'not json'],
      ] as const)(
        'S13: a 2xx with %s after applying is uncertain; the inspection finds the account',
        async (_label, body) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method: 'POST',
            path: '/accounts',
            fault: { kind: 'body', body, apply: true },
          })
          await deliver(created)
          expect((await account(created.id)).lastErrorCode).toBe(
            'SUBACCOUNT_CREATE_UNKNOWN'
          )
          advance(300_000)
          await inspect(created)
          expect(postAttempts).toBe(1)
          expect(await account(created.id)).toMatchObject({
            status: 'KEY_RECOVERY_REQUIRED',
            providerAccountId: expect.any(String),
          })
        }
      )

      it('S14: a 2xx without a key binds the references for manual recovery', async () => {
        const f = await company()
        const created = await requested(f)
        onPost(async (url, init) => {
          const response = await fake.fetch(url, init)
          const body = (await response.json()) as Record<string, unknown>
          delete body.apiKey
          return Response.json(body)
        })
        await deliver(created)
        expect(await account(created.id)).toMatchObject({
          status: 'KEY_RECOVERY_REQUIRED',
          lastErrorCode: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
          providerAccountId: expect.any(String),
        })
        expect(await request(created.id)).toMatchObject(purged('CREATED'))
        expect(await secrets(created.integrationId)).toEqual([])
      })

      it('S15a: three failed seals and a fourth success create the account normally', async () => {
        const f = await company()
        const created = await requested(f)
        let calls = 0
        const flaky = {
          store: async (...args: Parameters<typeof vault.store>) => {
            if (++calls <= 3) throw new Error('synthetic-store-failure')
            return vault.store(...args)
          },
          activate: vault.activate,
          fingerprint: vault.fingerprint,
        }
        await deliver(created, worker({ vault: flaky }))
        expect(calls).toBe(4)
        expect((await account(created.id)).status).toBe('AWAITING_OWNER')
        expect(await secrets(created.integrationId)).toHaveLength(1)
      })

      it('S15b: four failed seals require manual recovery without any secret', async () => {
        const f = await company()
        const created = await requested(f)
        let calls = 0
        const broken = {
          store: async () => {
            calls++
            throw new Error('synthetic-store-failure')
          },
          activate: vault.activate,
          fingerprint: vault.fingerprint,
        }
        await deliver(created, worker({ vault: broken }))
        expect(calls).toBe(4)
        expect(postAttempts).toBe(1)
        expect(await account(created.id)).toMatchObject({
          status: 'KEY_RECOVERY_REQUIRED',
          lastErrorCode: 'SUBACCOUNT_KEY_STORE_FAILED',
          providerAccountId: expect.any(String),
        })
        expect(await secrets(created.integrationId)).toEqual([])
        expect(await request(created.id)).toMatchObject(purged('CREATED'))
      })

      it('S15c: seal and fallback failing leave the intent to the queued inspection, which purges and binds', async () => {
        const f = await company()
        const created = await requested(f)
        let broken = false,
          sleeps = 0
        const transaction: typeof scope.withPlatformTransaction = (
          operation
        ) =>
          broken
            ? Promise.reject(new Error('synthetic-database-down'))
            : scope.withPlatformTransaction(operation)
        await deliver(
          created,
          worker({
            transaction,
            vault: {
              store: async () => {
                throw new Error('synthetic-store-failure')
              },
              activate: vault.activate,
              fingerprint: vault.fingerprint,
            },
            sleep: async () => {
              if (++sleeps === 3) broken = true
            },
          })
        )
        expect(await account(created.id)).toMatchObject({
          status: 'UNKNOWN',
          lastErrorCode: 'SUBACCOUNT_CREATE_PENDING',
        })
        expect(await request(created.id)).toMatchObject(live)
        advance(300_000)
        await inspect(created)
        expect(postAttempts).toBe(1)
        expect(await account(created.id)).toMatchObject({
          status: 'KEY_RECOVERY_REQUIRED',
          providerAccountId: expect.any(String),
        })
        expect(await request(created.id)).toMatchObject(purged('UNCERTAIN'))
      })

      it('S15d: an applied seal whose acknowledgement was lost is success, not a duplicate fingerprint', async () => {
        const f = await company()
        const created = await requested(f)
        let transactions = 0,
          stores = 0
        const transaction: typeof scope.withPlatformTransaction = async (
          operation
        ) => {
          const result = await scope.withPlatformTransaction(operation)
          // Claim, intent, then the seal: committed, but its acknowledgement never arrives.
          if (++transactions === 3) throw new Error('synthetic-lost-ack')
          return result
        }
        await deliver(
          created,
          worker({
            transaction,
            vault: {
              store: (...args: Parameters<typeof vault.store>) => {
                stores++
                return vault.store(...args)
              },
              activate: vault.activate,
              fingerprint: vault.fingerprint,
            },
          })
        )
        expect(stores).toBe(1)
        expect(await account(created.id)).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
        })
        expect(await secrets(created.integrationId)).toHaveLength(1)
      })

      it('S16: the emergency switch after the lookup keeps the request unsent; it is created once lifted', async () => {
        const f = await company()
        const created = await requested(f)
        const base = transport
        transport = async (url, init) => {
          const response = await base(url, init)
          if (init.method === 'GET') outbound = true
          return response
        }
        await deliver(created)
        expect(postAttempts).toBe(0)
        expect(await account(created.id)).toMatchObject({
          status: 'PROVISIONING',
          lastErrorCode: 'SUBACCOUNT_CREATE_NOT_SENT',
        })
        expect(await request(created.id)).toMatchObject(live)
        transport = base
        outbound = false
        advance(300_000)
        await deliver(created, tokenWorker())
        expect(postAttempts).toBe(1)
        expect((await account(created.id)).status).toBe('AWAITING_OWNER')
      })

      it('S17: a second worker during the lookup is refused by the lease, without provider I/O', async () => {
        const f = await company()
        const created = await requested(f)
        let release!: () => void
        let reached!: () => void
        const parked = new Promise<void>((resolve) => (release = resolve))
        const atLookup = new Promise<void>((resolve) => (reached = resolve))
        const base = transport
        transport = async (url, init) => {
          if (
            init.method === 'GET' &&
            new URL(url).pathname === '/v3/accounts'
          ) {
            reached()
            await parked
          }
          return base(url, init)
        }
        const first = deliver(created)
        await atLookup
        await expect(deliver(created)).rejects.toMatchObject({
          message: 'ACCOUNT_BUSY',
        })
        expect(lookups(f.document)).toBe(0)
        expect(postAttempts).toBe(0)
        release()
        await first
        expect(lookups(f.document)).toBe(1)
        expect(postAttempts).toBe(1)
        expect((await account(created.id)).provisioningAttempts).toBe(1)
      })

      it('S17: two workers with the same delivery make one lookup, one POST and one intent', async () => {
        const f = await company()
        const created = await requested(f)
        const results = await Promise.allSettled([
          deliver(created),
          deliver(created),
        ])
        expect(results.some((result) => result.status === 'fulfilled')).toBe(
          true
        )
        for (const result of results)
          if (result.status === 'rejected')
            expect(result.reason).toMatchObject({ message: 'ACCOUNT_BUSY' })
        expect(lookups(f.document)).toBe(1)
        expect(postAttempts).toBe(1)
        expect(
          (await actions(f.tenantId)).filter(
            (action) =>
              action === 'payment-account.provisioning.create-requested'
          )
        ).toHaveLength(1)
      })

      it('S19a: a new owner cancels the old request before any call and can ask again', async () => {
        const f = await company()
        const created = await requested(f)
        const next = await changeOwner(f)
        await deliver(created)
        expect(fake.requests).toHaveLength(0)
        expect(await account(created.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'OWNER_CHANGED',
          integration: { status: 'DISABLED' },
        })
        expect(await request(created.id)).toMatchObject(purged('CANCELLED'))
        await unsafe.legalAcceptance.create({
          data: {
            userId: next.userId,
            tenantId: f.tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'a'.repeat(64),
            acceptedAt: new Date(clock.getTime() - 1000),
          },
        })
        const offer = await owner().offer(next)
        expect(offer).toMatchObject({
          available: true,
          lastRequestOutcome: 'CANCELLED',
        })
        expect(
          await owner().request(
            next,
            { ...commercial, companyDataVersion: offer.companyDataVersion },
            clock.getTime()
          )
        ).toEqual({ accepted: true })
      })

      it.each([
        ['a new owner', 'OWNER_CHANGED_DURING_PROVISIONING'],
        ['an archived company', 'TENANT_ARCHIVED_DURING_PROVISIONING'],
      ] as const)(
        'S19b: %s during the POST: the key is sealed and the account goes to review',
        async (change, code) => {
          const f = await company()
          const created = await requested(f)
          onPost(async (url, init) => {
            const response = await fake.fetch(url, init)
            if (change === 'a new owner') await changeOwner(f)
            else
              await scope.withProvisioningTransaction(f.tenantId, (tx) =>
                tx.organization.update({
                  where: { id: f.tenantId },
                  data: { access: 'ARCHIVED' },
                })
              )
            return response
          })
          await deliver(created)
          expect(await account(created.id)).toMatchObject({
            status: 'BLOCKED',
            lastErrorCode: code,
            providerAccountId: expect.any(String),
            integration: { status: 'PROVISIONING' },
          })
          expect(await secrets(created.integrationId)).toEqual([
            expect.objectContaining({ state: 'ACTIVE' }),
          ])
          expect(
            (await outbox(created.id)).filter(
              (event) => event.topic === 'payment-accounts.health'
            )
          ).toEqual([])
          expect(await request(created.id)).toMatchObject(purged('BLOCKED'))
          expect(
            (await audits(f.tenantId)).find(
              (row) => row.action === 'payment-account.provisioning.blocked'
            )
          ).toMatchObject({ reasonCategory: code })
        }
      )

      it('S20/S21: changed company data or an archived company cancel without calls; an administrative block waits', async () => {
        const changed = await company()
        const first = await requested(changed)
        await scope.withProvisioningTransaction(changed.tenantId, (tx) =>
          tx.organization.update({
            where: { id: changed.tenantId },
            data: { addressNumber: '999' },
          })
        )
        await deliver(first)
        expect(await account(first.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'COMPANY_DATA_CHANGED',
        })
        const archived = await company()
        const second = await requested(archived)
        await scope.withProvisioningTransaction(archived.tenantId, (tx) =>
          tx.organization.update({
            where: { id: archived.tenantId },
            data: { access: 'ARCHIVED' },
          })
        )
        await deliver(second)
        expect(await account(second.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'TENANT_ARCHIVED',
        })
        const held = await company()
        const third = await requested(held)
        await scope.withProvisioningTransaction(held.tenantId, (tx) =>
          tx.organization.update({
            where: { id: held.tenantId },
            data: { status: 'SUSPENDED' },
          })
        )
        await deliver(third)
        expect(await account(third.id)).toMatchObject({
          status: 'PROVISIONING',
          provisioningAttempts: 0,
          nextAttemptAt: new Date(clock.getTime() + 300_000),
        })
        expect(fake.requests).toHaveLength(0)
        // While blocked, the sweep never queues it, even when due.
        advance(300_000)
        const due = 'pa:create:' + third.id + ':' + clock.toISOString()
        const queued = async () =>
          (await outbox(third.id)).filter((event) => event.dedupeKey === due)
        await worker().enqueue()
        expect(await queued()).toEqual([])
        await scope.withProvisioningTransaction(held.tenantId, (tx) =>
          tx.organization.update({
            where: { id: held.tenantId },
            data: { status: 'ACTIVE' },
          })
        )
        expect(await worker().enqueue()).toBeGreaterThanOrEqual(1)
        expect(await queued()).toHaveLength(1)
        await deliver(third, tokenWorker())
        expect((await account(third.id)).status).toBe('AWAITING_OWNER')
      })

      it('S22: the business role never reads another company account nor any request', async () => {
        const a = await company()
        const created = await requested(a)
        const b = await company()
        const read = (
          tenant: string,
          operation: (tx: Prisma.TransactionClient) => Promise<unknown>
        ) =>
          business.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT set_config('app.tenant_id',${tenant},true)`
            return operation(tx)
          })
        expect(
          await read(b.tenantId, (tx) =>
            tx.paymentAccount.count({ where: { id: created.id } })
          )
        ).toBe(0)
        await expect(
          read(a.tenantId, (tx) => tx.paymentAccountProvisioningRequest.count())
        ).rejects.toThrow(/permission denied/)
      })

      it.each([
        ['GET', 401, 'AUTHENTICATION'],
        ['GET', 403, 'FORBIDDEN'],
        ['POST', 401, 'AUTHENTICATION'],
        ['POST', 404, 'NOT_FOUND'],
      ] as const)(
        'S28: %s %s from the root credential leaves the request pending for an hour, never in review',
        async (method, status, reason) => {
          const f = await company()
          const created = await requested(f)
          fake.inject({
            method,
            path: '/accounts',
            fault: { kind: 'status', status },
          })
          await deliver(created)
          expect(await account(created.id)).toMatchObject({
            status: 'PROVISIONING',
            lastErrorCode: 'ROOT_CREDENTIAL_REJECTED',
            lockedUntil: null,
            nextAttemptAt: new Date(clock.getTime() + 3_600_000),
            integration: { status: 'PROVISIONING', webhookTokenHash: null },
          })
          expect(await request(created.id)).toMatchObject(live)
          expect(
            (await audits(f.tenantId)).find(
              (row) =>
                row.action === 'payment-account.provisioning.root-rejected'
            )
          ).toMatchObject({ reasonCategory: reason })
          advance(3_600_000)
          await deliver(created, tokenWorker())
          expect((await account(created.id)).status).toBe('AWAITING_OWNER')
        }
      )

      /** A request accepted concurrently with another company's (both passed the request check before either was stored). */
      async function concurrentRequest(second: Company) {
        const data = await scope.withPlatformTransaction((tx) =>
          readSubaccountCompany(tx, second.tenantId, second.owner.id, site)
        )
        return scope.withProvisioningTransaction(
          second.tenantId,
          async (tx) => {
            const integration = await tx.tenantIntegration.create({
              data: {
                tenantId: second.tenantId,
                provider: 'ASAAS',
                environment: 'sandbox',
                credentialSource: 'VAULT',
                status: 'PROVISIONING',
              },
            })
            const row = await tx.paymentAccount.create({
              data: {
                tenantId: second.tenantId,
                integrationId: integration.id,
                mode: 'ASAAS_SUBACCOUNT',
                subaccountModel: 'STANDARD',
                environment: 'sandbox',
                status: 'PROVISIONING',
                requestedByUserId: second.owner.id,
                nextAttemptAt: clock,
              },
            })
            await tx.paymentAccountProvisioningRequest.create({
              data: {
                tenantId: second.tenantId,
                paymentAccountId: row.id,
                incomeValue: '1000.00',
                mobilePhone: '11987654321',
                companyDataVersion: data!.version,
              },
            })
            return row
          }
        )
      }

      it('S29: two companies with one unverified CNPJ: the first durable intent wins and only one POST happens', async () => {
        const first = await company()
        const second = await company({ document: first.document })
        const a = await requested(first)
        const b = await concurrentRequest(second)
        let arrived = 0,
          release!: () => void
        const both = new Promise<void>((resolve) => (release = resolve))
        const base = transport
        transport = async (url, init) => {
          if (
            init.method === 'GET' &&
            new URL(url).pathname === '/v3/accounts'
          ) {
            if (++arrived === 2) release()
            await both
          }
          return base(url, init)
        }
        await Promise.all([deliver(a), deliver(b)])
        expect(lookups(first.document)).toBe(2)
        expect(postAttempts).toBe(1)
        const states = [await account(a.id), await account(b.id)]
        expect(
          states.filter((row) => row.status === 'AWAITING_OWNER')
        ).toHaveLength(1)
        const loser = states.find((row) => row.status !== 'AWAITING_OWNER')!
        expect(loser).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'DOCUMENT_IN_USE',
        })
        expect(await request(loser.id)).toMatchObject(purged('CANCELLED'))
      })

      /** Runs `action` while the worker waits for its lookup by CNPJ, then lets the lookup answer. */
      function duringLookup(action: () => Promise<unknown>) {
        const base = transport
        let done = false
        transport = async (url, init) => {
          if (
            !done &&
            init.method === 'GET' &&
            new URL(url).pathname === '/v3/accounts'
          ) {
            done = true
            await action()
          }
          return base(url, init)
        }
      }

      it.each([
        ['a new owner', 'OWNER_CHANGED'],
        ['an archived company', 'TENANT_ARCHIVED'],
        ['an administrative block', null],
      ] as const)(
        'S35: %s during the lookup releases the claim without any POST; the next claim decides',
        async (change, code) => {
          const f = await company()
          const created = await requested(f)
          duringLookup(async () => {
            if (change === 'a new owner') await changeOwner(f)
            else
              await scope.withProvisioningTransaction(f.tenantId, (tx) =>
                tx.organization.update({
                  where: { id: f.tenantId },
                  data:
                    change === 'an archived company'
                      ? { access: 'ARCHIVED' }
                      : { status: 'SUSPENDED' },
                })
              )
          })
          await deliver(created)
          expect(lookups(f.document)).toBe(1)
          expect(postAttempts).toBe(0)
          expect(await account(created.id)).toMatchObject({
            status: 'PROVISIONING',
            lastErrorCode: null,
            lockedUntil: null,
            nextAttemptAt: clock,
            provisioningAttempts: 1,
            integration: { webhookTokenHash: null },
          })
          expect(await request(created.id)).toMatchObject(live)
          expect(await actions(f.tenantId)).not.toContain(
            'payment-account.provisioning.create-requested'
          )
          await deliver(created)
          expect(lookups(f.document)).toBe(1)
          expect(postAttempts).toBe(0)
          expect(await account(created.id)).toMatchObject(
            code
              ? { status: 'DISCONNECTED', lastErrorCode: code }
              : {
                  status: 'PROVISIONING',
                  provisioningAttempts: 1,
                  nextAttemptAt: new Date(clock.getTime() + 300_000),
                }
          )
        }
      )

      it.each(['at the claim', 'during the lookup'] as const)(
        'S36: a request purged outside the flow (%s) is an integrity problem: review, without any POST',
        async (when) => {
          const f = await company()
          const created = await requested(f)
          const purge = () =>
            unsafe.paymentAccountProvisioningRequest.update({
              where: { paymentAccountId: created.id },
              data: {
                purgedAt: clock,
                purgeReason: 'CANCELLED',
                incomeValue: null,
                mobilePhone: null,
              },
            })
          if (when === 'at the claim') await purge()
          else duringLookup(purge)
          await deliver(created)
          expect(lookups(f.document)).toBe(when === 'at the claim' ? 0 : 1)
          expect(postAttempts).toBe(0)
          expect(await account(created.id)).toMatchObject({
            status: 'BLOCKED',
            lastErrorCode: 'PROVISIONING_REQUEST_MISSING',
            lockedUntil: null,
            integration: { webhookTokenHash: null },
          })
          expect(
            (await audits(f.tenantId)).find(
              (row) => row.action === 'payment-account.provisioning.blocked'
            )
          ).toMatchObject({ reasonCategory: 'PROVISIONING_REQUEST_MISSING' })
        }
      )

      it('S37: a key recovered by hand during the POST is never displaced: the issued key stays as evidence and the account goes to review', async () => {
        const f = await company()
        const created = await requested(f)
        const manual = '$aact_hmlg_' + 'manualrecoverykey'.repeat(4)
        onPost(async (url, init) => {
          const response = await fake.fetch(url, init)
          await scope.withPlatformTransaction(async (tx) => {
            const stored = await vault.store(
              tx,
              {
                tenantId: f.tenantId,
                integrationId: created.integrationId,
                environment: 'sandbox',
                purpose: 'ASAAS_API_KEY',
              },
              new AsaasSecretValue(manual)
            )
            await vault.activate(tx, stored.id)
          })
          return response
        })
        await deliver(created)
        expect(postAttempts).toBe(1)
        expect(await account(created.id)).toMatchObject({
          status: 'BLOCKED',
          lastErrorCode: 'SUBACCOUNT_KEY_CONFLICT',
          lockedUntil: null,
        })
        expect(
          (await secrets(created.integrationId)).map((row) => row.state).sort()
        ).toEqual(['ACTIVE', 'PENDING'])
        expect(
          (await keyOf(created.integrationId)).use((value) => value === manual)
        ).toBe(true)
        expect(await request(created.id)).toMatchObject(purged('BLOCKED'))
        expect(
          (await outbox(created.id)).filter(
            (event) => event.topic === 'payment-accounts.health'
          )
        ).toEqual([])
      })

      it('S38: the first durable intent wins, not the first request: an undelivered request elsewhere does not stop this one', async () => {
        const first = await company()
        const second = await company({ document: first.document })
        const a = await requested(first)
        const b = await concurrentRequest(second)
        await deliver(b)
        expect(postAttempts).toBe(1)
        expect((await account(b.id)).status).toBe('AWAITING_OWNER')
        await deliver(a)
        expect(postAttempts).toBe(1)
        expect(await account(a.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'DOCUMENT_IN_USE',
        })
        expect(await request(a.id)).toMatchObject(purged('CANCELLED'))
      })

      it('S39: the maintenance purges a live request in every state that can no longer POST, with the reason of that state', async () => {
        const cases = [
          ['DISCONNECTED', 'CANCELLED'],
          ['BLOCKED', 'BLOCKED'],
          ['KEY_RECOVERY_REQUIRED', 'UNCERTAIN'],
          ['AWAITING_OWNER', 'CREATED'],
        ] as const
        const rows: { id: string; reason: string }[] = []
        for (const [status, reason] of cases) {
          const created = await requested(await company())
          // A state written outside the flow, without its purge (a manual repair, an interrupted path).
          await unsafe.paymentAccount.update({
            where: { id: created.id },
            data: {
              status,
              ...(status === 'DISCONNECTED' ? { disconnectedAt: clock } : {}),
            },
          })
          rows.push({ id: created.id, reason })
        }
        const pending = await requested(await company())
        const leased = await requested(await company())
        await unsafe.paymentAccount.update({
          where: { id: leased.id },
          data: {
            status: 'UNKNOWN',
            lastErrorCode: 'SUBACCOUNT_CREATE_PENDING',
            lockedUntil: new Date(clock.getTime() + 300_000),
          },
        })
        await createProvisioningRequestsMaintenance({
          transaction: scope.withPlatformTransaction,
          creation: { enabled: true, model: 'STANDARD' },
          now,
        }).run()
        for (const row of rows)
          expect(await request(row.id), row.reason).toMatchObject(
            purged(row.reason)
          )
        // A request that may still reach the provider keeps its values.
        for (const id of [pending.id, leased.id])
          expect(await request(id)).toMatchObject(live)
        expect(fake.requests).toHaveLength(0)
        // These synthetic states never reach the later sweeps.
        await unsafe.paymentAccount.updateMany({
          where: { id: { in: [...rows.map((row) => row.id), leased.id] } },
          data: { status: 'DISCONNECTED', disconnectedAt: clock },
        })
      })

      it('S40: the maintenance checks the lease again under the lock: a request claimed after the listing is never cancelled', async () => {
        const maintenance = (transaction = scope.withPlatformTransaction) =>
          createProvisioningRequestsMaintenance({
            transaction,
            creation: { enabled: false, model: 'STANDARD' },
            now,
          }).run()
        // Earlier unsent requests are returned first, so the listing below holds only this one.
        await maintenance()
        const f = await company()
        const created = await requested(f)
        let calls = 0
        const result = await maintenance((operation) => {
          // 1: purge, 2: listing, 3: this cancellation; a worker claims the request right before it.
          const claim =
            ++calls === 3
              ? unsafe.paymentAccount.update({
                  where: { id: created.id },
                  data: { lockedUntil: new Date(clock.getTime() + 300_000) },
                })
              : Promise.resolve()
          return claim.then(() => scope.withPlatformTransaction(operation))
        })
        expect(calls).toBe(3)
        expect(result).toMatchObject({ cancelled: 0 })
        expect(await account(created.id)).toMatchObject({
          status: 'PROVISIONING',
          disconnectedAt: null,
        })
        expect(await request(created.id)).toMatchObject(live)
      })

      it('S30: the maintenance purges requests that can no longer POST and cancels unsent ones when creation is off or the model changed', async () => {
        const off = await company()
        const unsent = await requested(off)
        const changed = await company()
        const otherModel = await requested(changed)
        await unsafe.paymentAccount.update({
          where: { id: otherModel.id },
          data: { subaccountModel: 'BAAS' },
        })
        const dead = await company()
        const intent = await requested(dead)
        // A worker that died right after recording its intent (lease expired, POST never repeated).
        await unsafe.paymentAccount.update({
          where: { id: intent.id },
          data: {
            status: 'UNKNOWN',
            lastErrorCode: 'SUBACCOUNT_CREATE_PENDING',
            lockedUntil: new Date(clock.getTime() - 1000),
          },
        })
        const maintenance = (creation: {
          enabled: boolean
          model: 'STANDARD' | 'BAAS' | null
        }) =>
          createProvisioningRequestsMaintenance({
            transaction: scope.withPlatformTransaction,
            creation,
            now,
          }).run()
        // On with an incomplete configuration: nothing is cancelled.
        await maintenance({ enabled: true, model: null })
        expect((await account(unsent.id)).status).toBe('PROVISIONING')
        expect(await request(intent.id)).toMatchObject(purged('UNCERTAIN'))
        await maintenance({ enabled: true, model: 'STANDARD' })
        expect(await account(otherModel.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'MODEL_CHANGED',
        })
        expect((await account(unsent.id)).status).toBe('PROVISIONING')
        await maintenance({ enabled: false, model: 'STANDARD' })
        expect(await account(unsent.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'CREATION_DISABLED',
          integration: { status: 'DISABLED' },
        })
        for (const id of [unsent.id, otherModel.id])
          expect(await request(id)).toMatchObject(purged('CANCELLED'))
        expect(fake.requests).toHaveLength(0)
      })

      it('S31: a late seal over the inspection binding of the same account resumes the owner step; another account is a conflict', async () => {
        const f = await company()
        const created = await requested(f)
        onPost(async (url, init) => {
          const response = await fake.fetch(url, init)
          advance(360_000)
          await inspect(created)
          return response
        })
        await deliver(created, tokenWorker())
        expect(await account(created.id)).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
        })
        expect(await actions(f.tenantId)).toEqual(
          expect.arrayContaining([
            'payment-account.provisioning.key-recovery-required',
            'payment-account.provisioning.key-recovered',
          ])
        )
        const g = await company()
        const other = await requested(g)
        onPost(async (url, init) => {
          const response = await fake.fetch(url, init)
          await unsafe.paymentAccount.update({
            where: { id: other.id },
            data: {
              status: 'KEY_RECOVERY_REQUIRED',
              providerAccountId: 'acc_someone_else',
            },
          })
          return response
        })
        await deliver(other)
        expect(await account(other.id)).toMatchObject({
          status: 'BLOCKED',
          lastErrorCode: 'SUBACCOUNT_REFERENCE_MISMATCH',
          providerAccountId: 'acc_someone_else',
        })
        expect(await secrets(other.integrationId)).toHaveLength(1)
      })

      it('S32: a worker that dies after its intent leaves only GET inspections, and its late result changes nothing', async () => {
        const f = await company()
        const created = await requested(f)
        let fail!: (error: unknown) => void
        onPost(
          () =>
            new Promise<Response>((_resolve, reject) => {
              fail = reject
            })
        )
        const hung = deliver(created)
        await vi.waitFor(async () =>
          expect((await account(created.id)).lastErrorCode).toBe(
            'SUBACCOUNT_CREATE_PENDING'
          )
        )
        advance(300_000)
        await inspect(created)
        expect(await request(created.id)).toMatchObject(purged('UNCERTAIN'))
        const inspected = await account(created.id)
        expect(inspected).toMatchObject({
          status: 'UNKNOWN',
          lastErrorCode: 'SUBACCOUNT_NOT_OBSERVED',
        })
        fail(timeout())
        await hung
        expect(await account(created.id)).toMatchObject({
          status: 'UNKNOWN',
          lastErrorCode: 'SUBACCOUNT_NOT_OBSERVED',
          updatedAt: inspected.updatedAt,
        })
        expect(postAttempts).toBe(1)
        expect(lookups(f.document)).toBe(2)
      })
    })

    describe('after creation: health, account events and the charge barrier (B6/B7)', () => {
      const TOKEN = 'synthetic-creation-webhook-token-' + 'y'.repeat(16)
      const DAY = 86_400_000
      const sha = (value: string) =>
        createHash('sha256').update(value).digest('hex')
      const policy = () => ({
        outboundDisabled: false,
        egress: { kind: 'direct' as const },
      })
      type Row = Awaited<ReturnType<typeof account>>
      const revealOf = (row: { tenantId: string; integrationId: string }) =>
        scope.withPlatformTransaction((tx) =>
          vault.reveal(tx, {
            tenantId: row.tenantId,
            integrationId: row.integrationId,
            purpose: 'ASAAS_API_KEY',
            environment: 'sandbox',
          })
        )
      const accountClient = (
        credential: Parameters<
          typeof readAsaasConnectedAccount
        >[0]['credential']
      ) => ({
        credential,
        environment: 'sandbox' as const,
        fetch: (url: string, init: RequestInit) => transport(url, init),
        policy,
      })
      /** The health worker of the cron composition, with the subaccount key sealed by the creation. */
      const health = () =>
        createConnectedAccountConfiguration({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          origin: 'https://api.example.test',
          email: 'ops@example.test',
          token: (ref, keyId) => vault.webhookToken(ref, keyId),
          provider: async ({ ref }) => {
            const config = accountClient(
              await scope.withPlatformTransaction((tx) =>
                vault.reveal(tx, { ...ref, purpose: 'ASAAS_API_KEY' })
              )
            )
            return {
              identity: () => readAsaasConnectedAccount(config),
              webhooks: createAsaasAccountWebhooks(config),
            }
          },
          now,
        })
      const read = vi.fn(
        async (target: {
          account: { tenantId: string; integrationId: string }
        }) =>
          readAsaasAccountHealth({
            ...accountClient(await revealOf(target.account)),
            subaccount: true,
          })
      )
      const events = () =>
        createAccountWebhookConsumer({
          transaction: scope.withPlatformTransaction,
          read,
          now,
        })
      beforeEach(() => {
        read.mockClear()
      })
      async function created(f: Company) {
        const row = await requested(f)
        await deliver(row, worker({ token: () => new AsaasSecretValue(TOKEN) }))
        return account(row.id)
      }
      const actions = async (tenantId: string) =>
        (await audits(tenantId)).map((row) => row.action)
      /** Runs every due health delivery of the account as the dispatcher would. */
      async function queuedHealth(row: { id: string }) {
        const due = (await outbox(row.id)).filter(
          (event) =>
            event.topic === 'payment-accounts.health' &&
            event.status === 'PENDING' &&
            event.availableAt <= clock
        )
        for (const event of due) {
          await health().handlers['payment-accounts.health']({
            ...event,
            lockedBy: 'local-worker',
          })
          await unsafe.platformOutboxEvent.update({
            where: { id: event.id },
            data: { status: 'COMPLETED' },
          })
        }
        return due.length
      }
      async function sweepHealth(row: { id: string }) {
        // The sweep takes 20 due accounts per run: accounts of earlier cases must not hide this one.
        await unsafe.paymentAccount.updateMany({
          where: { id: { not: row.id }, nextAttemptAt: { lte: clock } },
          data: { nextAttemptAt: new Date('2100-01-01T00:00:00.000Z') },
        })
        await health().enqueue()
        return queuedHealth(row)
      }
      /** One account notification through the platform ingress and the account-event consumer. */
      async function notify(row: Row, body: Record<string, unknown>) {
        await createPlatformAsaasIngress({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
        })({
          source: 'ASAAS_ACCOUNT',
          body,
          payloadHash: sha(JSON.stringify(body)),
          integration: {
            id: row.integrationId,
            tenantId: row.tenantId,
            provider: 'ASAAS',
            externalAccountId: row.integration.externalAccountId,
          },
        })
        const receipt = await unsafe.platformWebhookInbox.findFirstOrThrow({
          where: {
            tenantId: row.tenantId,
            payload: { path: ['id'], equals: body.id as string },
          },
        })
        const event = await unsafe.platformOutboxEvent.findFirstOrThrow({
          where: { aggregateId: receipt.id },
        })
        expect(event.topic).toBe(ACCOUNT_WEBHOOK_TOPIC)
        await events().handlers[ACCOUNT_WEBHOOK_TOPIC]({
          ...event,
          lockedBy: 'local-worker',
          payload: { inboxId: receipt.id },
        })
        return unsafe.platformWebhookInbox.findUniqueOrThrow({
          where: { id: receipt.id },
        })
      }
      const ready = (tenantId: string) =>
        withTenantTransaction(business, { tenantId }, (tx) =>
          assertReceivingAccountReady(tx, tenantId)
        )
      const approveAll = (row: Row) =>
        fake.setAccountStatus(row.providerAccountId!, {
          commercialInfo: 'APPROVED',
          bankAccountInfo: 'APPROVED',
          documentation: 'APPROVED',
          general: 'APPROVED',
        })

      it('S23/S27: the health delivery queued 15 s after sealing replaces the creation token with PUT, without approving', async () => {
        const f = await company()
        const row = await created(f)
        fake.clearRecords()
        // Not due before the 15 s: the delivery is never consumed without effect.
        expect(await queuedHealth(row)).toBe(0)
        advance(15_000)
        expect(await queuedHealth(row)).toBe(1)
        const hooks = fake.requests.filter((r) =>
          r.path.startsWith('/webhooks')
        )
        expect(hooks.map((r) => r.method)).toEqual(['GET', 'PUT', 'GET'])
        const after = await account(row.id)
        expect(after).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: null,
          healthIssue: null,
          approvedAt: null,
          lockedUntil: null,
          nextAttemptAt: new Date(clock.getTime() + DAY),
          integration: {
            status: 'PROVISIONING',
            webhookTokenPreviousHash: sha(TOKEN),
            webhookTokenPreviousUntil: new Date(clock.getTime() + DAY),
          },
        })
        const [key] = await secrets(row.integrationId)
        const recoverable = vault
          .webhookToken(
            {
              tenantId: row.tenantId,
              integrationId: row.integrationId,
              environment: 'sandbox',
            },
            key!.id
          )
          .use((value) => value)
        expect(after.integration.webhookTokenHash).toBe(sha(recoverable))
        // The provider now authenticates its deliveries with the recoverable token.
        fake.setAccountStatus(after.providerAccountId!, {
          commercialInfo: 'AWAITING_APPROVAL',
        })
        expect(
          fake
            .deliveryRequest(fake.deliveries.at(-1)!)
            .headers.get('asaas-access-token')
        ).toBe(recoverable)
        expect(await actions(f.tenantId)).toContain(
          'payment-account.configuration.confirmed'
        )
        // S27: the income value the provider returns is read and never stored.
        expect(
          fake.requests.some(
            (r) =>
              r.method === 'GET' &&
              r.path.startsWith('/myAccount/commercialInfo')
          )
        ).toBe(true)
        const evidence = JSON.stringify([
          after,
          await audits(f.tenantId),
          await outbox(row.id),
          await request(row.id),
          await unsafe.platformWebhookInbox.findMany({
            where: { tenantId: f.tenantId },
          }),
        ])
        for (const marker of ['98765', '11987654321', TOKEN, recoverable])
          expect(evidence).not.toContain(marker)
        await expect(ready(f.tenantId)).rejects.toBeInstanceOf(
          ReceivingAccountNotReadyError
        )
      })

      it('S24: four approved states approve, verify the CNPJ and only then activate the integration; a regression keeps it', async () => {
        const f = await company()
        const row = await created(f)
        advance(15_000)
        await queuedHealth(row)
        approveAll(row)
        advance(DAY)
        expect(await sweepHealth(row)).toBe(1)
        expect(await account(row.id)).toMatchObject({
          status: 'APPROVED',
          approvedAt: clock,
          integration: { status: 'ACTIVE' },
        })
        expect(
          (
            await unsafe.organization.findUniqueOrThrow({
              where: { id: f.tenantId },
            })
          ).documentVerifiedAt
        ).toEqual(clock)
        await expect(ready(f.tenantId)).resolves.toBeUndefined()
        fake.setAccountStatus(row.providerAccountId!, {
          bankAccountInfo: 'REJECTED',
        })
        advance(DAY)
        await sweepHealth(row)
        expect(await account(row.id)).toMatchObject({
          status: 'REJECTED',
          integration: { status: 'ACTIVE' },
        })
        await expect(ready(f.tenantId)).rejects.toBeInstanceOf(
          ReceivingAccountNotReadyError
        )
      })

      it('S34: an approval notified before the health keeps the integration PROVISIONING and makes the health due now', async () => {
        const f = await company()
        const row = await created(f)
        advance(15_000)
        await queuedHealth(row)
        advance(60_000)
        approveAll(row)
        const receipt = await notify(
          await account(row.id),
          fake.deliveries.at(-1)!.body as Record<string, unknown>
        )
        expect(receipt.status).toBe('PROCESSED')
        expect(read).toHaveBeenCalledTimes(1)
        expect(await account(row.id)).toMatchObject({
          status: 'APPROVED',
          nextAttemptAt: clock,
          integration: { status: 'PROVISIONING' },
        })
        // Between the notification and the health confirmation, no new charge.
        await expect(ready(f.tenantId)).rejects.toBeInstanceOf(
          ReceivingAccountNotReadyError
        )
        expect(await sweepHealth(row)).toBe(1)
        expect(await account(row.id)).toMatchObject({
          status: 'APPROVED',
          integration: { status: 'ACTIVE' },
        })
        await expect(ready(f.tenantId)).resolves.toBeUndefined()
      })

      it('an interrupted queue of a subaccount stays restricted, without reconciliation or resuming it', async () => {
        const f = await company()
        const row = await created(f)
        advance(15_000)
        await queuedHealth(row)
        approveAll(row)
        advance(DAY)
        await sweepHealth(row)
        const key = (await revealOf(row)).use((value) => value)
        const listed = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/webhooks',
          { headers: { access_token: key } }
        )
        const [hook] = ((await listed.json()) as { data: { id: string }[] })
          .data
        await fake.fetch(
          'https://api-sandbox.asaas.com/v3/webhooks/' + hook!.id,
          {
            method: 'PUT',
            headers: { access_token: key, 'content-type': 'application/json' },
            body: JSON.stringify({ interrupted: true }),
          }
        )
        fake.clearRecords()
        advance(DAY)
        // Without payment reconciliation (connected accounts only), the delivery is retried later, never resumed.
        await expect(sweepHealth(row)).rejects.toThrow(
          'WEBHOOK_RECONCILIATION_REQUIRED'
        )
        expect(await account(row.id)).toMatchObject({
          status: 'RESTRICTED',
          healthIssue: 'WEBHOOK_INTERRUPTED',
          lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
          integration: { status: 'ACTIVE' },
        })
        expect(fake.requests.filter((r) => r.method !== 'GET')).toEqual([])
        expect(fake.requests.some((r) => r.path.startsWith('/payments'))).toBe(
          false
        )
        await expect(ready(f.tenantId)).rejects.toBeInstanceOf(
          ReceivingAccountNotReadyError
        )
      })

      /** An account of the company opened at the provider outside the platform; the owner connects it with its key. */
      async function connectOwnAccount(f: Company) {
        const response = await fake.fetch(
          'https://api-sandbox.asaas.com/v3/accounts',
          {
            method: 'POST',
            headers: {
              access_token: fake.rootApiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              name: 'Conta propria',
              email: 'own-' + f.tenantId + '@example.test',
              cpfCnpj: f.document,
              companyType: 'LIMITED',
              mobilePhone: '11911112222',
              incomeValue: 1000,
              address: 'Rua Propria',
              addressNumber: '1',
              province: 'Centro',
              postalCode: '01001000',
            }),
          }
        )
        const own = (await response.json()) as { id: string; apiKey: string }
        fake.clearRecords()
        expect(
          await createOwnerPaymentAccountConnection({
            transaction: scope.withProvisioningTransaction,
            vault,
            environment: 'sandbox',
            read: (key) => readAsaasConnectedAccount(accountClient(key)),
            now,
          })(f.actor, { apiKey: own.apiKey, authenticatedAt: clock.getTime() })
        ).toEqual({ accepted: true })
        const row = await current(f.tenantId)
        // Due now on the test clock (the column default is the database clock).
        await unsafe.paymentAccount.update({
          where: { id: row.id },
          data: { nextAttemptAt: clock },
        })
        return { providerAccountId: own.id, row: await account(row.id) }
      }
      /** The integrations a new charge can select, read by the business role as `payment-request.ts` does. */
      const selectable = (tenantId: string) =>
        withTenantTransaction(business, { tenantId }, (tx) =>
          tx.tenantIntegration.findMany({
            where: { tenantId, provider: 'ASAAS', status: 'ACTIVE' },
            select: { id: true },
          })
        )

      it('the connected branch is unchanged: confirmed while the provider still reviews it, its integration is ACTIVE and charges select it', async () => {
        const f = await company()
        const { providerAccountId, row } = await connectOwnAccount(f)
        expect(row).toMatchObject({
          mode: 'ASAAS_CONNECTED_ACCOUNT',
          status: 'RESTRICTED',
          healthIssue: 'WEBHOOK_MISSING',
          integration: { status: 'PROVISIONING' },
        })
        expect(await selectable(f.tenantId)).toEqual([])
        await health().handlers['payment-accounts.health'](
          delivery(row, 'payment-accounts.health')
        )
        // Nothing is approved at the provider yet: the configuration is confirmed and the integration activated.
        expect(await account(row.id)).toMatchObject({
          status: 'AWAITING_OWNER',
          healthIssue: null,
          approvedAt: null,
          integration: { status: 'ACTIVE' },
        })
        expect(await actions(f.tenantId)).toContain(
          'payment-account.configuration.confirmed'
        )
        await expect(ready(f.tenantId)).resolves.toBeUndefined()
        expect(await selectable(f.tenantId)).toEqual([
          { id: row.integrationId },
        ])
        fake.setAccountStatus(providerAccountId, {
          commercialInfo: 'AWAITING_APPROVAL',
        })
        advance(DAY)
        expect(await sweepHealth(row)).toBe(1)
        expect(await account(row.id)).toMatchObject({
          status: 'UNDER_REVIEW',
          approvedAt: null,
          integration: { status: 'ACTIVE' },
        })
        expect(await selectable(f.tenantId)).toEqual([
          { id: row.integrationId },
        ])
      })

      it('the barrier reads only the current account: a cancelled request before it never refuses the charges of the connected account', async () => {
        const f = await company()
        const cancelled = await requested(f)
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { addressNumber: '999' },
          })
        )
        await deliver(cancelled)
        expect(await account(cancelled.id)).toMatchObject({
          mode: 'ASAAS_SUBACCOUNT',
          status: 'DISCONNECTED',
          disconnectedAt: expect.any(Date),
          integration: { status: 'DISABLED' },
        })
        // The owner connects the account the company already has (decision D-1 and the shell rule).
        const { row } = await connectOwnAccount(f)
        await health().handlers['payment-accounts.health'](
          delivery(row, 'payment-accounts.health')
        )
        expect(await account(row.id)).toMatchObject({
          disconnectedAt: null,
          integration: { status: 'ACTIVE' },
        })
        await expect(ready(f.tenantId)).resolves.toBeUndefined()
        expect(await selectable(f.tenantId)).toEqual([
          { id: row.integrationId },
        ])
      })

      it('the barrier reads only the current account: a new subaccount after a cancelled one is refused until approved, then issues', async () => {
        const f = await company()
        const cancelled = await requested(f)
        await scope.withProvisioningTransaction(f.tenantId, (tx) =>
          tx.organization.update({
            where: { id: f.tenantId },
            data: { addressNumber: '999' },
          })
        )
        await deliver(cancelled)
        expect((await account(cancelled.id)).status).toBe('DISCONNECTED')
        const row = await created(f)
        expect(row.id).not.toBe(cancelled.id)
        await expect(ready(f.tenantId)).rejects.toBeInstanceOf(
          ReceivingAccountNotReadyError
        )
        advance(15_000)
        await queuedHealth(row)
        approveAll(row)
        advance(DAY)
        expect(await sweepHealth(row)).toBe(1)
        expect(await account(row.id)).toMatchObject({
          status: 'APPROVED',
          integration: { status: 'ACTIVE' },
        })
        await expect(ready(f.tenantId)).resolves.toBeUndefined()
        expect(await selectable(f.tenantId)).toEqual([
          { id: row.integrationId },
        ])
      })

      type Kind = 'subaccount' | 'connected'
      /** The current account of the company: a subaccount the platform created (owner step pending) or its own account. */
      async function opened(f: Company, kind: Kind) {
        if (kind === 'connected') return connectOwnAccount(f)
        const row = await created(f)
        advance(15_000)
        await queuedHealth(row)
        return {
          providerAccountId: row.providerAccountId!,
          row: await account(row.id),
        }
      }
      /** The provider approves the four states; the next health delivery confirms them. */
      async function approved(opening: Awaited<ReturnType<typeof opened>>) {
        fake.setAccountStatus(opening.providerAccountId, {
          commercialInfo: 'APPROVED',
          bankAccountInfo: 'APPROVED',
          documentation: 'APPROVED',
          general: 'APPROVED',
        })
        advance(DAY)
        await health().handlers['payment-accounts.health'](
          delivery(opening.row, 'payment-accounts.health')
        )
        return account(opening.row.id)
      }
      const documentOf = (tenantId: string) =>
        unsafe.organization.findUniqueOrThrow({
          where: { id: tenantId },
          select: {
            document: true,
            documentNormalized: true,
            documentVerifiedAt: true,
          },
        })
      const reviews = async (tenantId: string) =>
        (await audits(tenantId)).filter(
          (row) => row.action === 'payment-account.document.in-use'
        )

      it.each([
        ['subaccount', 'formatted'],
        ['connected', 'formatted'],
        ['subaccount', 'free-form'],
        ['connected', 'free-form'],
      ] as const)(
        'a legacy company without the normalized CNPJ, approved through its %s (%s document), gets it with the verification and then holds the CNPJ',
        async (kind, form) => {
          const f = await company({ legacy: form })
          const row = await approved(await opened(f, kind))
          // The verification needs the normalized CNPJ (CHECK organizations_document_verified): it is recorded together.
          expect(row).toMatchObject({
            status: 'APPROVED',
            approvedAt: clock,
            lastErrorCode: null,
            healthIssue: null,
            integration: { status: 'ACTIVE' },
          })
          expect(await documentOf(f.tenantId)).toEqual({
            document: legacyDocument(form, f.document),
            documentNormalized: f.document,
            documentVerifiedAt: clock,
          })
          expect(await reviews(f.tenantId)).toEqual([])
          await expect(ready(f.tenantId)).resolves.toBeUndefined()
          expect(await selectable(f.tenantId)).toEqual([
            { id: row.integrationId },
          ])
          // Verified, the CNPJ is this company's: another company asking for an account with it is refused.
          const other = await company({ document: f.document })
          expect(await owner().offer(other.actor)).toMatchObject({
            available: false,
            blocker: 'DOCUMENT_IN_USE',
          })
        }
      )

      it.each(['subaccount', 'connected'] as const)(
        'a CNPJ another company verified first is never verified twice: the %s is still approved and the case goes to review once',
        async (kind) => {
          const f = await company()
          const opening = await opened(f, kind)
          // Meanwhile another company with the same CNPJ was approved (ADR SaaS, ownership of the CNPJ).
          const first = await company({ document: f.document, verified: true })
          const verifiedAt = clock
          const row = await approved(opening)
          expect(row).toMatchObject({
            status: 'APPROVED',
            approvedAt: clock,
            lastErrorCode: null,
            healthIssue: null,
            integration: { status: 'ACTIVE' },
          })
          expect((await documentOf(f.tenantId)).documentVerifiedAt).toBeNull()
          expect(await documentOf(first.tenantId)).toMatchObject({
            documentNormalized: f.document,
            documentVerifiedAt: verifiedAt,
          })
          expect(await reviews(f.tenantId)).toEqual([
            expect.objectContaining({
              actorKind: 'SYSTEM',
              targetType: 'PaymentAccount',
              targetId: row.id,
              reasonCategory: 'DOCUMENT_IN_USE',
            }),
          ])
          expect(await actions(f.tenantId)).toContain(
            'payment-account.configuration.confirmed'
          )
          await expect(ready(f.tenantId)).resolves.toBeUndefined()
          // The next daily inspection confirms again, without failing and without a second review entry.
          advance(DAY)
          await health().handlers['payment-accounts.health'](
            delivery(row, 'payment-accounts.health')
          )
          expect(await account(row.id)).toMatchObject({
            status: 'APPROVED',
            lastErrorCode: null,
            lastSyncedAt: clock,
          })
          expect((await documentOf(f.tenantId)).documentVerifiedAt).toBeNull()
          expect(await reviews(f.tenantId)).toHaveLength(1)
        }
      )

      const approveFour = (providerAccountId: string) =>
        fake.setAccountStatus(providerAccountId, {
          commercialInfo: 'APPROVED',
          bankAccountInfo: 'APPROVED',
          documentation: 'APPROVED',
          general: 'APPROVED',
        })
      const webhookWrites = () =>
        fake.requests
          .filter((r) => r.path.startsWith('/webhooks') && r.method !== 'GET')
          .map((r) => r.method)

      it.each(['subaccount', 'connected'] as const)(
        'two companies verifying the same CNPJ at once: the %s that loses the unique index keeps a plain configuration error, retries in 5 min and goes to review',
        async (kind) => {
          const f = await company()
          const opening = await opened(f, kind)
          const rival = await company({ document: f.document })
          approveFour(opening.providerAccountId)
          advance(DAY)
          fake.clearRecords()
          let release!: () => void
          const gate = new Promise<void>((resolve) => (release = resolve))
          let holding!: () => void
          const held = new Promise<void>((resolve) => (holding = resolve))
          // The rival's approval verifies the CNPJ and commits only once this confirmation waits on the unique index.
          const rivalApproval = scope.withPlatformTransaction(async (tx) => {
            await tx.organization.update({
              where: { id: rival.tenantId },
              data: { documentVerifiedAt: clock },
            })
            holding()
            await gate
          })
          await held
          const confirmation = health().handlers['payment-accounts.health'](
            delivery(opening.row, 'payment-accounts.health')
          )
          let settled = false
          void confirmation.then(
            () => (settled = true),
            () => (settled = true)
          )
          let waiting = 0
          for (let i = 0; i < 500 && !settled && !waiting; i++) {
            waiting = (
              await admin.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock'",
                [database]
              )
            ).rows[0]!.n
            if (!waiting)
              await new Promise((resolve) => setTimeout(resolve, 20))
          }
          release()
          await rivalApproval
          expect(waiting).toBe(1)
          await expect(confirmation).rejects.toThrow(
            'ACCOUNT_CONFIGURATION_UNAVAILABLE'
          )
          // The webhook was already confirmed: the loser is not left looking like an uncertain creation.
          expect(await account(opening.row.id)).toMatchObject({
            status: 'RESTRICTED',
            approvedAt: null,
            lastErrorCode: 'ACCOUNT_CONFIGURATION_UNAVAILABLE',
            nextAttemptAt: new Date(clock.getTime() + 300_000),
            integration: { status: 'PROVISIONING' },
          })
          expect((await documentOf(f.tenantId)).documentVerifiedAt).toBeNull()
          expect((await documentOf(rival.tenantId)).documentVerifiedAt).toEqual(
            clock
          )
          expect(await reviews(f.tenantId)).toEqual([])
          expect(await selectable(f.tenantId)).toEqual([])
          advance(300_000)
          await health().handlers['payment-accounts.health'](
            delivery(opening.row, 'payment-accounts.health')
          )
          expect(await account(opening.row.id)).toMatchObject({
            status: 'APPROVED',
            approvedAt: clock,
            lastErrorCode: null,
            integration: { status: 'ACTIVE' },
          })
          expect((await documentOf(f.tenantId)).documentVerifiedAt).toBeNull()
          expect(await reviews(f.tenantId)).toHaveLength(1)
          expect(await selectable(f.tenantId)).toEqual([
            { id: opening.row.integrationId },
          ])
          // One creation at most: the retry finds the confirmed webhook and only reasserts it.
          expect(webhookWrites()).toEqual(
            kind === 'connected' ? ['POST', 'PUT'] : ['PUT', 'PUT']
          )
        }
      )

      /** A valid CNPJ that is not the company's: the first two digits differ, the check digits are recomputed. */
      const anotherCnpj = (digits: string) => {
        const base = '75' + digits.slice(2, 12)
        return base + calcularDigitosCnpj(base)
      }
      it.each([
        ['subaccount', 'legacy column changed', 'normalized'],
        ['connected', 'legacy column changed', 'normalized'],
        ['subaccount', 'both columns changed', 'normalized'],
        ['connected', 'legacy column changed', 'legacy'],
      ] as const)(
        'columns that disagree with the provider are never approved nor written: the %s (%s, %s registration) stays RESTRICTED with ACCOUNT_DOCUMENT_MISMATCH',
        async (kind, change, registration) => {
          const legacy = registration === 'legacy'
          const f = await company(legacy ? { legacy: 'formatted' } : {})
          const opening = await opened(f, kind)
          const other = anotherCnpj(f.document)
          // The normalized column is a platform column (trigger ORGANIZATION_PLATFORM_COLUMNS).
          await scope.withPlatformTransaction((tx) =>
            tx.organization.update({
              where: { id: f.tenantId },
              data:
                change === 'both columns changed'
                  ? { document: other, documentNormalized: other }
                  : { document: formatarCnpj(other) },
            })
          )
          const before = await documentOf(f.tenantId)
          expect(before.documentNormalized).toBe(
            change === 'both columns changed'
              ? other
              : legacy
                ? null
                : f.document
          )
          approveFour(opening.providerAccountId)
          advance(DAY)
          fake.clearRecords()
          await expect(
            health().handlers['payment-accounts.health'](
              delivery(opening.row, 'payment-accounts.health')
            )
          ).rejects.toThrow('ACCOUNT_DOCUMENT_MISMATCH')
          expect(await account(opening.row.id)).toMatchObject({
            status: 'RESTRICTED',
            approvedAt: null,
            lastErrorCode: 'ACCOUNT_DOCUMENT_MISMATCH',
            integration: { status: 'PROVISIONING' },
          })
          // Neither the provider's CNPJ nor the changed one is recorded or verified.
          expect(await documentOf(f.tenantId)).toEqual(before)
          expect(before.documentVerifiedAt).toBeNull()
          expect(webhookWrites()).toEqual([])
          expect(await reviews(f.tenantId)).toEqual([])
          expect(await selectable(f.tenantId)).toEqual([])
        }
      )

      it.each(['PROVISIONING', 'UNKNOWN', 'KEY_RECOVERY_REQUIRED'] as const)(
        'S25: an account notification during %s is ignored with an audit, never retried and never applied',
        async (status) => {
          const f = await company()
          const row = await requested(f)
          if (status !== 'PROVISIONING')
            await unsafe.paymentAccount.update({
              where: { id: row.id },
              data: { status },
            })
          const before = await account(row.id)
          const receipt = await notify(before, {
            id: 'evt_' + status + '_' + f.tenantId,
            event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
            account: { id: 'acc_unbound_' + f.tenantId.replaceAll('-', '_') },
          })
          expect(receipt).toMatchObject({
            status: 'IGNORED',
            lastError: 'ACCOUNT_PROVISIONING',
            processingToken: null,
          })
          expect(read).not.toHaveBeenCalled()
          expect(await account(row.id)).toEqual(before)
          expect(await audits(f.tenantId)).toContainEqual(
            expect.objectContaining({
              action: 'payment-account.webhook.ignored',
              targetId: receipt.id,
              reasonCategory: 'ACCOUNT_PROVISIONING',
            })
          )
        }
      )

      it.each([
        'PROVISIONING',
        'UNKNOWN',
        'KEY_RECOVERY_REQUIRED',
        'BLOCKED',
      ] as const)(
        'M14: the health never selects nor changes a subaccount in %s',
        async (status) => {
          const f = await company()
          const row = await requested(f)
          await unsafe.paymentAccount.update({
            where: { id: row.id },
            data: { status, nextAttemptAt: clock },
          })
          const before = await account(row.id)
          fake.clearRecords()
          expect(await sweepHealth(row)).toBe(0)
          await health().handlers['payment-accounts.health'](
            delivery(row, 'payment-accounts.health')
          )
          expect(fake.requests).toHaveLength(0)
          expect(await account(row.id)).toEqual(before)
        }
      )
    })

    describe('composition of both API hosts (B8)', () => {
      const EDGE = 'synthetic-edge-secret-with-more-than-32-characters'
      const APP = 'https://app.locadora.example.test'
      let configured = false
      afterAll(async () => {
        try {
          if (configured) {
            const runtime = getPlatformDatabaseRuntime()
            await runtime.prisma.$disconnect()
            await runtime.pool.end()
          }
        } finally {
          vi.unstubAllEnvs()
          vi.unstubAllGlobals()
        }
      })
      /** A company whose owner accepted the partner notice in real time (these crons use the real clock). */
      async function realTimeCompany() {
        const f = await company({ notice: false })
        await unsafe.legalAcceptance.create({
          data: {
            userId: f.owner.id,
            tenantId: f.tenantId,
            kind: 'PAYMENTS_PARTNER_NOTICE',
            version: '2026-10-01',
            textSha256: 'a'.repeat(64),
            acceptedAt: new Date(Date.now() - 60_000),
          },
        })
        return f
      }
      /** The deploy configuration of the creation; each case removes what it proves. */
      function environment(extra: Record<string, string | undefined> = {}) {
        const values: Record<string, string | undefined> = {
          PLATFORM_DATABASE_URL: platformDatabaseUrl,
          PLATFORM_ENV: 'production',
          PLATFORM_ROOT_DOMAIN: 'locadora.example.test',
          PLATFORM_EDGE_SECRET: EDGE,
          PLATFORM_SUBACCOUNT_CREATION: 'on',
          PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'STANDARD',
          PLATFORM_SUBACCOUNT_REQUIRES_PAID: undefined,
          PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'off',
          PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
          PLATFORM_ASAAS_ROOT_API_KEY: fake.rootApiKey,
          PLATFORM_ASAAS_OUTBOUND_DISABLED: 'false',
          PLATFORM_ASAAS_EGRESS_PROXY_URL: '',
          PLATFORM_WEBHOOK_ORIGIN: 'https://api.example.test',
          PLATFORM_OPS_EMAIL: 'ops@example.test',
          PLATFORM_SECRETS_KEK_PROVIDER: 'env',
          PLATFORM_SECRETS_KEK_CURRENT: 'K1',
          PLATFORM_SECRETS_KEK_K1: Buffer.alloc(32, 41).toString('base64'),
          PLATFORM_SECRET_FINGERPRINT_KEY: Buffer.alloc(32, 42).toString(),
          PLATFORM_SECRETS_KMS_KEY_ARN: '',
          PLATFORM_SELF_SERVICE_SIGNUP: 'off',
          RESEND_API_KEY: '',
          CRON_SECRET: 'synthetic-subaccount-cron',
          ...extra,
        }
        for (const [name, value] of Object.entries(values))
          vi.stubEnv(name, value)
        vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
          fake.fetch(url, init)
        )
        configured = true
      }
      const http = (f: Company, init: RequestInit = {}) =>
        handleConfiguredPaymentAccountCreation(
          new Request(
            'http://backend.internal/api/admin/payment-account/create',
            {
              ...init,
              headers: {
                [PLATFORM_EDGE_HEADER.auth]: EDGE,
                [PLATFORM_EDGE_HEADER.hostKind]: 'app',
                [PLATFORM_EDGE_HEADER.origin]: APP,
                Origin: APP,
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
              },
            }
          ),
          f.actor,
          async () => ({
            user: { id: f.actor.userId },
            authenticatedAt: Date.now(),
          })
        )
      const crons = [legacyCron, apiCron] as const
      const cron = async (handle: (typeof crons)[number]) => {
        const response = await handle(
          new Request('http://localhost/api/cron/platform', {
            headers: { authorization: 'Bearer synthetic-subaccount-cron' },
          })
        )
        expect(response.status).toBe(200)
      }
      // Earlier cases used a synthetic clock; their pending work never belongs to these real-time crons.
      const park = () =>
        unsafe.platformOutboxEvent.updateMany({
          where: { status: 'PENDING' },
          data: { availableAt: new Date('2100-01-01T00:00:00.000Z') },
        })

      it('S18: the real HTTP composition accepts the request and the two crons create once and configure the account', async () => {
        environment()
        const f = await realTimeCompany()
        // PLATFORM_SUBACCOUNT_REQUIRES_PAID absent means true (M23).
        expect(await (await http(f)).json()).toMatchObject({
          available: false,
          blocker: 'FIRST_PAYMENT_REQUIRED',
        })
        vi.stubEnv('PLATFORM_SUBACCOUNT_REQUIRES_PAID', 'false')
        const offer = await (await http(f)).json()
        expect(offer).toMatchObject({
          blocker: null,
          available: true,
          company: { site: 'https://' + f.tenantId + '.locadora.example.test' },
        })
        const accepted = await http(f, {
          method: 'POST',
          body: JSON.stringify({
            ...commercial,
            companyDataVersion: offer.companyDataVersion,
          }),
        })
        expect(accepted.status).toBe(202)
        expect(await accepted.json()).toEqual({ accepted: true })
        expect(fake.requests).toHaveLength(0)
        const created = await current(f.tenantId)
        await park()
        await unsafe.platformOutboxEvent.updateMany({
          where: { aggregateId: created.id, status: 'PENDING' },
          data: { availableAt: created.nextAttemptAt },
        })
        await cron(legacyCron)
        expect(posts(f.document)).toBe(1)
        // The value typed in the HTTP request is, exactly, the one the cron sends to the provider.
        expect(
          fake.requests.find(
            (r) =>
              r.method === 'POST' &&
              r.path === '/accounts' &&
              (r.body as { cpfCnpj?: string } | null)?.cpfCnpj === f.document
          )?.body
        ).toMatchObject({ incomeValue: 98765.43, mobilePhone: '11987654321' })
        const sealed = await account(created.id)
        expect(sealed).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
          integration: { status: 'PROVISIONING' },
        })
        expect(await secrets(created.integrationId)).toHaveLength(1)
        // 15 s later, the other host runs the health delivery queued by the seal.
        const later = new Date(Date.now() - 1000)
        await unsafe.paymentAccount.update({
          where: { id: created.id },
          data: { nextAttemptAt: later },
        })
        await unsafe.platformOutboxEvent.updateMany({
          where: {
            aggregateId: created.id,
            topic: 'payment-accounts.health',
            status: 'PENDING',
          },
          data: { availableAt: later },
        })
        fake.clearRecords()
        await cron(apiCron)
        expect(posts(f.document)).toBe(0)
        expect(
          fake.requests
            .filter((r) => r.path.startsWith('/webhooks'))
            .map((r) => r.method)
        ).toEqual(['GET', 'PUT', 'GET'])
        expect(await account(created.id)).toMatchObject({
          status: 'AWAITING_OWNER',
          lastErrorCode: null,
          integration: { status: 'PROVISIONING' },
        })
        // The owner view of both hosts: state only, never the value, references or key.
        const view = JSON.stringify(await (await http(f)).json())
        for (const marker of [
          '98765',
          '11987654321',
          sealed.providerAccountId!,
        ])
          expect(view).not.toContain(marker)
      })

      it('M31: without the switch or the root credential, the maintenance still returns unsent requests to the owner', async () => {
        environment({
          PLATFORM_SUBACCOUNT_CREATION: undefined,
          PLATFORM_ASAAS_ROOT_API_KEY: undefined,
          PLATFORM_SECRETS_KEK_CURRENT: undefined,
        })
        const f = await realTimeCompany()
        expect(await (await http(f)).json()).toMatchObject({
          available: false,
          blocker: 'CREATION_UNAVAILABLE',
        })
        // A request accepted while the creation was on, before it was turned off.
        const flow = owner({ now: () => new Date() })
        const offer = await flow.offer(f.actor)
        await flow.request(
          f.actor,
          { ...commercial, companyDataVersion: offer.companyDataVersion },
          Date.now()
        )
        const created = await current(f.tenantId)
        await park()
        fake.clearRecords()
        for (const handle of crons) await cron(handle)
        expect(fake.requests).toHaveLength(0)
        expect(await account(created.id)).toMatchObject({
          status: 'DISCONNECTED',
          lastErrorCode: 'CREATION_DISABLED',
          disconnectedAt: expect.any(Date),
          integration: { status: 'DISABLED', webhookTokenHash: null },
        })
        expect(await request(created.id)).toMatchObject(purged('CANCELLED'))
        expect(await (await http(f)).json()).toMatchObject({
          blocker: 'CREATION_UNAVAILABLE',
          lastRequestOutcome: 'CANCELLED',
        })
      })
    })
  }
)
