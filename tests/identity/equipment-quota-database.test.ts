import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
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
import {
  ENTITLEMENT_FEATURES,
  PlanLimitReachedErrorSchema,
} from '@gb-locacoes/contracts/entitlements'
import { CatalogError } from '@gb-locacoes/backend/catalog'
import { createCatalogService } from '../../packages/backend/src/modules/catalog/service'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createSubscriptionRequestAccess } from '../../packages/backend/src/modules/entitlements/request-access'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'equipment quota on a real restricted RLS connection',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'quota_' + suffix + '_test',
      role = 'quota_' + suffix,
      platformRole = 'quota_platform_' + suffix
    const instant = new Date('2026-10-03T16:00:00Z')
    let admin: Pool,
      db: Pool,
      pool: Pool,
      platformPool: Pool,
      inspector: PrismaClient,
      business: PrismaClient,
      platformClient: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>
    let service: ReturnType<typeof createCatalogService>
    let tenantId: string,
      categoryId: string,
      subscriptionId: string,
      ownerId: string
    let counter = 0
    const rights = (equipments: number | null) => ({
      schema: 1,
      limits: { equipments, staffSeats: 2 },
      features: Object.fromEntries(
        ENTITLEMENT_FEATURES.map((key) => [key, true])
      ),
    })
    const platform = <T>(
      operation: (_tx: Prisma.TransactionClient) => Promise<T>
    ) => scope.withPlatformTransaction(operation)
    const plan = (limit: number | null, disabled: string[] = []) =>
      platform(async (tx) => {
        const row = await tx.plan.create({
          data: {
            code: 'quota-plan-' + ++counter,
            name: 'Synthetic quota fixture',
          },
        })
        return tx.planVersion.create({
          data: {
            planId: row.id,
            version: 1,
            amount: '0.00',
            entitlements: {
              ...rights(limit),
              features: Object.fromEntries(
                ENTITLEMENT_FEATURES.map((key) => [
                  key,
                  !disabled.includes(key),
                ])
              ),
            },
          },
        })
      })
    const create = (
      name = 'Equipamento',
      selected = tenantId,
      category = categoryId
    ) =>
      service.createEquipment(
        { tenantId: selected },
        {
          name,
          description: 'Descrição',
          pricePerDay: 10,
          categoryId: category,
        }
      )
    const listing = () =>
      service.listEquipments(
        { tenantId },
        {
          page: null,
          limit: '100',
          search: null,
          categoryId: null,
          isAvailable: null,
        }
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
      const businessUrl = await createLoginRole(
        db,
        url.toString(),
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT'
      )
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/app_runtime.sql', 'utf8')
          .replaceAll('app_runtime', role)
      )
      const platformUrl = await createLoginRole(
        db,
        url.toString(),
        platformRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT'
      )
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8')
          .replaceAll('platform_runtime', platformRole)
      )
      platformPool = new Pool({ connectionString: platformUrl, max: 1 })
      platformClient = new PrismaClient({ adapter: new PrismaPg(platformPool) })
      scope = createPlatformScope(platformClient)
      pool = new Pool({ connectionString: businessUrl, max: 10 })
      business = new PrismaClient({ adapter: new PrismaPg(pool) })
      inspector = new PrismaClient({ adapter: new PrismaPg(db) })
      const runner = createRentalTransaction({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
      })
      service = createCatalogService(business, runner)
      ownerId = (
        await inspector.user.create({
          data: { email: suffix + '@example.invalid' },
        })
      ).id
    }, 120_000)
    beforeEach(async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      vi.restoreAllMocks()
      const version = await plan(2)
      tenantId = 'quota-tenant-' + ++counter
      subscriptionId = 'quota-subscription-' + counter
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
        await tx.subscription.create({
          data: {
            id: subscriptionId,
            tenantId,
            planVersionId: version.id,
            status: 'ACTIVE',
          },
        })
      })
      categoryId = (
        await inspector.category.create({
          data: { tenantId, name: 'Categoria', slug: 'quota-category' },
        })
      ).id
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
    it('uses a runtime role with no ownership, bypass or platform writes', async () => {
      const flags = await pool.query(
        'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
      )
      expect(flags.rows).toEqual([{ rolsuper: false, rolbypassrls: false }])
      expect(await business.subscription.findMany()).toEqual([])
      expect(await business.equipment.findMany()).toEqual([])
      await expect(
        withTenantTransaction(business, { tenantId }, (tx) =>
          tx.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'SUSPENDED' },
          })
        )
      ).rejects.toThrow()
    })
    it('permits exactly one of ten concurrent creates at limit minus one', async () => {
      await create('Initial')
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) => create('Concurrent-' + i))
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const refused = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      )
      expect(refused).toHaveLength(9)
      for (const { reason } of refused) {
        expect(reason).toBeInstanceOf(CatalogError)
        expect(reason.status).toBe(402)
        expect(PlanLimitReachedErrorSchema.parse(reason.body)).toMatchObject({
          limit: 2,
          used: 2,
          resource: 'equipments',
        })
      }
      expect((await listing()).equipments).toHaveLength(2)
    })
    it('keeps all equipment visible after downgrade, blocks new records and permits ordinary editing', async () => {
      const first = await create('First')
      await create('Second')
      const version = await plan(1)
      await platform((tx) =>
        tx.subscription.update({
          where: { id: subscriptionId },
          data: { planVersionId: version.id },
        })
      )
      await expect(create()).rejects.toMatchObject({
        status: 402,
        body: { code: 'PLAN_LIMIT_REACHED', limit: 1, used: 2 },
      })
      expect((await listing()).equipments).toHaveLength(2)
      await service.updateEquipment({ tenantId }, first.id, {
        name: 'Preserved',
        description: 'Descrição',
        pricePerDay: 10,
        categoryId,
      })
      expect((await service.readEquipment({ tenantId }, first.id)).name).toBe(
        'Preserved'
      )
    })
    it.each([
      ['off', 'RESTRICTED'],
      ['off', 'ARCHIVED'],
      ['shadow', 'RESTRICTED'],
      ['shadow', 'ARCHIVED'],
    ] as const)('%s does not refuse creation at %s', async (mode, access) => {
      await platform((tx) =>
        tx.organization.update({ where: { id: tenantId }, data: { access } })
      )
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', mode)
      const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect((await create()).tenantId).toBe(tenantId)
      expect(log.mock.calls.length).toBe(mode === 'shadow' ? 1 : 0)
    })
    it.each([
      ['RESTRICTED', 402, 'SUBSCRIPTION_RESTRICTED'],
      ['ARCHIVED', 403, 'TENANT_ARCHIVED'],
    ] as const)(
      'on refuses new equipment at %s but retains reads',
      async (access, status, code) => {
        await create('Existing')
        await platform((tx) =>
          tx.organization.update({ where: { id: tenantId }, data: { access } })
        )
        await expect(create()).rejects.toMatchObject({ status, body: { code } })
        expect((await listing()).equipments).toHaveLength(1)
      }
    )
    it('SETUP can configure equipment within the same quota', async () => {
      await platform((tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { access: 'SETUP' },
        })
      )
      await create()
      await create()
      await expect(create()).rejects.toMatchObject({
        body: { code: 'PLAN_LIMIT_REACHED' },
      })
    })
    it('shadow records the exceeded cap and still commits the equipment', async () => {
      await create()
      await create()
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
      const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await create('Above quota shadow')
      expect(log).toHaveBeenCalledWith('[subscription-shadow]', {
        tenantId,
        code: 'PLAN_LIMIT_REACHED',
      })
      expect((await listing()).equipments).toHaveLength(3)
    })
    it('holds the access projection lock until INSERT commits', async () => {
      let entered!: () => void, release!: () => void
      const atInsert = new Promise<void>((resolve) => {
        entered = resolve
      })
      const resume = new Promise<void>((resolve) => {
        release = resolve
      })
      const base = createRentalTransaction({
        withTenantTransaction: (context, operation) =>
          withTenantTransaction(business, context, operation),
      })
      const paused = createCatalogService(business, {
        withRentalTransaction: (context, operation) =>
          base.withRentalTransaction(context, (tx) => {
            const equipment = new Proxy(tx.equipment, {
              get(target, key, receiver) {
                if (key === 'create')
                  return async (
                    input: Parameters<typeof tx.equipment.create>[0]
                  ) => {
                    entered()
                    await resume
                    return target.create(input)
                  }
                return Reflect.get(target, key, receiver)
              },
            })
            return operation(
              new Proxy(tx, {
                get(target, key, receiver) {
                  return key === 'equipment'
                    ? equipment
                    : Reflect.get(target, key, receiver)
                },
              })
            )
          }),
      })
      const creating = paused.createEquipment(
        { tenantId },
        {
          name: 'Locked admission',
          description: 'Descrição',
          pricePerDay: 10,
          categoryId,
        }
      )
      await atInsert
      const updating = platform((tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { access: 'RESTRICTED' },
        })
      )
      try {
        await vi.waitFor(
          async () => {
            const pending = await db.query(
              "SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",
              [platformRole]
            )
            expect(pending.rowCount).toBe(1)
          },
          { timeout: 2000, interval: 20 }
        )
      } finally {
        release()
        await Promise.all([creating, updating])
      }
      await expect(create()).rejects.toMatchObject({
        status: 402,
        body: { code: 'SUBSCRIPTION_RESTRICTED' },
      })
      expect((await listing()).equipments).toHaveLength(1)
    })
    it('unlimited and valid override use the tenant projection, never a foreign plan or canceled history', async () => {
      const unlimited = await plan(null)
      await platform((tx) =>
        tx.subscription.create({
          data: {
            tenantId,
            planVersionId: unlimited.id,
            status: 'CANCELED',
            canceledAt: instant,
            cancelReason: 'STAFF',
          },
        })
      )
      await create()
      await create()
      await expect(create()).rejects.toMatchObject({ body: { limit: 2 } })
      await platform((tx) =>
        tx.entitlementOverride.create({
          data: {
            tenantId,
            key: 'limits.equipments',
            value: null,
            reason: 'Synthetic fixture override',
            grantedByUserId: ownerId,
          },
        })
      )
      expect((await create()).tenantId).toBe(tenantId)
    })
    it('expired, revoked and future overrides cannot silently relax the cap', async () => {
      await create()
      await create()
      await platform((tx) =>
        tx.entitlementOverride.createMany({
          data: [
            {
              tenantId,
              key: 'limits.equipments',
              value: 50,
              reason: 'Expired fixture',
              grantedByUserId: ownerId,
              expiresAt: new Date('2020-01-01'),
            },
            {
              tenantId,
              key: 'limits.equipments',
              value: 50,
              reason: 'Revoked fixture',
              grantedByUserId: ownerId,
              revokedAt: new Date('2020-01-01'),
            },
            {
              tenantId,
              key: 'limits.equipments',
              value: 50,
              reason: 'Future fixture',
              grantedByUserId: ownerId,
              createdAt: new Date('2099-01-01'),
            },
          ],
        })
      )
      await expect(create()).rejects.toMatchObject({ body: { limit: 2 } })
    })
    it('request module admission reads only the current tenant plan and its valid overrides under RLS', async () => {
      const version = await plan(2, ['logistics'])
      const foreign = 'policy-foreign-' + ++counter
      await platform(async (tx) => {
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { planVersionId: version.id },
        })
        await tx.organization.create({
          data: {
            id: foreign,
            slug: foreign,
            name: foreign,
            access: 'FULL',
            ownerUserId: ownerId,
          },
        })
        await tx.membership.create({
          data: { tenantId: foreign, userId: ownerId, role: 'ADMIN' },
        })
        await tx.entitlementOverride.create({
          data: {
            tenantId: foreign,
            key: 'features.logistics',
            value: true,
            reason: 'Foreign module fixture',
            grantedByUserId: ownerId,
          },
        })
      })
      const actor = {
        tenantId,
        userId: ownerId,
        membershipId: 'fixture',
        role: 'ADMIN' as const,
      }
      const policy = createSubscriptionRequestAccess({
        getDatabase: () => business,
      })
      const request = () =>
        new Request('https://backend.internal/api/admin/vehicles', {
          method: 'POST',
        })
      const blocked = await policy(request(), actor)
      expect(blocked.response?.status).toBe(402)
      expect(await blocked.response?.json()).toMatchObject({
        code: 'MODULE_NOT_IN_PLAN',
        feature: 'logistics',
      })
      expect(
        await withTenantTransaction(business, { tenantId }, (tx) =>
          tx.entitlementOverride.findMany({ where: { tenantId: foreign } })
        )
      ).toEqual([])
      await platform((tx) =>
        tx.entitlementOverride.create({
          data: {
            tenantId,
            key: 'features.logistics',
            value: true,
            reason: 'Own module fixture',
            grantedByUserId: ownerId,
          },
        })
      )
      expect((await policy(request(), actor)).response).toBeUndefined()
      expect((await listing()).equipments).toHaveLength(0)
    })
    it('request ownership follows a committed owner change, never merely an ADMIN role', async () => {
      const actor = {
        tenantId,
        userId: ownerId,
        membershipId: 'fixture',
        role: 'ADMIN' as const,
      }
      const policy = createSubscriptionRequestAccess({
        getDatabase: () => business,
      })
      const request = () =>
        new Request('https://backend.internal/api/admin/financial/export')
      expect((await policy(request(), actor)).principal.isOwner).toBe(true)
      const newOwner = await inspector.user.create({
        data: { email: randomUUID() + '@example.invalid' },
      })
      await platform(async (tx) => {
        await tx.membership.create({
          data: { tenantId, userId: newOwner.id, role: 'ADMIN' },
        })
        await tx.organization.update({
          where: { id: tenantId },
          data: { access: 'ARCHIVED', ownerUserId: newOwner.id },
        })
      })
      const old = await policy(request(), actor)
      expect(old.response?.status).toBe(403)
      expect(await old.response?.json()).toMatchObject({
        code: 'TENANT_ARCHIVED',
      })
      const current = await policy(request(), { ...actor, userId: newOwner.id })
      expect(current.response).toBeUndefined()
      expect(current.principal).toMatchObject({
        access: 'ARCHIVED',
        actor: 'owner',
        isOwner: true,
      })
    })
    it('request shadow recovers an actual policy SQL failure without poisoning later tenant transactions', async () => {
      await create()
      const actor = {
        tenantId,
        userId: ownerId,
        membershipId: 'fixture',
        role: 'ADMIN' as const,
      }
      const policy = createSubscriptionRequestAccess({
        getDatabase: () => business,
      })
      const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await db.query('REVOKE SELECT ON subscriptions FROM "' + role + '"')
      try {
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
        const shadow = await policy(
          new Request('https://backend.internal/api/admin/vehicles', {
            method: 'POST',
          }),
          actor
        )
        expect(shadow).toEqual({ principal: actor })
        expect(shadow.principal).toBe(actor)
        expect((await listing()).equipments).toHaveLength(1)
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
        const blocked = await policy(
          new Request('https://backend.internal/api/admin/vehicles', {
            method: 'POST',
          }),
          actor
        )
        expect(blocked.response?.status).toBe(503)
      } finally {
        await db.query('GRANT SELECT ON subscriptions TO "' + role + '"')
      }
      expect(log).toHaveBeenCalledWith('[subscription-shadow]', {
        tenantId,
        code: 'SUBSCRIPTION_POLICY_UNAVAILABLE',
      })
    })
    it('RLS isolates usage and overrides, and a foreign category refuses without INSERT', async () => {
      const tenantA = tenantId,
        categoryA = categoryId
      await create()
      await create()
      const version = await plan(1),
        other = 'quota-foreign-' + ++counter
      await platform(async (tx) => {
        await tx.organization.create({
          data: {
            id: other,
            slug: other,
            name: other,
            access: 'FULL',
            ownerUserId: ownerId,
          },
        })
        await tx.membership.create({
          data: { tenantId: other, userId: ownerId, role: 'ADMIN' },
        })
        await tx.subscription.create({
          data: {
            tenantId: other,
            planVersionId: version.id,
            status: 'ACTIVE',
          },
        })
        await tx.entitlementOverride.create({
          data: {
            tenantId: other,
            key: 'limits.equipments',
            value: null,
            reason: 'Foreign override',
            grantedByUserId: ownerId,
          },
        })
      })
      const otherCategory = await inspector.category.create({
        data: { tenantId: other, name: 'Foreign', slug: 'foreign' },
      })
      expect(
        (await create('Foreign create', other, otherCategory.id)).tenantId
      ).toBe(other)
      await expect(
        create('Crossed category', tenantA, otherCategory.id)
      ).rejects.toMatchObject({ status: 404 })
      await expect(
        create('Foreign cannot enlarge A', tenantA, categoryA)
      ).rejects.toMatchObject({ body: { limit: 2, used: 2 } })
      expect(
        await withTenantTransaction(business, { tenantId: other }, (tx) =>
          tx.equipment.findMany({ where: { tenantId: tenantA } })
        )
      ).toEqual([])
    })
    it('on fails closed without a current binding; off and shadow preserve INSERT even after a SQL permission failure', async () => {
      await platform((tx) =>
        tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'CANCELED',
            canceledAt: instant,
            cancelReason: 'STAFF',
          },
        })
      )
      await expect(create()).rejects.toMatchObject({ status: 503 })
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
      await create()
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
      const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await db.query('REVOKE SELECT ON subscriptions FROM "' + role + '"')
      try {
        await create('Recovered shadow SQL')
      } finally {
        await db.query('GRANT SELECT ON subscriptions TO "' + role + '"')
      }
      expect(log).toHaveBeenCalledWith('[subscription-shadow]', {
        tenantId,
        code: 'SUBSCRIPTION_POLICY_UNAVAILABLE',
      })
      expect((await listing()).equipments).toHaveLength(2)
    })
  }
)
