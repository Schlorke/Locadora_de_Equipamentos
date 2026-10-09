import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHmac, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { createLoginRole } from '../helpers/database-roles'
import {
  onboardingInput,
  onboardingPublication,
} from '../helpers/onboarding-data'
import {
  createPlatformScope,
  type PlatformScope,
} from '../../packages/backend/src/modules/platform-scope/index'
import {
  createOrganizationProvisioning,
  createOnboardingSlugLimit,
  createOnboardingStatusReader,
  createOnboardingWelcome,
  createSitePublication,
  OnboardingError,
} from '../../packages/backend/src/modules/onboarding/index'
import { ONBOARDING_WELCOME_TOPIC } from '../../packages/backend/src/modules/onboarding/welcome'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/index'
import { createOnboardingHttpHandlers } from '../../packages/backend/src/http/onboarding'
import {
  runAssistedOrganizationProvisioning,
  runConfiguredPlatformJobs,
  handleConfiguredSitePublication,
} from '@gb-locacoes/backend/runtime'
import { getDatabaseRuntime } from '../../packages/backend/src/runtime/database'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import type { PlatformTransaction } from '../../packages/backend/src/modules/platform-scope/index'
import type { PlatformMailEnvelope } from '../../packages/backend/src/modules/communications/index'
import { createRentalTransaction } from '../../packages/backend/src/modules/rentals/index'
import { createSitePublicationHandler } from '../../packages/backend/src/http/site-publication'
import { createOnboardingStatusHandler } from '../../packages/backend/src/http/onboarding-status'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { semanticThemes } from '@gb-locacoes/design-tokens'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'atomic onboarding on actual restricted PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'onboarding_' + suffix + '_test'
    const role = 'onboarding_platform_' + suffix,
      appRole = 'onboarding_app_' + suffix
    const trialSecret = 'synthetic-onboarding-trial-hmac-key-32',
      rateLimitSecret = 'synthetic-onboarding-rate-hmac-key-32'
    let admin: Pool,
      db: Pool,
      pool: Pool,
      app: Pool,
      inspector: PrismaClient,
      client: PrismaClient,
      appClient: PrismaClient
    let scope: PlatformScope,
      version: string,
      staff: string,
      platformUrl: string,
      appUrl: string
    let instant = new Date('2026-10-04T02:59:59Z'),
      serial = 0
    const modelCounts = async () => {
      const counts: Record<string, number> = {}
      for (const table of [
        'organizations',
        'memberships',
        'trial_claims',
        'subscriptions',
        'subscription_events',
        'legal_acceptances',
        'settings',
        'financial_settings',
        'permissions',
        'categories',
        'platform_audit_logs',
        'platform_outbox_events',
      ])
        counts[table] = (
          await db.query('SELECT count(*)::int AS n FROM ' + table)
        ).rows[0].n
      return counts
    }
    const user = async (verified = true, email?: string) =>
      (
        await inspector.user.create({
          data: {
            email: email ?? 'owner-' + randomUUID() + '@example.test',
            authEmailVerified: verified,
          },
        })
      ).id
    const cnpj = () => {
      let base = (900000000000 + ++serial).toString()
      for (const weights of [
        [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
        [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
      ]) {
        const remainder =
          [...base].reduce(
            (sum, digit, i) => sum + Number(digit) * weights[i]!,
            0
          ) % 11
        base += remainder < 2 ? '0' : String(11 - remainder)
      }
      return base
    }
    const factory = (
      options: Partial<
        Parameters<typeof createOrganizationProvisioning>[0]
      > = {}
    ) =>
      createOrganizationProvisioning({
        scope,
        trialSecret,
        rateLimitSecret,
        environment: 'sandbox',
        publication: () => onboardingPublication,
        now: () => instant,
        ...options,
      })
    const input = (document = cnpj()) =>
      onboardingInput(version, 'rental-' + randomUUID(), document)
    const metadata = () => ({
      ip: '192.0.2.' + ((++serial % 240) + 1),
      userAgent: 'synthetic-agent'.repeat(25),
    })
    const create = (
      owner: string,
      value = input(),
      key = randomUUID(),
      options: Partial<
        Parameters<typeof createOrganizationProvisioning>[0]
      > = {}
    ) =>
      factory(options)(
        { userId: owner, staffUserId: staff },
        value,
        key,
        metadata()
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
        .filter((name) => /^\d{12}_/.test(name))
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
      appUrl = await createLoginRole(
        db,
        url.toString(),
        appRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (const [file, name] of [
        ['platform_runtime', role],
        ['app_runtime', appRole],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + file + '.sql', 'utf8')
            .replaceAll(file!, name!)
        )
      pool = new Pool({ connectionString: platformUrl, max: 2 })
      app = new Pool({ connectionString: appUrl, max: 1 })
      client = new PrismaClient({ adapter: new PrismaPg(pool) })
      appClient = new PrismaClient({ adapter: new PrismaPg(app) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(client)
      staff = await user()
      await inspector.platformStaff.create({
        data: { userId: staff, role: 'PLATFORM_ADMIN' },
      })
      version = await scope.withPlatformTransaction(async (tx) => {
        const seed = await tx.planVersion.findFirstOrThrow()
        const plan = await tx.plan.create({
          data: {
            code: 'synthetic-onboarding',
            name: 'Synthetic onboarding only',
            isPublic: true,
          },
        })
        return (
          await tx.planVersion.create({
            data: {
              planId: plan.id,
              version: 1,
              amount: '123.45',
              trialDays: 14,
              sellableFrom: new Date('2026-01-01'),
              entitlements: seed.entitlements as Prisma.InputJsonValue,
            },
          })
        ).id
      })
    }, 120_000)
    afterAll(async () => {
      for (const prisma of [client, inspector, appClient])
        await prisma?.$disconnect()
      for (const connection of [pool, app, db]) await connection?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const name of [role, appRole])
          await admin.query('DROP ROLE IF EXISTS "' + name + '"')
        await admin.end()
      }
    })

    it.each(['12ABC34501DE35', '11222333000181'])(
      'creates the full aggregate and neutral seeds for valid CNPJ %s',
      async (document) => {
        const owner = await user(),
          value = input(document),
          result = await create(owner, value)
        expect(result.subscription).toEqual({
          status: 'TRIALING',
          trialEndsAt: '2026-10-17',
        })
        const id = result.organization.id
        const org = await inspector.organization.findUniqueOrThrow({
          where: { id },
        })
        expect(org).toMatchObject({
          ownerUserId: owner,
          access: 'FULL',
          origin: 'ONBOARDING',
          status: 'ACTIVE',
          documentNormalized: document,
          documentVerifiedAt: null,
          sitePublishedAt: null,
          siteIndexable: false,
          directoryListed: false,
        })
        expect(
          await inspector.membership.findFirstOrThrow({
            where: { tenantId: id },
          })
        ).toMatchObject({ userId: owner, role: 'ADMIN', status: 'ACTIVE' })
        const seeds = await inspector.setting.findUniqueOrThrow({
          where: { tenantId: id },
        })
        expect(seeds).toMatchObject({
          seoTitle: value.company.tradeName,
          seoDescription: '',
          footerText: value.company.tradeName,
          themeColorPrimary: semanticThemes.light.brand.default,
          companyIconUrl: '',
          smtpConfig: {},
          heroCarousel: [],
          customCss: '',
          customJs: '',
        })
        expect(JSON.stringify(seeds)).not.toContain('GB Locações')
        expect(
          await inspector.permission.findMany({
            where: { tenantId: id },
            select: { role: true, module: true, action: true },
          })
        ).toHaveLength(7)
        expect(
          await inspector.financialSetting.count({ where: { tenantId: id } })
        ).toBe(1)
        expect(
          await inspector.category.findFirst({ where: { tenantId: id } })
        ).toMatchObject({ name: 'Geral', slug: 'geral' })
        expect(
          await inspector.trialClaim.count({ where: { tenantId: id } })
        ).toBe(2)
        const accepted = await inspector.legalAcceptance.findMany({
          where: { tenantId: id },
        })
        expect(accepted).toHaveLength(4)
        expect(
          accepted.every(
            (row) => row.userAgent?.length === 200 && row.ipHash?.length === 64
          )
        ).toBe(true)
        const queued = await inspector.platformOutboxEvent.findMany({
          where: { tenantId: id },
        })
        expect(queued.map((row) => row.topic)).toEqual(['onboarding.welcome'])
        expect(queued[0]?.status).toBe('PENDING')
      }
    )
    it('replays the immutable receipt after status, catalogue and legal publication change, without new counters', async () => {
      const owner = await user(),
        value = input(),
        key = randomUUID()
      const result = await create(owner, value, key)
      await scope.withPlatformTransaction((tx) =>
        tx.subscription.updateMany({
          where: { tenantId: result.organization.id },
          data: { status: 'ACTIVE' },
        })
      )
      const counts = await modelCounts(),
        limits = await inspector.platformRateLimit.count()
      const replay = await create(
        owner,
        { ...value, acceptances: [...value.acceptances].reverse() },
        key,
        {
          publication: () => {
            throw new Error('Publication changed')
          },
        }
      )
      expect(replay).toEqual(result)
      expect(await modelCounts()).toEqual(counts)
      expect(await inspector.platformRateLimit.count()).toBe(limits)
      await expect(
        create(
          owner,
          { ...value, company: { ...value.company, tradeName: 'Different' } },
          key
        )
      ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED')
    })
    it('serializes identical requests on different connections and creates one aggregate', async () => {
      const owner = await user(),
        value = input(),
        key = randomUUID()
      const [first, second] = await Promise.all([
        create(owner, value, key),
        create(owner, value, key),
      ])
      expect(second).toEqual(first)
      expect(
        await inspector.organization.count({ where: { ownerUserId: owner } })
      ).toBe(1)
      expect(
        await inspector.platformAuditLog.count({
          where: {
            tenantId: first.organization.id,
            action: 'ORGANIZATION_PROVISIONED',
          },
        })
      ).toBe(1)
    })
    it('uses both CNPJ and normalized email trial claims, but does not consume new claims when refusing a trial', async () => {
      const document = cnpj(),
        a = await user(),
        b = await user()
      const [one, two] = await Promise.all([
        create(a, input(document)),
        create(b, input(document)),
      ])
      expect([one.subscription.status, two.subscription.status].sort()).toEqual(
        ['INCOMPLETE', 'TRIALING']
      )
      const denied = one.subscription.status === 'INCOMPLETE' ? one : two
      expect(denied.notices).toEqual(['TRIAL_ALREADY_USED'])
      expect(
        await inspector.trialClaim.count({
          where: { tenantId: denied.organization.id },
        })
      ).toBe(0)
      expect(
        await inspector.subscription.findFirst({
          where: { tenantId: denied.organization.id },
        })
      ).toMatchObject({ providerSync: 'PENDING', trialEndsAt: null })
      expect(
        (
          await inspector.platformOutboxEvent.findMany({
            where: { tenantId: denied.organization.id },
          })
        )
          .map((row) => row.topic)
          .sort()
      ).toEqual(['onboarding.welcome', 'subscriptions.provider-sync'])
      const acceptedOwner = one.subscription.status === 'TRIALING' ? a : b
      expect((await create(acceptedOwner)).subscription.status).toBe(
        'INCOMPLETE'
      )
      const deniedOwner = one.subscription.status === 'INCOMPLETE' ? a : b
      expect((await create(deniedOwner)).subscription.status).toBe('TRIALING')
    })
    it('serializes owner quota across concurrent requests, independently of the daily limiter', async () => {
      const owner = await user()
      await create(owner)
      await create(owner)
      const later = { now: () => new Date('2026-10-05T15:00:00Z') }
      const results = await Promise.allSettled([
        create(owner, input(), randomUUID(), later),
        create(owner, input(), randomUUID(), later),
      ])
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1
      )
      expect(results.find((row) => row.status === 'rejected')).toMatchObject({
        reason: { code: 'ORGANIZATION_LIMIT_REACHED' },
      })
      expect(
        await inspector.organization.count({ where: { ownerUserId: owner } })
      ).toBe(3)
    })
    it.each(['admin', 'pix-locacoes', 'asaas', 'login'])(
      'does not reveal why a new slug %s is unavailable',
      async (slug) => {
        const owner = await user()
        await expect(create(owner, { ...input(), slug })).rejects.toMatchObject(
          { status: 409, code: 'SLUG_UNAVAILABLE' }
        )
        expect(
          await inspector.organization.count({ where: { ownerUserId: owner } })
        ).toBe(0)
      }
    )
    it('resolves a slug race to one tenant and neutral conflict for the other', async () => {
      const slug = input().slug,
        owners = await Promise.all([user(), user()])
      const results = await Promise.allSettled(
        owners.map((owner) => create(owner, { ...input(), slug }))
      )
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1
      )
      expect(results.find((row) => row.status === 'rejected')).toMatchObject({
        reason: { code: 'SLUG_UNAVAILABLE' },
      })
    })
    it.each([false, 'disposable', 'missing'])(
      'revalidates verified durable owner identity: %s',
      async (state) => {
        const owner =
          state === 'missing'
            ? 'missing-owner'
            : await user(
                state !== false,
                state === 'disposable'
                  ? 'owner-' +
                      randomUUID() +
                      '@' +
                      PLATFORM.disposableEmailDomains[0]
                  : undefined
              )
        await expect(create(owner)).rejects.toMatchObject({
          code:
            state === false
              ? 'EMAIL_NOT_VERIFIED'
              : state === 'missing'
                ? 'AUTHENTICATION_REQUIRED'
                : 'EMAIL_NOT_ALLOWED',
        })
        expect(
          await inspector.organization.count({ where: { ownerUserId: owner } })
        ).toBe(0)
      }
    )
    it('authorizes a new HTTP creation only once and replays the committed receipt without a reused challenge', async () => {
      const owner = await user(),
        value = input(),
        key = randomUUID()
      const authorizeNewRequest = vi.fn(async () => {})
      const original = await create(owner, value, key, { authorizeNewRequest })
      authorizeNewRequest.mockRejectedValueOnce(
        new OnboardingError(400, 'CAPTCHA_INVALID')
      )
      expect(await create(owner, value, key, { authorizeNewRequest })).toEqual(
        original
      )
      expect(authorizeNewRequest).toHaveBeenCalledTimes(1)
    })
    it('a failed creation challenge commits the attempt budget but writes none of the aggregate', async () => {
      const owner = await user(),
        before = await modelCounts(),
        counters = await inspector.platformRateLimit.count()
      await expect(
        create(owner, input(), randomUUID(), {
          authorizeNewRequest: async () => {
            throw new OnboardingError(400, 'CAPTCHA_INVALID')
          },
        })
      ).rejects.toThrow('CAPTCHA_INVALID')
      expect(await modelCounts()).toEqual(before)
      expect(await inspector.platformRateLimit.count()).toBeGreaterThan(
        counters
      )
    })
    it('direct authenticated device status still revalidates owner and scopes actual RLS reads', async () => {
      const receipt = await create(await user())
      const membership = await inspector.membership.findFirstOrThrow({
        where: { tenantId: receipt.organization.id },
      })
      const principal = {
        tenantId: membership.tenantId,
        userId: membership.userId,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      const handler = createOnboardingStatusHandler({
        withTenantTransaction: (context, operation, options) =>
          withTenantTransaction(appClient, context, operation, options),
        environment: () => ({
          PLATFORM_ENV: 'production',
          PLATFORM_ROOT_DOMAIN: 'rental.test',
          PLATFORM_EDGE_SECRET: 'synthetic-device-status-edge-longer32',
        }),
      })
      const request = new Request(
        'https://api.rental.test/api/onboarding/status'
      )
      const response = await handler(request, principal)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect((await response.json()).items).toContainEqual({
        id: 'FIRST_EQUIPMENT',
        done: false,
      })
      expect(
        (await handler(request, { ...principal, userId: 'not-the-owner' }))
          .status
      ).toBe(403)
      expect(
        (
          await handler(
            new Request(request.url, {
              headers: { Origin: 'https://bravo.rental.test' },
            }),
            principal
          )
        ).status
      ).toBe(403)
    })
    it('slug budgets persist across independent instances with a shared unknown-IP window', async () => {
      const first = createOnboardingSlugLimit({
        transaction: scope.withPlatformTransaction,
        secret: rateLimitSecret,
        now: () => instant,
      })
      const second = createOnboardingSlugLimit({
        transaction: createPlatformScope(client).withPlatformTransaction,
        secret: rateLimitSecret,
        now: () => instant,
      })
      for (let index = 0; index < 15; index++)
        await Promise.all([first(null), second(null)])
      await expect(first(null)).rejects.toThrow('ONBOARDING_RATE_LIMITED')
      await createOnboardingSlugLimit({
        transaction: scope.withPlatformTransaction,
        secret: rateLimitSecret,
        now: () => new Date(instant.getTime() + 60_000),
      })(null)
      const rows = await inspector.platformRateLimit.findMany({
        where: { key: { startsWith: 'onboarding-slug:' } },
      })
      expect(rows).toHaveLength(2)
      expect(JSON.stringify(rows)).not.toContain('unknown')
    })
    it('HTTP receipt, real app-role checklist, equipment facts and changed ownership preserve tenant isolation', async () => {
      const owner = await user(),
        value = input(),
        key = randomUUID()
      const environment = {
        PLATFORM_ENV: 'production',
        PLATFORM_ROOT_DOMAIN: 'rental.test',
        PLATFORM_EDGE_SECRET: 'synthetic-onboarding-http-secret-long32',
      }
      const handlers = createOnboardingHttpHandlers({
        environment: () => environment,
        checkSignup: () => {},
        provision: (userId, raw, idempotency, headers) =>
          factory({ authorizeNewRequest: async () => {} })(
            { userId },
            raw,
            idempotency,
            headers
          ),
        slugAvailability: async () => ({ available: true }),
      })
      const request = new Request(
        'https://backend.test/api/onboarding/organizations',
        {
          method: 'POST',
          headers: {
            'x-platform-edge-auth': environment.PLATFORM_EDGE_SECRET,
            'x-platform-host-kind': 'app',
            'x-platform-origin': 'https://app.rental.test',
            Origin: 'https://app.rental.test',
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify(value),
        }
      )
      const response = await handlers.create(request, owner)
      expect(response.status).toBe(201)
      const receipt = await response.json(),
        tenantId = receipt.organization.id as string
      expect(response.headers.get('set-cookie')).toContain(tenantId)
      const membership = await inspector.membership.findFirstOrThrow({
        where: { tenantId, userId: owner },
      })
      const principal = {
        tenantId,
        userId: owner,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      const read = createOnboardingStatusReader({
        withTenantTransaction: (context, operation, options) =>
          withTenantTransaction(appClient, context, operation, options),
      })
      const first = await read(principal)
      expect(first.items).toContainEqual({ id: 'FIRST_EQUIPMENT', done: false })
      expect(first.items).toContainEqual({ id: 'CUSTOMIZE_SITE', done: true })
      const integration = await inspector.tenantIntegration.create({
        data: {
          tenantId,
          provider: 'ASAAS',
          environment: 'sandbox',
          status: 'ACTIVE',
          credentialsRef: 'env:LOCADORA_INTEGRATION_RECEIVING_FIXTURE',
        },
      })
      await inspector.paymentAccount.create({
        data: {
          tenantId,
          integrationId: integration.id,
          mode: 'ASAAS_CONNECTED_ACCOUNT',
          environment: 'sandbox',
          status: 'APPROVED',
          generalStatus: 'APPROVED',
        },
      })
      expect((await read(principal)).items).toContainEqual({
        id: 'ACTIVATE_ONLINE_PAYMENTS',
        done: true,
      })
      await inspector.tenantIntegration.update({
        where: { id: integration.id },
        data: { status: 'DISABLED' },
      })
      expect((await read(principal)).items).toContainEqual({
        id: 'ACTIVATE_ONLINE_PAYMENTS',
        done: false,
      })
      const category = await inspector.category.findFirstOrThrow({
        where: { tenantId },
      })
      await inspector.equipment.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: 'Synthetic first equipment',
          pricePerDay: '12.34',
          images: [],
        },
      })
      expect((await read(principal)).items).toContainEqual({
        id: 'FIRST_EQUIPMENT',
        done: true,
      })
      const another = await create(await user()),
        other = await inspector.membership.findFirstOrThrow({
          where: { tenantId: another.organization.id },
        })
      await expect(
        read({ ...principal, tenantId: other.tenantId, membershipId: other.id })
      ).rejects.toThrow('OWNER_REQUIRED')
      const nextOwner = await user()
      await scope.withProvisioningTransaction(tenantId, async (tx) => {
        await tx.membership.create({
          data: {
            tenantId,
            userId: nextOwner,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        })
        await tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: nextOwner },
        })
      })
      await expect(read(principal)).rejects.toThrow('OWNER_REQUIRED')
      expect(
        (
          await app.query(
            "SELECT current_setting('app.tenant_id',true) AS tenant"
          )
        ).rows[0].tenant ?? ''
      ).toBe('')
    })
    it('allows a former inactive platform staff member to own a tenant', async () => {
      const owner = await user()
      await inspector.platformStaff.create({
        data: {
          userId: owner,
          role: 'PLATFORM_VIEWER',
          active: false,
          revokedAt: instant,
        },
      })
      const result = await factory()(
        { userId: owner, staffUserId: staff },
        input(),
        randomUUID(),
        metadata()
      )
      expect(result.subscription.status).toBe('TRIALING')
      expect(
        await inspector.membership.findFirst({ where: { userId: owner } })
      ).toMatchObject({ role: 'ADMIN', status: 'ACTIVE' })
    })
    it.each(['PLATFORM_VIEWER', 'revoked', 'owner-is-staff'])(
      'refuses assisted operator/ownership misuse: %s',
      async (state) => {
        const owner = state === 'owner-is-staff' ? staff : await user(),
          actor = await user()
        await inspector.platformStaff.create({
          data: {
            userId: actor,
            role:
              state === 'PLATFORM_VIEWER'
                ? 'PLATFORM_VIEWER'
                : 'PLATFORM_ADMIN',
            revokedAt: state === 'revoked' ? instant : null,
          },
        })
        await expect(
          factory()(
            { userId: owner, staffUserId: actor },
            input(),
            randomUUID(),
            metadata()
          )
        ).rejects.toThrow(
          state === 'owner-is-staff'
            ? 'PLATFORM_STAFF_CANNOT_OWN_TENANT'
            : 'PLATFORM_ADMIN_REQUIRED'
        )
      }
    )
    it.each(['absent', 'changed', 'future'])(
      'rolls back when approved legal documents are %s',
      async (mode) => {
        const owner = await user(),
          counts = await modelCounts()
        const publication =
          mode === 'absent'
            ? []
            : onboardingPublication.map((row) => ({
                ...row,
                ...(mode === 'future'
                  ? { version: '2030-01-01' }
                  : { textSha256: 'a'.repeat(64) }),
              }))
        await expect(
          create(owner, input(), randomUUID(), {
            publication: () => publication,
          })
        ).rejects.toThrow(
          mode === 'changed'
            ? 'LEGAL_DOCUMENT_CHANGED'
            : 'LEGAL_PUBLICATION_UNAVAILABLE'
        )
        expect(await modelCounts()).toEqual(counts)
      }
    )
    it('uses current persisted offer only, never client prices or undocumented private plans', async () => {
      const owner = await user(),
        original = await inspector.planVersion.findUniqueOrThrow({
          where: { id: version },
        })
      await scope.withPlatformTransaction((tx) =>
        tx.plan.update({
          where: { id: original.planId },
          data: { isPublic: false },
        })
      )
      try {
        await expect(create(owner)).rejects.toThrow('PLAN_NOT_AVAILABLE')
      } finally {
        await scope.withPlatformTransaction((tx) =>
          tx.plan.update({
            where: { id: original.planId },
            data: { isPublic: true },
          })
        )
      }
      const value = input()
      await expect(
        create(owner, { ...value, amount: '0.00' } as typeof value)
      ).rejects.toThrow('ONBOARDING_INPUT_INVALID')
      await expect(
        create(owner, {
          ...value,
          company: { ...value.company, cnpj: '11222333000180' },
        })
      ).rejects.toThrow('INVALID_CNPJ')
    })
    it.each([
      ['organization', 'create'],
      ['membership', 'create'],
      ['trialClaim', 'createMany'],
      ['subscription', 'create'],
      ['subscriptionEvent', 'create'],
      ['legalAcceptance', 'createMany'],
      ['setting', 'createMany'],
      ['financialSetting', 'createMany'],
      ['permission', 'createMany'],
      ['category', 'createMany'],
      ['platformAuditLog', 'create'],
      ['platformOutboxEvent', 'upsert'],
    ])(
      'rolls back every aggregate/seed/queue effect after %s.%s actually ran',
      async (model, method) => {
        const owner = await user(),
          counts = await modelCounts()
        const injectedScope: PlatformScope = {
          ...scope,
          withProvisioningTransaction: (tenantId, operation) =>
            scope.withProvisioningTransaction(tenantId, (tx) =>
              operation(
                new Proxy(tx, {
                  get(target, name) {
                    const value = Reflect.get(target, name, target)
                    if (name !== model)
                      return typeof value === 'function'
                        ? value.bind(target)
                        : value
                    return new Proxy(value, {
                      get(delegate, member) {
                        const fn = Reflect.get(delegate, member, delegate)
                        if (member !== method)
                          return typeof fn === 'function'
                            ? fn.bind(delegate)
                            : fn
                        return async (...args: unknown[]) => {
                          await fn.apply(delegate, args)
                          throw new Error('INJECTED_AFTER_WRITE')
                        }
                      },
                    })
                  },
                })
              )
            ),
        }
        await expect(
          create(owner, input(), randomUUID(), { scope: injectedScope })
        ).rejects.toThrow('INJECTED_AFTER_WRITE')
        expect(await modelCounts()).toEqual(counts)
      }
    )
    it('leaves attempt counters committed after a rejection, without clear identity or IP', async () => {
      const owner = await user(),
        value = { ...input(), slug: 'pix-locacoes' },
        ip = '198.51.100.101'
      const run = () =>
        factory()({ userId: owner }, value, randomUUID(), {
          ip,
          userAgent: null,
        })
      for (let i = 0; i < 3; i++)
        await expect(run()).rejects.toThrow('SLUG_UNAVAILABLE')
      await expect(run()).rejects.toMatchObject({
        code: 'ONBOARDING_RATE_LIMITED',
        status: 429,
      })
      const key = createHmac('sha256', rateLimitSecret)
        .update('user\u0000' + owner)
        .digest('hex')
        .slice(0, 32)
      const rows = await inspector.platformRateLimit.findMany({
        where: { key: { contains: key } },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.count).toBe(4)
      expect(JSON.stringify(rows)).not.toContain(owner)
      expect(JSON.stringify(rows)).not.toContain(ip)
    })
    it('platform role seeds without SELECT; app can read only its tenant and cannot read trial history', async () => {
      const a = await create(await user()),
        b = await create(await user())
      await expect(
        scope.withProvisioningTransaction(a.organization.id, (tx) =>
          tx.setting.findMany()
        )
      ).rejects.toThrow(/permission denied/)
      const connection = await app.connect()
      try {
        await connection.query('BEGIN')
        await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
          a.organization.id,
        ])
        expect(
          (await connection.query('SELECT "tenantId" FROM settings')).rows
        ).toEqual([{ tenantId: a.organization.id }])
        expect(
          (
            await connection.query(
              'SELECT id FROM settings WHERE "tenantId"=$1',
              [b.organization.id]
            )
          ).rowCount
        ).toBe(0)
        await expect(
          connection.query('SELECT * FROM trial_claims')
        ).rejects.toThrow(/permission denied/)
      } finally {
        await connection.query('ROLLBACK')
        connection.release()
      }
      expect(
        (
          await pool.query(
            "SELECT current_setting('app.platform_scope',true) AS scope, current_setting('app.tenant_id',true) AS tenant"
          )
        ).rows[0]
      ).not.toMatchObject({ scope: 'on' })
    })
    it.each(['private', 'annual', 'expired', 'future', 'free'])(
      'refuses the currently unavailable offer: %s',
      async (mode) => {
        const owner = await user()
        const chosen = await scope.withPlatformTransaction(async (tx) => {
          const seed = await tx.planVersion.findUniqueOrThrow({
            where: { id: version },
          })
          const plan = await tx.plan.create({
            data: {
              code: 'offer-' + randomUUID().slice(0, 8),
              name: 'Synthetic offer only',
              isPublic: mode !== 'private' && mode !== 'free',
            },
          })
          return (
            await tx.planVersion.create({
              data: {
                planId: plan.id,
                version: 1,
                amount: mode === 'free' ? '0.00' : '123.45',
                interval: mode === 'annual' ? 'YEARLY' : 'MONTHLY',
                entitlements: seed.entitlements as Prisma.InputJsonValue,
                sellableFrom: new Date(
                  mode === 'future' ? '2026-10-06' : '2026-01-01'
                ),
                sellableUntil: mode === 'expired' ? instant : null,
              },
            })
          ).id
        })
        await expect(
          create(owner, { ...input(), planVersionId: chosen })
        ).rejects.toThrow('PLAN_NOT_AVAILABLE')
      }
    )
    it.each(['cnpj', 'email'])(
      'honors a preexisting canonical %s trial HMAC across assisted and future signup flows',
      async (kind) => {
        const email = 'MiXeD-' + randomUUID() + '@Example.Test',
          owner = await user(true, email),
          value = input()
        const keyHash = createHmac('sha256', trialSecret)
          .update(
            kind +
              ':' +
              (kind === 'email' ? email.toLowerCase() : value.company.cnpj)
          )
          .digest('hex')
        await scope.withPlatformTransaction((tx) =>
          tx.trialClaim.create({
            data: {
              keyHash,
              kind: kind.toUpperCase(),
              tenantId: 'synthetic-prior-claim',
            },
          })
        )
        const result = await create(owner, value)
        expect(result.subscription).toEqual({
          status: 'INCOMPLETE',
          trialEndsAt: null,
        })
        expect(result.notices).toEqual(['TRIAL_ALREADY_USED'])
      }
    )
    it('does not fabricate trial claims or warnings for a public plan with no trial', async () => {
      const chosen = await scope.withPlatformTransaction(async (tx) => {
        const seed = await tx.planVersion.findUniqueOrThrow({
          where: { id: version },
        })
        return (
          await tx.planVersion.create({
            data: {
              planId: seed.planId,
              version: 2,
              amount: '123.45',
              trialDays: 0,
              sellableFrom: new Date('2026-01-01'),
              entitlements: seed.entitlements as Prisma.InputJsonValue,
            },
          })
        ).id
      })
      const result = await create(await user(), {
        ...input(),
        planVersionId: chosen,
      })
      expect(result.subscription).toEqual({
        status: 'INCOMPLETE',
        trialEndsAt: null,
      })
      expect(result.notices).toEqual([])
      expect(
        await inspector.trialClaim.count({
          where: { tenantId: result.organization.id },
        })
      ).toBe(0)
    })
    it('uses one fail-closed IP bucket when assisted requests have no trusted IP', async () => {
      // Balde próprio (segredo só deste caso): esgotar aqui o 'unknown' do dia não pode recusar a composição assistida
      // real do caso abaixo, que também chega sem IP e usa o relógio real; com o segredo comum, ela recebia 429 sempre
      // que a data real caía no dia deste relógio sintético (onda 134).
      const provision = factory({
        now: () => new Date('2026-10-07T15:00:00Z'),
        rateLimitSecret: 'synthetic-onboarding-unknown-ip-bucket-32',
      })
      for (let i = 0; i < 5; i++)
        await provision(
          { userId: await user(), staffUserId: staff },
          input(),
          randomUUID(),
          { ip: null, userAgent: null }
        )
      const owner = await user()
      await expect(
        provision(
          { userId: owner, staffUserId: staff },
          input(),
          randomUUID(),
          { ip: null, userAgent: null }
        )
      ).rejects.toMatchObject({ status: 429, code: 'ONBOARDING_RATE_LIMITED' })
      expect(
        await inspector.organization.count({ where: { ownerUserId: owner } })
      ).toBe(0)
    })
    it('does not disclose a committed receipt after owner verification or assisted staff access is revoked', async () => {
      const owner = await user(),
        value = input(),
        key = randomUUID()
      await create(owner, value, key)
      await inspector.user.update({
        where: { id: owner },
        data: { authEmailVerified: false },
      })
      await expect(create(owner, value, key)).rejects.toThrow(
        'EMAIL_NOT_VERIFIED'
      )
    })
    it('maps a real unique-index slug conflict from a writer outside the advisory lock', async () => {
      const owner = await user(),
        value = input()
      const racingScope: PlatformScope = {
        ...scope,
        withProvisioningTransaction: (tenantId, operation) =>
          scope.withProvisioningTransaction(tenantId, (tx) =>
            operation(
              new Proxy(tx, {
                get(target, name) {
                  const original = Reflect.get(target, name, target)
                  if (name !== 'organization')
                    return typeof original === 'function'
                      ? original.bind(target)
                      : original
                  return new Proxy(original, {
                    get(delegate, member) {
                      const method = Reflect.get(delegate, member, delegate)
                      if (member !== 'create')
                        return typeof method === 'function'
                          ? method.bind(delegate)
                          : method
                      return async (...args: unknown[]) => {
                        await scope.withPlatformTransaction((other) =>
                          other.organization.create({
                            data: {
                              slug: value.slug,
                              name: 'Synthetic concurrent legacy tenant',
                            },
                          })
                        )
                        return method.apply(delegate, args)
                      }
                    },
                  })
                },
              })
            )
          ),
      }
      await expect(
        create(owner, value, randomUUID(), { scope: racingScope })
      ).rejects.toMatchObject({
        status: 409,
        code: 'SLUG_UNAVAILABLE',
        suggestions: expect.arrayContaining([value.slug + '-2']),
      })
      expect(
        await inspector.organization.count({ where: { ownerUserId: owner } })
      ).toBe(0)
    })
    it('runs the actual assisted composition and CLI with a trusted external manifest and closes each separate pool', async () => {
      const os = await import('node:os'),
        path = await import('node:path')
      const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), 'locadora-onboarding-runtime-')
        ),
        filename = path.join(directory, 'published.json')
      fs.writeFileSync(filename, JSON.stringify(onboardingPublication))
      const owner = await user(),
        value = input(),
        key = randomUUID()
      const env = {
        PLATFORM_DATABASE_URL: platformUrl,
        DATABASE_URL: appUrl,
        PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
        PLATFORM_LEGAL_DOCUMENTS_FILE: filename,
        PLATFORM_TRIAL_SECRET: trialSecret,
        PLATFORM_RATE_LIMIT_SECRET: rateLimitSecret,
      }
      try {
        const first = await runAssistedOrganizationProvisioning(
          { userId: owner, staffUserId: staff },
          value,
          key,
          env
        )
        expect(
          await runAssistedOrganizationProvisioning(
            { userId: owner, staffUserId: staff },
            value,
            key,
            env
          )
        ).toEqual(first)
        expect(first.subscription.status).toBe('TRIALING')
        const payloadFile = path.join(directory, 'input.json'),
          cliOwner = await user(),
          cliValue = input()
        fs.writeFileSync(payloadFile, JSON.stringify(cliValue))
        try {
          const argv = [
            '--import',
            'tsx',
            'tools/platform-provision-tenant.mjs',
            '--input-file=' + payloadFile,
            '--owner=' + cliOwner,
            '--operator=' + staff,
            '--key=' + randomUUID(),
            '--apply',
          ]
          const result = await promisify(execFile)(process.execPath, argv, {
            env: { ...process.env, ...env },
            timeout: 20_000,
          })
          const created = JSON.parse(result.stdout.trim()) as {
            organization: { id: string }
          }
          expect(
            await inspector.organization.findUnique({
              where: { id: created.organization.id },
            })
          ).toMatchObject({ ownerUserId: cliOwner, origin: 'ONBOARDING' })
          const repeat = await promisify(execFile)(process.execPath, argv, {
            env: { ...process.env, ...env },
            timeout: 20_000,
          })
          expect(JSON.parse(repeat.stdout.trim())).toEqual(created)
          expect(result.stdout).not.toContain(cliValue.company.cnpj)
        } finally {
          fs.unlinkSync(payloadFile)
        }
        await expect(
          runAssistedOrganizationProvisioning(
            { userId: owner, staffUserId: staff },
            input(),
            randomUUID(),
            { ...env, PLATFORM_DATABASE_URL: appUrl }
          )
        ).rejects.toThrow('Platform database unavailable')
        expect(process.env.PLATFORM_SELF_SERVICE_SIGNUP).not.toBe('on')
      } finally {
        fs.unlinkSync(filename)
        fs.rmdirSync(directory)
      }
    }, 60_000)
    describe('site publication with separate restricted database roles', () => {
      const publicationTime = new Date('2026-10-04T12:00:00Z')
      const publication = (
        overrides: Partial<Parameters<typeof createSitePublication>[0]> = {}
      ) =>
        createSitePublication({
          transaction: scope.withProvisioningTransaction,
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(appClient, context, operation),
          now: () => publicationTime,
          ...overrides,
        })
      const candidate = async (equipment = true) => {
        const owner = await user(),
          receipt = await create(owner),
          tenantId = receipt.organization.id
        const membership = await inspector.membership.findFirstOrThrow({
          where: { tenantId, userId: owner },
        })
        const category = await inspector.category.findFirstOrThrow({
          where: { tenantId },
        })
        const item = equipment
          ? await inspector.equipment.create({
              data: {
                tenantId,
                categoryId: category.id,
                name: 'Synthetic publication equipment',
                pricePerDay: '12.34',
                images: [],
              },
            })
          : null
        return {
          tenantId,
          owner,
          equipmentId: item?.id,
          principal: {
            tenantId,
            userId: owner,
            membershipId: membership.id,
            role: 'ADMIN' as const,
          },
        }
      }
      it('publishes once under concurrent requests and makes the existing owner checklist reflect the receipt', async () => {
        const f = await candidate(),
          publish = publication()
        const replies = await Promise.all([
          publish(f.principal),
          publish(f.principal),
        ])
        expect(replies[0]).toEqual({
          published: true,
          publishedAt: publicationTime.toISOString(),
        })
        expect(replies[1]).toEqual(replies[0])
        const org = await inspector.organization.findUniqueOrThrow({
          where: { id: f.tenantId },
        })
        expect(org).toMatchObject({
          sitePublishedAt: publicationTime,
          siteIndexable: false,
          directoryListed: false,
          access: 'FULL',
        })
        expect(
          await inspector.platformAuditLog.count({
            where: { tenantId: f.tenantId, action: 'SITE_PUBLISHED' },
          })
        ).toBe(1)
        expect(
          (
            await createOnboardingStatusReader({
              withTenantTransaction: (context, operation, options) =>
                withTenantTransaction(appClient, context, operation, options),
            })(f.principal)
          ).items
        ).toContainEqual({ id: 'PUBLISH_SITE', done: true })
        await expect(
          scope.withPlatformTransaction((tx) => tx.equipment.count())
        ).rejects.toThrow(/permission denied/)
        await expect(
          withTenantTransaction(appClient, f.principal, (tx) =>
            tx.organization.update({
              where: { id: f.tenantId },
              data: { sitePublishedAt: new Date() },
            })
          )
        ).rejects.toThrow(/ORGANIZATION_PLATFORM_COLUMNS/)
        await expect(
          withTenantTransaction(appClient, f.principal, (tx) =>
            tx.organization.update({
              where: { id: f.tenantId },
              data: { slug: 'changed-' + randomUUID() },
            })
          )
        ).rejects.toThrow(/SLUG_IMMUTABLE_AFTER_PUBLISH/)
      })
      it('does not treat another tenant equipment as publication eligibility', async () => {
        const empty = await candidate(false),
          other = await candidate()
        await expect(publication()(empty.principal)).rejects.toMatchObject({
          status: 409,
          code: 'FIRST_EQUIPMENT_REQUIRED',
        })
        expect(
          await inspector.equipment.count({
            where: { tenantId: other.tenantId },
          })
        ).toBe(1)
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: empty.tenantId },
          })
        ).toHaveProperty('sitePublishedAt', null)
        expect(
          await inspector.platformAuditLog.count({
            where: { tenantId: empty.tenantId, action: 'SITE_PUBLISHED' },
          })
        ).toBe(0)
      })
      it.each(['SETUP', 'RESTRICTED', 'ARCHIVED'] as const)(
        'checks actual access %s even when subscription enforcement is off',
        async (access) => {
          const f = await candidate()
          await scope.withProvisioningTransaction(f.tenantId, (tx) =>
            tx.organization.update({
              where: { id: f.tenantId },
              data: { access },
            })
          )
          vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
          try {
            await expect(publication()(f.principal)).rejects.toMatchObject({
              code:
                access === 'ARCHIVED'
                  ? 'TENANT_ARCHIVED'
                  : 'SUBSCRIPTION_RESTRICTED',
            })
          } finally {
            vi.unstubAllEnvs()
          }
          expect(
            await inspector.organization.findUniqueOrThrow({
              where: { id: f.tenantId },
            })
          ).toHaveProperty('sitePublishedAt', null)
        }
      )
      it('revalidates verified email and the current owner instead of trusting principal fields', async () => {
        const f = await candidate()
        await inspector.user.update({
          where: { id: f.owner },
          data: { authEmailVerified: false },
        })
        await expect(publication()(f.principal)).rejects.toMatchObject({
          code: 'EMAIL_NOT_VERIFIED',
        })
        await inspector.user.update({
          where: { id: f.owner },
          data: { authEmailVerified: true },
        })
        const newOwner = await user()
        await scope.withProvisioningTransaction(f.tenantId, async (tx) => {
          await tx.membership.create({
            data: {
              tenantId: f.tenantId,
              userId: newOwner,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          })
          await tx.organization.update({
            where: { id: f.tenantId },
            data: { ownerUserId: newOwner },
          })
        })
        await expect(
          publication()({ ...f.principal, isOwner: true, access: 'FULL' })
        ).rejects.toMatchObject({ code: 'OWNER_REQUIRED' })
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: f.tenantId },
          })
        ).toHaveProperty('sitePublishedAt', null)
      })
      it('rolls back the timestamp if mandatory auditing fails in the actual platform transaction', async () => {
        const f = await candidate()
        const transaction: PlatformScope['withProvisioningTransaction'] = (
          tenantId,
          operation
        ) =>
          scope.withProvisioningTransaction(tenantId, (tx) =>
            operation(
              new Proxy(tx, {
                get(target, name) {
                  if (name === 'platformAuditLog')
                    return {
                      create: async () => {
                        throw new Error('synthetic audit failure')
                      },
                    }
                  const value = Reflect.get(target, name, target)
                  return typeof value === 'function'
                    ? value.bind(target)
                    : value
                },
              })
            )
          )
        await expect(publication({ transaction })(f.principal)).rejects.toThrow(
          'synthetic audit failure'
        )
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: f.tenantId },
          })
        ).toHaveProperty('sitePublishedAt', null)
        expect(
          await inspector.platformAuditLog.count({
            where: { tenantId: f.tenantId, action: 'SITE_PUBLISHED' },
          })
        ).toBe(0)
      })
      it('holds the stock advisory lock across the separate app-role count and platform commit', async () => {
        const f = await candidate(),
          deletionPool = new Pool({ connectionString: appUrl, max: 1 }),
          deletionClient = new PrismaClient({
            adapter: new PrismaPg(deletionPool),
          })
        let release: () => void = () => {},
          counted: () => void = () => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
          }),
          reached = new Promise<void>((resolve) => {
            counted = resolve
          })
        const publish = publication({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(appClient, context, async (tx) => {
              const result = await operation(tx)
              counted()
              await gate
              return result
            }),
        })
        const published = publish(f.principal)
        let deletion: Promise<unknown> | undefined
        try {
          await reached
          const pid = Number(
            (
              await deletionClient.$queryRaw<
                { pid: number }[]
              >`SELECT pg_backend_pid() AS pid`
            )[0]!.pid
          )
          deletion = createRentalTransaction({
            withTenantTransaction: (context, operation) =>
              withTenantTransaction(deletionClient, context, operation),
          }).withRentalTransaction(f.principal, (tx) =>
            tx.equipment.delete({
              where: { id: f.equipmentId!, tenantId: f.tenantId },
            })
          )
          let blocked = false
          for (let attempt = 0; attempt < 100; attempt++) {
            blocked = (
              await db.query(
                "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) AS blocked",
                [pid]
              )
            ).rows[0].blocked
            if (blocked) break
            await new Promise((resolve) => setTimeout(resolve, 20))
          }
          expect(blocked).toBe(true)
          expect(
            await inspector.organization.findUniqueOrThrow({
              where: { id: f.tenantId },
            })
          ).toHaveProperty('sitePublishedAt', null)
          release()
          expect(await published).toHaveProperty('published', true)
          await deletion
          expect(
            await inspector.equipment.count({ where: { tenantId: f.tenantId } })
          ).toBe(0)
          expect(
            await inspector.organization.findUniqueOrThrow({
              where: { id: f.tenantId },
            })
          ).toHaveProperty('sitePublishedAt', publicationTime)
        } finally {
          release()
          await Promise.allSettled([published, ...(deletion ? [deletion] : [])])
          await deletionClient.$disconnect()
          await deletionPool.end()
        }
      }, 20_000)
      it('refuses publication if deletion of the last equipment won the stock lock', async () => {
        const f = await candidate(),
          deletionPool = new Pool({ connectionString: appUrl, max: 1 }),
          deletionClient = new PrismaClient({
            adapter: new PrismaPg(deletionPool),
          })
        let release: () => void = () => {},
          deleted: () => void = () => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
          }),
          reached = new Promise<void>((resolve) => {
            deleted = resolve
          })
        const deletion = createRentalTransaction({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(deletionClient, context, operation),
        }).withRentalTransaction(f.principal, async (tx) => {
          await tx.equipment.delete({
            where: { id: f.equipmentId!, tenantId: f.tenantId },
          })
          deleted()
          await gate
        })
        let published:
          ReturnType<ReturnType<typeof createSitePublication>> | undefined
        try {
          await reached
          published = publication()(f.principal)
          const rejection = expect(published).rejects.toMatchObject({
            code: 'FIRST_EQUIPMENT_REQUIRED',
          })
          // The deletion holds the real shared lock; releasing it lets publication re-read the committed count.
          release()
          await deletion
          await rejection
          expect(
            await inspector.organization.findUniqueOrThrow({
              where: { id: f.tenantId },
            })
          ).toHaveProperty('sitePublishedAt', null)
        } finally {
          release()
          await Promise.allSettled([
            deletion,
            ...(published ? [published] : []),
          ])
          await deletionClient.$disconnect()
          await deletionPool.end()
        }
      }, 20_000)
      it('preserves private HTTP receipts and fails before a transaction for hostile context', async () => {
        const f = await candidate(),
          environment = {
            PLATFORM_ENV: 'production',
            PLATFORM_ROOT_DOMAIN: 'example.test',
            PLATFORM_EDGE_SECRET: 'synthetic-publication-http-edge-long32',
          }
        const handler = createSitePublicationHandler({
          transaction: scope.withProvisioningTransaction,
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(appClient, context, operation),
          now: () => publicationTime,
          environment: () => environment,
        })
        const request = (origin: string) =>
          new Request('https://backend.test/api/admin/site/publish', {
            method: 'POST',
            headers: {
              Origin: origin,
              'x-platform-edge-auth': environment.PLATFORM_EDGE_SECRET,
              'x-platform-host-kind': 'app',
              'x-platform-origin': 'https://app.example.test',
            },
          })
        expect(
          (await handler(request('https://other.example.test'), f.principal))
            .status
        ).toBe(403)
        expect(
          await inspector.organization.findUniqueOrThrow({
            where: { id: f.tenantId },
          })
        ).toHaveProperty('sitePublishedAt', null)
        const response = await handler(
          request('https://app.example.test'),
          f.principal
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(response.headers.get('Vary')).toBe('Cookie, Host')
        expect(await response.json()).toEqual({
          published: true,
          publishedAt: publicationTime.toISOString(),
        })
      })
    })
    describe('welcome delivery through restricted platform scope', () => {
      const welcomeTime = new Date('2026-10-04T12:00:00Z')
      const welcome = (
        send: (_mail: PlatformMailEnvelope, _key: string) => Promise<void>,
        overrides: Partial<Parameters<typeof createOnboardingWelcome>[0]> = {}
      ) =>
        createOnboardingWelcome({
          transaction: scope.withPlatformTransaction,
          from: 'Platform <platform@example.test>',
          panelUrl: 'https://app.example.com/admin',
          send,
          now: () => welcomeTime,
          ...overrides,
        }).handlers[ONBOARDING_WELCOME_TOPIC]
      const leasedWelcome = async () => {
        const owner = await user(),
          receipt = await create(owner)
        const row = await inspector.platformOutboxEvent.update({
          where: { dedupeKey: 'onboarding-welcome:' + receipt.organization.id },
          data: {
            status: 'PROCESSING',
            attempts: 1,
            lockedBy: 'welcome-worker',
            lockedUntil: new Date(welcomeTime.getTime() + 300_000),
          },
        })
        return {
          owner,
          tenantId: receipt.organization.id,
          message: { ...row, lockedBy: 'welcome-worker' },
        }
      }
      it('sends only the verified owner, persists provider acceptance and resumes without another send', async () => {
        const f = await leasedWelcome(),
          send = vi.fn(async (_mail: PlatformMailEnvelope, _key: string) => {
            const row = await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: f.message.id },
            })
            expect(row.payload).toMatchObject({
              intent: { ownerUserId: f.owner, envelope: _mail },
            })
            expect(row.payload).not.toHaveProperty('acceptedAt')
          })
        await welcome(send)(f.message)
        expect(send).toHaveBeenCalledTimes(1)
        expect(send.mock.calls[0]![0].to).toBe(
          (await inspector.user.findUniqueOrThrow({ where: { id: f.owner } }))
            .email
        )
        expect(send.mock.calls[0]![1]).toBe(
          'onboarding-welcome:' + f.message.id
        )
        const saved = await inspector.platformOutboxEvent.findUniqueOrThrow({
          where: { id: f.message.id },
        })
        expect(saved.payload).toHaveProperty(
          'acceptedAt',
          welcomeTime.toISOString()
        )
        await welcome(send)(f.message)
        expect(send).toHaveBeenCalledTimes(1)
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: f.message.id,
              action: 'onboarding.welcome.accepted',
            },
          })
        ).toBe(1)
        expect(
          await pool
            .query(
              "SELECT current_setting('app.platform_scope',true) AS platform,current_setting('app.tenant_id',true) AS tenant"
            )
            .then((result) => result.rows[0])
        ).toMatchObject({ platform: '', tenant: '' })
      })
      it('retains the frozen intent when acceptance cannot be recorded and repeats the same provider key/body', async () => {
        const f = await leasedWelcome(),
          requests: [PlatformMailEnvelope, string][] = [],
          sentKeys = new Set<string>()
        let calls = 0
        const transaction: PlatformTransaction = (operation) => {
          if (++calls === 2)
            return Promise.reject(
              new Error('synthetic post-provider transaction failure')
            )
          return scope.withPlatformTransaction(operation)
        }
        const send = async (mail: PlatformMailEnvelope, key: string) => {
          requests.push([mail, key])
          sentKeys.add(key)
        }
        await expect(welcome(send, { transaction })(f.message)).rejects.toThrow(
          'synthetic post-provider transaction failure'
        )
        const saved = await inspector.platformOutboxEvent.findUniqueOrThrow({
          where: { id: f.message.id },
        })
        expect(saved.payload).toHaveProperty('intent')
        expect(saved.payload).not.toHaveProperty('acceptedAt')
        await welcome(send)(f.message)
        expect(requests).toHaveLength(2)
        expect(requests[1]).toEqual(requests[0])
        expect(sentKeys.size).toBe(1)
      })
      it('revalidates an ownership transfer before retry without sending to either owner', async () => {
        const f = await leasedWelcome(),
          send = vi
            .fn<(_mail: PlatformMailEnvelope, _key: string) => Promise<void>>()
            .mockRejectedValue(new Error('ambiguous provider timeout'))
        await expect(welcome(send)(f.message)).rejects.toThrow(
          'PLATFORM_MAIL_DELIVERY_FAILED'
        )
        const owner = await user()
        await scope.withProvisioningTransaction(f.tenantId, async (tx) => {
          await tx.membership.create({
            data: {
              tenantId: f.tenantId,
              userId: owner,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          })
          await tx.organization.update({
            where: { id: f.tenantId },
            data: { ownerUserId: owner },
          })
        })
        await expect(welcome(send)(f.message)).rejects.toThrow(
          'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
        )
        expect(send).toHaveBeenCalledTimes(1)
        const row = await inspector.platformOutboxEvent.findUniqueOrThrow({
          where: { id: f.message.id },
        })
        expect(row.payload).toMatchObject({
          quarantine: { reason: 'CONTENT_CHANGED' },
          intent: { ownerUserId: f.owner },
        })
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: f.message.id,
              action: 'onboarding.welcome.reconciliation',
            },
          })
        ).toBe(1)
      })
      it('commits the reconciliation audit at 23 hours and refuses a renewed ambiguous send', async () => {
        const f = await leasedWelcome(),
          send = vi
            .fn<(_mail: PlatformMailEnvelope, _key: string) => Promise<void>>()
            .mockRejectedValue(new Error('ambiguous'))
        await expect(welcome(send)(f.message)).rejects.toThrow(
          'PLATFORM_MAIL_DELIVERY_FAILED'
        )
        const later = new Date(welcomeTime.getTime() + 23 * 60 * 60_000)
        await inspector.platformOutboxEvent.update({
          where: { id: f.message.id },
          data: { lockedUntil: new Date(later.getTime() + 300_000) },
        })
        await expect(
          welcome(send, { now: () => later })(f.message)
        ).rejects.toThrow('ONBOARDING_WELCOME_RECONCILIATION_REQUIRED')
        expect(send).toHaveBeenCalledTimes(1)
        expect(
          (
            await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: f.message.id },
            })
          ).payload
        ).toMatchObject({
          quarantine: { reason: 'IDEMPOTENCY_WINDOW_EXPIRED' },
        })
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: f.message.id,
              action: 'onboarding.welcome.reconciliation',
            },
          })
        ).toBe(1)
      })
      it('claims once under concurrent workers and completes through the actual dispatcher', async () => {
        const f = await leasedWelcome()
        await inspector.platformOutboxEvent.updateMany({
          where: { id: { not: f.message.id } },
          data: {
            availableAt: new Date('2099-01-01'),
            lockedUntil: new Date('2099-01-01'),
          },
        })
        await inspector.platformOutboxEvent.update({
          where: { id: f.message.id },
          data: {
            status: 'PENDING',
            attempts: 0,
            lockedBy: null,
            lockedUntil: null,
            availableAt: welcomeTime,
          },
        })
        const send = vi.fn(async () => {})
        const jobs = (worker: string) =>
          createPlatformJobs({
            scope,
            handlers: { [ONBOARDING_WELCOME_TOPIC]: welcome(send) },
            workerId: () => worker,
            now: () => welcomeTime,
            limit: 1,
          })
        const results = await Promise.all([
          jobs('welcome-one')(),
          jobs('welcome-two')(),
        ])
        expect(results.reduce((sum, result) => sum + result.completed, 0)).toBe(
          1
        )
        expect(
          results.reduce(
            (sum, result) =>
              sum + result.failed + result.retried + result.lostLease,
            0
          )
        ).toBe(0)
        expect(send).toHaveBeenCalledTimes(1)
        expect(
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { id: f.message.id },
          })
        ).toMatchObject({
          status: 'COMPLETED',
          attempts: 1,
          lastError: null,
          lockedBy: null,
        })
      })
      it('composes welcome with the bounded mail transport while signup and the Asaas root are off', async () => {
        const f = await leasedWelcome()
        await inspector.platformOutboxEvent.updateMany({
          where: { id: { not: f.message.id } },
          data: {
            availableAt: new Date('2099-01-01'),
            lockedUntil: new Date('2099-01-01'),
          },
        })
        await inspector.platformOutboxEvent.update({
          where: { id: f.message.id },
          data: {
            status: 'PENDING',
            attempts: 0,
            lockedBy: null,
            lockedUntil: null,
            availableAt: new Date(Date.now() - 1000),
          },
        })
        await inspector.subscription.updateMany({
          data: { providerNextAttemptAt: new Date('2099-01-01') },
        })
        const fetch = vi
          .fn<typeof globalThis.fetch>()
          .mockImplementation(async (url) => {
            if (String(url) !== 'https://api.resend.com/emails')
              throw new Error('unexpected external request')
            return Response.json({ id: 'synthetic-welcome-acceptance' })
          })
        vi.stubGlobal('fetch', fetch)
        for (const [name, value] of Object.entries({
          PLATFORM_DATABASE_URL: platformUrl,
          DATABASE_URL: appUrl,
          PLATFORM_ENV: 'staging',
          PLATFORM_ROOT_DOMAIN: 'example.com',
          PLATFORM_EDGE_SECRET: 'synthetic-publication-runtime-edge-long32',
          PLATFORM_SELF_SERVICE_SIGNUP: 'off',
          PLATFORM_ASAAS_ENVIRONMENT: '',
          PLATFORM_ASAAS_ROOT_API_KEY: '',
          RESEND_API_KEY: '',
          FROM_EMAIL: 'Platform <platform@example.invalid>',
          PLATFORM_KMS_PROVIDER: '',
          PLATFORM_KMS_LOCAL_KEY: '',
        }))
          vi.stubEnv(name, value)
        let runtime: ReturnType<typeof getPlatformDatabaseRuntime> | undefined,
          businessRuntime: ReturnType<typeof getDatabaseRuntime> | undefined
        try {
          expect((await runConfiguredPlatformJobs()).status).toBe(200)
          runtime = getPlatformDatabaseRuntime()
          expect(
            await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: f.message.id },
            })
          ).toMatchObject({ status: 'PENDING', attempts: 0 })
          expect(fetch).not.toHaveBeenCalled()
          vi.stubEnv('RESEND_API_KEY', 'synthetic-welcome-key')
          expect((await runConfiguredPlatformJobs()).status).toBe(200)
          expect(
            await inspector.platformOutboxEvent.findUniqueOrThrow({
              where: { id: f.message.id },
            })
          ).toMatchObject({ status: 'COMPLETED', attempts: 1 })
          expect(fetch).toHaveBeenCalledTimes(1)
          const request = fetch.mock.calls[0]![1] as RequestInit
          expect(new Headers(request.headers).get('idempotency-key')).toBe(
            'onboarding-welcome:' + f.message.id
          )
          expect(request.signal).toBeInstanceOf(AbortSignal)
          expect(JSON.parse(request.body as string)).toMatchObject({
            to: (
              await inspector.user.findUniqueOrThrow({ where: { id: f.owner } })
            ).email,
            from: 'Platform <platform@example.invalid>',
          })
          expect(JSON.parse(request.body as string).html).toContain(
            'https://app.example.com/admin'
          )
          expect(process.env.PLATFORM_SELF_SERVICE_SIGNUP).toBe('off')
          const category = await inspector.category.findFirstOrThrow({
            where: { tenantId: f.tenantId },
          })
          await inspector.equipment.create({
            data: {
              tenantId: f.tenantId,
              categoryId: category.id,
              name: 'Runtime publication equipment',
              pricePerDay: '12.34',
              images: [],
            },
          })
          const membership = await inspector.membership.findFirstOrThrow({
            where: { tenantId: f.tenantId, userId: f.owner },
          })
          businessRuntime = getDatabaseRuntime()
          const publication = await handleConfiguredSitePublication(
            new Request('https://backend.test/api/admin/site/publish', {
              method: 'POST',
              headers: {
                Origin: 'https://app.example.com',
                'x-platform-edge-auth':
                  'synthetic-publication-runtime-edge-long32',
                'x-platform-host-kind': 'app',
                'x-platform-origin': 'https://app.example.com',
              },
            }),
            {
              tenantId: f.tenantId,
              userId: f.owner,
              membershipId: membership.id,
              role: 'ADMIN',
            }
          )
          expect(publication.status).toBe(200)
          const published = await publication.json()
          expect(published.publishedAt).toBe(
            (
              await inspector.organization.findUniqueOrThrow({
                where: { id: f.tenantId },
              })
            ).sitePublishedAt!.toISOString()
          )
          expect(
            (
              await businessRuntime.prisma.$queryRaw<
                { role: string }[]
              >`SELECT current_user AS role`
            )[0]!.role
          ).toBe(appRole)
          expect(fetch).toHaveBeenCalledTimes(1)
        } finally {
          if (businessRuntime) {
            await businessRuntime.prisma.$disconnect()
            await businessRuntime.pool.end()
            if (global.__prisma === businessRuntime.prisma)
              global.__prisma = undefined
            if (global.__pool === businessRuntime.pool)
              global.__pool = undefined
          }
          if (runtime) {
            await runtime.prisma.$disconnect()
            await runtime.pool.end()
          }
          vi.unstubAllGlobals()
          vi.unstubAllEnvs()
        }
      }, 30_000)
    })
  }
)
