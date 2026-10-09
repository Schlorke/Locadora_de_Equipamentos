import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { inspect } from 'node:util'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  createEnvKeyring,
  createSecretVault,
  createSecretsRewrap,
  hasActiveFingerprint,
  hasIntegrationSecrets,
  readActiveAsaasKeyIdentity,
} from '../../packages/backend/src/modules/secrets/index'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import { getDatabaseRuntime } from '../../packages/backend/src/runtime/database'
import { runConfiguredPlatformJobs } from '../../packages/backend/src/runtime/platform-jobs'
import { GET as legacyPlatformCron } from '../../app/api/cron/platform/route'
import { GET as apiPlatformCron } from '../../apps/services/api/src/app/api/cron/platform/route'
import {
  createOwnerPaymentAccountConnection,
  createConnectedAccountConfiguration,
} from '../../packages/backend/src/modules/payment-accounts/index'
import {
  ACCOUNT_WEBHOOK_EVENTS,
  BillingProviderError,
} from '../../packages/backend/src/modules/billing/index'
import { calcularDigitosCnpj } from '../../packages/domain/src/documento/cnpj'
import {
  createIntegrationCredentialResolver,
  integrationCredentialReference,
} from '../../packages/backend/src/runtime/integration-credentials'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'vault on restricted PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'secrets_' + suffix + '_test',
      platformRole = 'vault_platform_' + suffix,
      businessRole = 'vault_business_' + suffix
    let admin: Pool, db: Pool, pool: Pool, businessPool: Pool
    let platform: PrismaClient, business: PrismaClient, unsafe: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>
    const key1 = Buffer.alloc(32, 17),
      key2 = Buffer.alloc(32, 18),
      fingerprintKey = Buffer.alloc(32, 19)
    const ring = createEnvKeyring('K1', { K1: key1 })
    const vault = createSecretVault({
      current: ring,
      providers: [ring],
      fingerprintKey,
    })
    const next = createEnvKeyring('K2', { K1: key1, K2: key2 })
    const rotated = createSecretVault({
      current: next,
      providers: [next],
      fingerprintKey,
    })
    const ref = {
      tenantId: 'tenant-alfa',
      integrationId: 'gateway_a',
      purpose: 'ASAAS_API_KEY' as const,
      environment: 'sandbox',
    }
    const inTenant = <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
      tenant = ref.tenantId
    ) =>
      business.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.tenant_id',${tenant},true)`
          return operation(tx)
        },
        { timeout: 30000 }
      )
    let first: { id: string; version: number },
      active: { id: string; version: number }
    let connectionCounter = 0
    const connectionAt = new Date('2026-10-04T15:00:00Z')
    async function connectionFixture() {
      const number = ++connectionCounter
      const tenantId = 'connected-' + number
      const base = '8500000000' + String(number).padStart(2, '0')
      const document = base + calcularDigitosCnpj(base)
      const owner = await unsafe.user.create({
        data: { email: tenantId + '@example.test', authEmailVerified: true },
      })
      await scope.withPlatformTransaction((tx) =>
        tx.organization.create({
          data: {
            id: tenantId,
            slug: tenantId,
            name: 'Synthetic receiving connection',
            document,
            documentNormalized: document,
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
      const actor = {
        tenantId,
        userId: owner.id,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      const apiKey =
        '$aact_hmlg_' + ('synthetic-connection-' + number).repeat(4)
      const read = async () => ({
        document,
        status: {
          id: 'status-not-account-id',
          commercialInfo: 'APPROVED' as const,
          bankAccountInfo: 'APPROVED' as const,
          documentation: 'APPROVED' as const,
          general: 'APPROVED' as const,
        },
      })
      const ports = {
        transaction: scope.withProvisioningTransaction,
        vault,
        environment: 'sandbox' as const,
        read,
        now: () => connectionAt,
      }
      return {
        actor,
        apiKey,
        ports,
        input: { apiKey, authenticatedAt: connectionAt.getTime() },
        connect: createOwnerPaymentAccountConnection(ports),
      }
    }
    async function configurationFixture() {
      const f = await connectionFixture()
      await f.connect(f.actor, f.input)
      const account = await unsafe.paymentAccount.findFirstOrThrow({
        where: { tenantId: f.actor.tenantId },
        include: { integration: true },
      })
      let clock = new Date(Date.now() + 1000)
      let hooks: any[] = []
      const ready = () => ({
        id: 'hook-' + account.id,
        name: 'Locadora-' + account.integrationId,
        url:
          'https://api.example.test/api/webhooks/asaas/' +
          account.integrationId,
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        sendType: 'SEQUENTIALLY',
        events: [...ACCOUNT_WEBHOOK_EVENTS],
      })
      const identity = vi.fn(async () => {
        const idle = await db.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1 AND state='idle in transaction'",
          [platformRole]
        )
        expect(idle.rows[0].n).toBe(0)
        return f.ports.read()
      })
      const create = vi.fn(async () => {
        const installed = await unsafe.tenantIntegration.findUniqueOrThrow({
          where: { id: account.integrationId },
        })
        expect(installed.webhookTokenHash).toMatch(/^[a-f0-9]{64}$/)
        hooks = [ready()]
        return ready()
      })
      const configure = vi.fn(async () => {
        hooks = [ready()]
        return ready()
      })
      const list = vi.fn(async () => structuredClone(hooks))
      const recreate = (keyVault = vault) =>
        createConnectedAccountConfiguration({
          transaction: scope.withPlatformTransaction,
          environment: 'sandbox',
          origin: 'https://api.example.test',
          email: 'ops@example.test',
          token: (ref, id) => keyVault.webhookToken(ref, id),
          provider: async ({ ref }) => {
            const key = await scope.withPlatformTransaction((tx) =>
              keyVault.reveal(tx, { ...ref, purpose: 'ASAAS_API_KEY' })
            )
            expect(key.use((value) => value)).toBe(f.apiKey)
            return { identity, webhooks: { list, create, configure } }
          },
          now: () => clock,
        })
      const message = {
        id: 'local-proof-' + account.id,
        topic: 'payment-accounts.health',
        tenantId: account.tenantId,
        aggregateId: account.id,
        payload: { accountId: account.id },
        dedupeKey: account.id,
        attempts: 1,
        lockedBy: 'local-proof',
      }
      const current = () =>
        unsafe.paymentAccount.findUniqueOrThrow({
          where: { id: account.id },
          include: { integration: true, organization: true },
        })
      return {
        ...f,
        account,
        worker: recreate(),
        recreate,
        message,
        current,
        identity,
        list,
        create,
        configure,
        ready,
        hooks: (value: any[]) => {
          hooks = value
        },
        advance: (ms = 300000) => {
          clock = new Date(clock.getTime() + ms)
        },
        now: () => clock,
      }
    }
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
        .sort()) {
        await db.query(
          fs.readFileSync(
            'prisma/migrations/' + migration + '/migration.sql',
            'utf8'
          )
        )
      }
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
      ]) {
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + file + '.sql', 'utf8')
            .replaceAll(file!, name!)
        )
      }
      pool = new Pool({ connectionString: platformUrl, max: 3 })
      businessPool = new Pool({ connectionString: businessUrl, max: 1 })
      platform = new PrismaClient({ adapter: new PrismaPg(pool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      unsafe = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(platform)
      await scope.withPlatformTransaction(async (tx) => {
        for (const [tenant, slug, id] of [
          ['tenant-alfa', 'alfa', 'gateway_a'],
          ['tenant-bravo', 'bravo', 'gateway_b'],
        ]) {
          await tx.organization.create({
            data: { id: tenant!, slug: slug!, name: slug! },
          })
          await tx.tenantIntegration.create({
            data: {
              id: id!,
              tenantId: tenant!,
              provider: 'ASAAS',
              status: 'ACTIVE',
              credentialSource: 'VAULT',
              environment: 'sandbox',
            },
          })
        }
      })
    }, 120000)
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
    })
    it('stores only ciphertext in PENDING; requires authenticated activation before tenant reads', async () => {
      first = await scope.withPlatformTransaction((tx) =>
        vault.store(tx, ref, 'synthetic-original-key')
      )
      expect(first.version).toBe(1)
      const row = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          first.id,
        ])
      ).rows[0]
      expect(row.state).toBe('PENDING')
      expect(row.ciphertext.toString('utf8')).not.toContain(
        'synthetic-original-key'
      )
      await expect(inTenant((tx) => vault.reveal(tx, ref))).rejects.toThrow(
        'SECRET_UNAVAILABLE'
      )
      await scope.withPlatformTransaction((tx) => vault.activate(tx, first.id))
      expect(
        (await inTenant((tx) => vault.reveal(tx, ref))).use((v) => v)
      ).toBe('synthetic-original-key')
    })
    it('connects with the isolated role, commits ciphertext/account/audit together, and preserves restriction', async () => {
      const f = await connectionFixture()
      expect(await f.connect(f.actor, f.input)).toEqual({ accepted: true })
      const account = await unsafe.paymentAccount.findFirstOrThrow({
        where: { tenantId: f.actor.tenantId },
        include: { integration: { include: { secrets: true } } },
      })
      expect(account).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'WEBHOOK_MISSING',
        approvedAt: null,
        providerAccountId: null,
      })
      expect(account.integration).toMatchObject({
        status: 'PROVISIONING',
        credentialSource: 'VAULT',
        credentialsRef: null,
      })
      expect(account.integration.secrets[0]?.state).toBe('ACTIVE')
      expect(
        Buffer.from(account.integration.secrets[0]!.ciphertext!).toString(
          'utf8'
        )
      ).not.toContain(f.apiKey)
      const ref = {
        tenantId: f.actor.tenantId,
        integrationId: account.integrationId,
        purpose: 'ASAAS_API_KEY' as const,
        environment: 'sandbox',
      }
      expect(
        (await inTenant((tx) => vault.reveal(tx, ref), f.actor.tenantId)).use(
          (v) => v
        )
      ).toBe(f.apiKey)
      await expect(
        inTenant((tx) => vault.reveal(tx, ref), 'tenant-bravo')
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      const audits = await unsafe.platformAuditLog.findMany({
        where: {
          tenantId: f.actor.tenantId,
          action: 'payment-account.connected',
        },
      })
      expect(audits).toHaveLength(1)
      expect(JSON.stringify(audits)).not.toContain(f.apiKey)
    })
    it('serializes simultaneous retries into one account, secret and receipt', async () => {
      const f = await connectionFixture()
      await Promise.all([
        f.connect(f.actor, f.input),
        f.connect(f.actor, f.input),
      ])
      expect(
        await unsafe.paymentAccount.count({
          where: { tenantId: f.actor.tenantId },
        })
      ).toBe(1)
      expect(
        await unsafe.integrationSecret.count({
          where: { tenantId: f.actor.tenantId },
        })
      ).toBe(1)
      expect(
        await unsafe.platformAuditLog.count({
          where: {
            tenantId: f.actor.tenantId,
            action: 'payment-account.connected',
          },
        })
      ).toBe(1)
      await expect(
        f.connect(f.actor, { ...f.input, apiKey: f.apiKey + '-different' })
      ).rejects.toThrow('PAYMENT_ACCOUNT_ALREADY_EXISTS')
    })
    it('refuses the same key in a second tenant and rolls back its integration/account', async () => {
      const a = await connectionFixture(),
        b = await connectionFixture()
      await a.connect(a.actor, a.input)
      await expect(
        b.connect(b.actor, { ...b.input, apiKey: a.apiKey })
      ).rejects.toThrow('PAYMENT_ACCOUNT_ALREADY_EXISTS')
      expect(
        await unsafe.tenantIntegration.count({
          where: { tenantId: b.actor.tenantId },
        })
      ).toBe(0)
      expect(
        await unsafe.paymentAccount.count({
          where: { tenantId: b.actor.tenantId },
        })
      ).toBe(0)
      expect(
        await unsafe.integrationSecret.count({
          where: { tenantId: b.actor.tenantId },
        })
      ).toBe(0)
    })
    it('rolls back the encrypted key when the account/audit commit fails', async () => {
      const f = await connectionFixture()
      const connect = createOwnerPaymentAccountConnection({
        ...f.ports,
        transaction: (tenantId, operation) =>
          scope.withProvisioningTransaction(tenantId, async (tx) => {
            const result = await operation(tx)
            if (await tx.paymentAccount.count({ where: { tenantId } }))
              throw new Error('synthetic-after-write-failure')
            return result
          }),
      })
      await expect(connect(f.actor, f.input)).rejects.toThrow(
        'synthetic-after-write-failure'
      )
      const where = { tenantId: f.actor.tenantId }
      expect(await unsafe.tenantIntegration.count({ where })).toBe(0)
      expect(await unsafe.paymentAccount.count({ where })).toBe(0)
      expect(await unsafe.integrationSecret.count({ where })).toBe(0)
      expect(await unsafe.platformAuditLog.count({ where })).toBe(0)
    })
    it('rechecks revoked ownership after the provider wait without persisting a key', async () => {
      const f = await connectionFixture()
      const connect = createOwnerPaymentAccountConnection({
        ...f.ports,
        read: async () => {
          await scope.withProvisioningTransaction(f.actor.tenantId, (tx) =>
            tx.organization.update({
              where: { id: f.actor.tenantId },
              data: { ownerUserId: null },
            })
          )
          return f.ports.read()
        },
      })
      await expect(connect(f.actor, f.input)).rejects.toThrow('OWNER_REQUIRED')
      expect(
        await unsafe.integrationSecret.count({
          where: { tenantId: f.actor.tenantId },
        })
      ).toBe(0)
      expect(
        await unsafe.tenantIntegration.count({
          where: { tenantId: f.actor.tenantId },
        })
      ).toBe(0)
    })
    it('business runtime cannot execute the connection as a platform writer', async () => {
      const f = await connectionFixture()
      const connect = createOwnerPaymentAccountConnection({
        ...f.ports,
        transaction: createPlatformScope(business).withProvisioningTransaction,
      })
      await expect(connect(f.actor, f.input)).rejects.toThrow(
        'Platform database role is not isolated'
      )
      expect(
        await unsafe.integrationSecret.count({
          where: { tenantId: f.actor.tenantId },
        })
      ).toBe(0)
    })
    it('refuses cross-tenant reads, administrator reads and business writes', async () => {
      await expect(
        inTenant((tx) => vault.reveal(tx, ref), 'tenant-bravo')
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      await expect(
        unsafe.$transaction((tx) => vault.reveal(tx, ref))
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      await expect(
        inTenant((tx) => vault.store(tx, ref, 'business-write-forbidden'))
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      expect(
        (
          await businessPool.query(
            "SELECT current_setting('app.tenant_id',true) AS tenant"
          )
        ).rows[0].tenant || ''
      ).toBe('')
    })
    it('configures a connected account under real platform grants and stores only a token hash', async () => {
      const f = await configurationFixture()
      await f
        .recreate(
          createSecretVault({
            current: ring,
            providers: [ring],
            fingerprintKey,
          })
        )
        .handlers['payment-accounts.health'](f.message)
      const result = await f.current()
      expect(result.status).toBe('APPROVED')
      expect(result.healthIssue).toBeNull()
      expect(result.approvedAt).not.toBeNull()
      expect(result.organization.documentVerifiedAt).not.toBeNull()
      expect(result.integration.status).toBe('ACTIVE')
      expect(result.providerAccountId).toBeNull()
      expect(result.walletId).toBeNull()
      const key = await scope.withPlatformTransaction(async (tx) => {
        const active = await readActiveAsaasKeyIdentity(tx, {
          tenantId: result.tenantId,
          integrationId: result.integrationId,
          environment: result.environment,
        })
        return vault.webhookToken(
          {
            tenantId: result.tenantId,
            integrationId: result.integrationId,
            environment: result.environment,
          },
          active!.id
        )
      })
      expect(JSON.stringify(result)).not.toContain(key.use((value) => value))
      expect(
        await unsafe.platformAuditLog.count({
          where: {
            tenantId: result.tenantId,
            action: 'payment-account.configuration.confirmed',
          },
        })
      ).toBe(1)
      const businessRows = await inTenant(
        (tx) => tx.paymentAccount.findMany(),
        result.tenantId
      )
      expect(businessRows.map((row) => row.id)).toEqual([result.id])
      expect(
        await inTenant(
          (tx) => tx.paymentAccount.count({ where: { id: result.id } }),
          'tenant-bravo'
        )
      ).toBe(0)
    })
    const auditCount = (tenantId: string, action: string) =>
      unsafe.platformAuditLog.count({ where: { tenantId, action } })
    // Wave 134 (S9, B0): the global "idle in transaction" probe of the fixture used to run while the second
    // worker was between the statements of its own legitimate claim; the probe failure was swallowed by the
    // handler and both deliveries failed. The interleaving is now fixed: A waits at the provider, B is refused.
    it('two configuration workers cause one provider creation and one activation audit', async () => {
      const f = await configurationFixture()
      const probed = f.identity.getMockImplementation()!
      let release!: () => void
      let reached!: () => void
      const parked = new Promise<void>((resolve) => (release = resolve))
      const atProvider = new Promise<void>((resolve) => (reached = resolve))
      f.identity.mockImplementationOnce(async () => {
        // The global probe runs here, while A is the only worker and holds no transaction.
        const facts = await probed()
        reached()
        await parked
        return facts
      })
      const first = f.worker.handlers['payment-accounts.health'](f.message)
      await atProvider
      await expect(
        f.worker.handlers['payment-accounts.health']({
          ...f.message,
          id: 'other-worker',
          lockedBy: 'other-worker',
        })
      ).rejects.toMatchObject({ message: 'ACCOUNT_BUSY' })
      expect(f.identity).toHaveBeenCalledTimes(1)
      expect(f.create).not.toHaveBeenCalled()
      expect(
        await auditCount(
          f.account.tenantId,
          'payment-account.configuration.pending'
        )
      ).toBe(0)
      release()
      await first
      expect(f.create).toHaveBeenCalledTimes(1)
      expect((await f.current()).status).toBe('APPROVED')
      expect(
        await auditCount(
          f.account.tenantId,
          'payment-account.configuration.confirmed'
        )
      ).toBe(1)
    })
    it('simultaneous configuration workers keep one creation and one confirmation in every interleaving', async () => {
      for (let iteration = 0; iteration < 10; iteration++) {
        const f = await configurationFixture()
        // Concurrent claims are legitimate transactions; only the single-worker cases keep the global probe.
        f.identity.mockImplementation(() => f.ports.read())
        const results = await Promise.allSettled([
          f.worker.handlers['payment-accounts.health'](f.message),
          f.worker.handlers['payment-accounts.health']({
            ...f.message,
            id: 'other-worker-' + iteration,
            lockedBy: 'other-worker-' + iteration,
          }),
        ])
        const label = 'iteration ' + iteration
        expect(
          results.some((result) => result.status === 'fulfilled'),
          label
        ).toBe(true)
        for (const result of results)
          if (result.status === 'rejected')
            expect(result.reason, label).toMatchObject({
              message: 'ACCOUNT_BUSY',
            })
        expect(f.create, label).toHaveBeenCalledTimes(1)
        expect((await f.current()).status, label).toBe('APPROVED')
        expect(
          await auditCount(
            f.account.tenantId,
            'payment-account.configuration.confirmed'
          ),
          label
        ).toBe(1)
      }
    }, 120_000)
    it('lost POST responses stay UNKNOWN through process recreation and only recover by PUT', async () => {
      const f = await configurationFixture()
      f.create.mockImplementationOnce(async () => {
        f.hooks([f.ready()])
        throw new BillingProviderError('AMBIGUOUS', {
          reason: 'TIMEOUT',
          maybeApplied: true,
        })
      })
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
      expect((await f.current()).lastErrorCode).toBe('WEBHOOK_CREATE_UNKNOWN')
      const beforeHash = (await f.current()).integration.webhookTokenHash
      f.advance()
      await f
        .recreate(
          createSecretVault({
            current: ring,
            providers: [ring],
            fingerprintKey,
          })
        )
        .handlers['payment-accounts.health'](f.message)
      expect(f.create).toHaveBeenCalledTimes(1)
      expect(f.configure).toHaveBeenCalledTimes(1)
      expect((await f.current()).integration.webhookTokenHash).toBe(beforeHash)
      expect((await f.current()).status).toBe('APPROVED')
    })
    it('an empty list after uncertain creation does not repeat POST or certify readiness', async () => {
      const f = await configurationFixture()
      f.create.mockRejectedValueOnce(new Error('synthetic-lost-response'))
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
      f.advance()
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
      expect(f.create).toHaveBeenCalledTimes(1)
      expect((await f.current()).status).toBe('RESTRICTED')
    })
    it('rollback preserves restriction when activation fails after a provider receipt', async () => {
      const f = await configurationFixture()
      const ordinary = scope.withPlatformTransaction
      const failScope = async <T>(
        operation: (tx: Prisma.TransactionClient) => Promise<T>
      ) =>
        ordinary(async (tx) => {
          const value = await operation(tx)
          if (
            await tx.platformAuditLog.count({
              where: {
                tenantId: f.account.tenantId,
                action: 'payment-account.configuration.confirmed',
              },
            })
          )
            throw new Error('synthetic-commit-failure')
          return value
        })
      const worker = createConnectedAccountConfiguration({
        transaction: failScope,
        environment: 'sandbox',
        origin: 'https://api.example.test',
        email: 'ops@example.test',
        token: (ref, id) => vault.webhookToken(ref, id),
        provider: async () => ({
          identity: f.identity,
          webhooks: { list: f.list, create: f.create, configure: f.configure },
        }),
        now: f.now,
      })
      await expect(
        worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
      const result = await f.current()
      expect(result.status).toBe('RESTRICTED')
      expect(result.integration.status).toBe('PROVISIONING')
      expect(result.approvedAt).toBeNull()
      expect(result.organization.documentVerifiedAt).toBeNull()
      expect(
        await unsafe.platformAuditLog.count({
          where: {
            tenantId: result.tenantId,
            action: 'payment-account.configuration.confirmed',
          },
        })
      ).toBe(0)
      f.advance()
      await f.worker.handlers['payment-accounts.health'](f.message)
      expect(f.create).toHaveBeenCalledTimes(1)
      expect((await f.current()).status).toBe('APPROVED')
    })
    it('a revocation while reading current provider facts wins over configuration', async () => {
      const f = await configurationFixture()
      f.identity.mockImplementationOnce(async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.paymentAccount.update({
            where: { id: f.account.id },
            data: { status: 'BLOCKED' },
          })
        )
        return f.ports.read()
      })
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('ACCOUNT_BINDING_CHANGED')
      expect((await f.current()).status).toBe('BLOCKED')
      expect(f.create).not.toHaveBeenCalled()
    })
    it('interrupted delivery remains restricted until payment reconciliation and cannot be silently restarted', async () => {
      const f = await configurationFixture()
      f.hooks([{ ...f.ready(), interrupted: true }])
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
      expect((await f.current()).healthIssue).toBe('WEBHOOK_INTERRUPTED')
      f.advance()
      f.hooks([f.ready()])
      f.identity.mockRejectedValueOnce(new Error('synthetic-unavailable-read'))
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
      expect((await f.current()).lastErrorCode).toBe(
        'WEBHOOK_RECONCILIATION_REQUIRED'
      )
      expect((await f.current()).healthIssue).toBe('WEBHOOK_INTERRUPTED')
      f.advance()
      await expect(
        f.worker.handlers['payment-accounts.health'](f.message)
      ).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
      expect(f.create).not.toHaveBeenCalled()
      expect(f.configure).not.toHaveBeenCalled()
    })
    it('serializes concurrent versions and preserves previous history', async () => {
      const versions = await Promise.all(
        ['synthetic-v2', 'synthetic-v3'].map((value) =>
          scope.withPlatformTransaction((tx) => vault.store(tx, ref, value))
        )
      )
      expect(versions.map((v) => v.version).sort()).toEqual([2, 3])
      active = versions.find((v) => v.version === 3)!
      await Promise.all(
        versions.map((v) =>
          scope.withPlatformTransaction((tx) => vault.activate(tx, v.id))
        )
      )
      const rows = (
        await db.query(
          'SELECT state,version FROM integration_secrets WHERE "integrationId"=$1 ORDER BY version',
          [ref.integrationId]
        )
      ).rows
      expect(rows.filter((row) => row.state === 'ACTIVE')).toHaveLength(1)
      expect(rows.filter((row) => row.state === 'PREVIOUS')).toHaveLength(2)
      // Choose the known version explicitly; concurrent lock acquisition order is intentionally unspecified.
      const actualActive = (
        await db.query(
          'SELECT id,version FROM integration_secrets WHERE state=\'ACTIVE\' AND "integrationId"=$1',
          [ref.integrationId]
        )
      ).rows[0]
      active = actualActive
    })
    it('rejects the same live Asaas key across rental companies without changing existing state', async () => {
      await expect(
        scope.withPlatformTransaction((tx) =>
          vault.store(
            tx,
            { ...ref, tenantId: 'tenant-bravo', integrationId: 'gateway_b' },
            'synthetic-original-key'
          )
        )
      ).rejects.toThrow('SECRET_ALREADY_EXISTS')
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM integration_secrets WHERE "tenantId"=\'tenant-bravo\''
          )
        ).rows[0].n
      ).toBe(0)
    })
    it('does not demote the active version when a pending envelope is corrupted', async () => {
      const bad = await scope.withPlatformTransaction((tx) =>
        vault.store(tx, ref, 'synthetic-invalid-candidate')
      )
      await db.query(
        'UPDATE integration_secrets SET "authTag"=$1 WHERE id=$2',
        [Buffer.alloc(16), bad.id]
      )
      await expect(
        scope.withPlatformTransaction((tx) => vault.activate(tx, bad.id))
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      expect(
        (
          await db.query('SELECT state FROM integration_secrets WHERE id=$1', [
            active.id,
          ])
        ).rows[0].state
      ).toBe('ACTIVE')
      await scope.withPlatformTransaction((tx) => vault.destroy(tx, bad.id))
    })
    it('rewraps from K1 to K2 without touching plaintext ciphertext or lifecycle and is idempotent', async () => {
      const before = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          active.id,
        ])
      ).rows[0]
      expect(
        await scope.withPlatformTransaction((tx) =>
          rotated.rewrap(tx, active.id)
        )
      ).toBe(true)
      expect(
        await scope.withPlatformTransaction((tx) =>
          rotated.rewrap(tx, active.id)
        )
      ).toBe(false)
      const after = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          active.id,
        ])
      ).rows[0]
      for (const field of [
        'ciphertext',
        'iv',
        'authTag',
        'fingerprint',
        'version',
        'state',
        'activatedAt',
      ])
        expect(after[field]).toEqual(before[field])
      expect(after.wrappedDek).not.toEqual(before.wrappedDek)
      expect(after.kekId).toBe('K2')
      expect(
        (await inTenant((tx) => rotated.reveal(tx, ref))).use((v) => v)
      ).toMatch(/^synthetic-v[23]$/)
    })
    it('borrows an existing one-connection tenant transaction for the real credential reader', async () => {
      const env = {
        PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
        PLATFORM_SECRETS_KEK_CURRENT: 'K2',
        PLATFORM_SECRETS_KEK_K1: key1.toString('base64'),
        PLATFORM_SECRETS_KEK_K2: key2.toString('base64'),
      }
      const resolve = createIntegrationCredentialResolver(() => env)
      const credential = await inTenant(async (tx) => {
        const integration = await tx.tenantIntegration.findUniqueOrThrow({
          where: { id: ref.integrationId },
        })
        return resolve(integrationCredentialReference(integration, tx))
      })
      expect(credential?.apiKey).toMatch(/^synthetic-v[23]$/)
      expect(JSON.stringify(credential)).toContain('REDACTED')
      expect(inspect(credential)).not.toMatch(/synthetic-v/)
    })
    it('delivers the installed rewrap topic once; next run preserves the same event', async () => {
      let dispatchAt = new Date()
      const job = createSecretsRewrap(scope, rotated, dispatchAt)
      const firstEvent = await job.enqueue(),
        repeated = await job.enqueue()
      expect(repeated.id).toBe(firstEvent.id)
      const dispatch = createPlatformJobs({
        scope,
        handlers: job.handlers,
        workerId: () => 'fixture-vault-worker',
        now: () => dispatchAt,
      })
      const delivered = await dispatch()
      expect(delivered).toMatchObject({ registeredTopics: 1, completed: 1 })
      expect(await dispatch()).toMatchObject({ completed: 0 })
      // More than one bounded page of fixtures needs the subsequent scheduled minute.
      for (let page = 0; page < 5; page++) {
        const remaining = await db.query(
          "SELECT count(*)::int AS n FROM integration_secrets WHERE state<>'DESTROYED' AND \"kekId\"<>'K2'"
        )
        if (remaining.rows[0].n === 0) break
        dispatchAt = new Date(dispatchAt.getTime() + 60001)
        await createSecretsRewrap(scope, rotated, dispatchAt).enqueue()
        expect(await dispatch()).toMatchObject({ completed: 1 })
        expect(await dispatch()).toMatchObject({ completed: 0 })
      }
      expect(
        (
          await db.query(
            'SELECT "kekId" FROM integration_secrets WHERE state<>\'DESTROYED\''
          )
        ).rows.every((row) => row.kekId === 'K2')
      ).toBe(true)
    })
    it('enqueue preserves a durable job identity and contains no credential/token', async () => {
      const f = await configurationFixture()
      await f.worker.enqueue()
      await f.worker.enqueue()
      const rows = await unsafe.platformOutboxEvent.findMany({
        where: { aggregateId: f.account.id, topic: 'payment-accounts.health' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]!.payload).toEqual({ accountId: f.account.id })
      expect(JSON.stringify(rows)).not.toContain(f.apiKey)
    })
    it('changes the KEK provider through the injected port while preserving the encrypted payload', async () => {
      const arn =
        'arn:aws:kms:sa-east-1:123456789012:key/12345678-1234-1234-1234-123456789abc'
      const fakeKms = {
        name: 'aws-kms' as const,
        currentKekId: () => arn,
        wrap: async (dek: Uint8Array, aad: string) => ({
          kekId: arn,
          wrapped: (await next.wrap(dek, aad)).wrapped,
        }),
        unwrap: async (_id: string, wrapped: Uint8Array, aad: string) =>
          next.unwrap('K2', wrapped, aad),
      }
      const kmsVault = createSecretVault({
        current: fakeKms,
        providers: [next, fakeKms],
        fingerprintKey,
      })
      const before = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          active.id,
        ])
      ).rows[0]
      expect(
        await scope.withPlatformTransaction((tx) =>
          kmsVault.rewrap(tx, active.id)
        )
      ).toBe(true)
      const after = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          active.id,
        ])
      ).rows[0]
      expect(after.kekProvider).toBe('aws-kms')
      for (const field of ['ciphertext', 'iv', 'authTag', 'version', 'state'])
        expect(after[field]).toEqual(before[field])
      expect(
        (await inTenant((tx) => kmsVault.reveal(tx, ref))).use((v) => v)
      ).toMatch(/^synthetic-v[23]$/)
    })
    it('crypto-shreds all four blobs only after retirement; keeps metadata and refuses future reveals', async () => {
      await expect(
        scope.withPlatformTransaction((tx) => rotated.destroy(tx, active.id))
      ).rejects.toThrow('SECRET_STATE_INVALID')
      await scope.withPlatformTransaction((tx) => rotated.retire(tx, active.id))
      await scope.withPlatformTransaction((tx) =>
        rotated.destroy(tx, active.id)
      )
      await scope.withPlatformTransaction((tx) =>
        rotated.destroy(tx, active.id)
      )
      const row = (
        await db.query('SELECT * FROM integration_secrets WHERE id=$1', [
          active.id,
        ])
      ).rows[0]
      expect([row.ciphertext, row.wrappedDek, row.iv, row.authTag]).toEqual([
        null,
        null,
        null,
        null,
      ])
      expect(row.state).toBe('DESTROYED')
      expect(row.fingerprint).toMatch(/^[a-f0-9]{64}$/)
      await expect(inTenant((tx) => rotated.reveal(tx, ref))).rejects.toThrow(
        'SECRET_UNAVAILABLE'
      )
    })
    it('HMAC grace exposes only the current and one prior key for strictly less than 24h, bounded by tenant and expiry', async () => {
      let clock = new Date('2026-10-03T12:00:00Z')
      const signingVault = createSecretVault({
        current: ring,
        providers: [ring],
        fingerprintKey,
        now: () => clock,
      })
      const integrationId = 'rotation_a'
      await scope.withPlatformTransaction((tx) =>
        tx.tenantIntegration.create({
          data: {
            id: integrationId,
            tenantId: ref.tenantId,
            provider: 'PIX',
            environment: 'sandbox',
            credentialSource: 'VAULT',
          },
        })
      )
      const reference = {
          tenantId: ref.tenantId,
          integrationId,
          environment: 'sandbox',
        },
        purpose = { ...reference, purpose: 'PROVIDER_SIGNING_SECRET' as const }
      const read = () =>
        inTenant(async (tx) =>
          (await signingVault.revealSigningSecrets(tx, reference)).map((s) =>
            s.use((v) => v)
          )
        )
      await expect(read()).rejects.toThrow('SECRET_UNAVAILABLE')
      const keys: string[] = []
      for (const key of ['first-hmac', 'second-hmac', 'third-hmac']) {
        const stored = await scope.withPlatformTransaction((tx) =>
          signingVault.store(tx, purpose, key)
        )
        keys.push(stored.id)
        await scope.withPlatformTransaction((tx) =>
          signingVault.activate(tx, stored.id)
        )
        clock = new Date(clock.getTime() + 1000)
      }
      expect(await read()).toEqual(['third-hmac', 'second-hmac'])
      const resolveSigning = createIntegrationCredentialResolver(() => ({
        PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
        PLATFORM_SECRETS_KEK_CURRENT: 'K1',
        PLATFORM_SECRETS_KEK_K1: key1.toString('base64'),
      }))
      // The runtime's real clock must agree with the fixture's grace-period clock.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(clock)
      let credential
      try {
        credential = await inTenant((tx) =>
          resolveSigning(
            integrationCredentialReference(
              {
                ...reference,
                id: integrationId,
                provider: 'PIX',
                credentialSource: 'VAULT',
                credentialsRef: null,
              },
              tx,
              'webhook'
            )
          )
        )
      } finally {
        vi.useRealTimers()
      }
      expect(credential?.signingSecrets).toEqual(['third-hmac', 'second-hmac'])
      expect(credential?.apiKey).toBeUndefined()
      expect(JSON.stringify(credential) + inspect(credential)).not.toContain(
        'third-hmac'
      )
      expect(
        (await inTenant((tx) => signingVault.reveal(tx, purpose))).use((v) => v)
      ).toBe('third-hmac')
      await expect(
        inTenant(
          (tx) => signingVault.revealSigningSecrets(tx, reference),
          'tenant-bravo'
        )
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      await db.query(
        'UPDATE integration_secrets SET "retiredAt"=$1 WHERE id=$2',
        [new Date(clock.getTime() + 60000).toISOString(), keys[1]]
      )
      // A future retirement timestamp cannot extend the grace period.
      expect(await read()).toEqual(['third-hmac'])
      const retiredAt = new Date('2026-10-03T12:00:02Z')
      await db.query(
        'UPDATE integration_secrets SET "retiredAt"=$1 WHERE id=$2',
        [retiredAt.toISOString(), keys[1]]
      )
      clock = new Date(retiredAt.getTime() + 24 * 60 * 60 * 1000 - 1)
      expect(await read()).toEqual(['third-hmac', 'second-hmac'])
      clock = new Date(retiredAt.getTime() + 24 * 60 * 60 * 1000)
      expect(await read()).toEqual(['third-hmac'])
      clock = new Date('2026-10-03T13:00:00Z')
      await db.query(
        'UPDATE integration_secrets SET "expiresAt"=$1 WHERE id=$2',
        [clock.toISOString(), keys[1]]
      )
      expect(await read()).toEqual(['third-hmac'])
      await scope.withPlatformTransaction((tx) =>
        signingVault.retire(tx, keys[0]!)
      )
      expect(await read()).toEqual(['third-hmac'])
      await db.query(
        'UPDATE integration_secrets SET "expiresAt"=$1 WHERE id=$2',
        [clock.toISOString(), keys[2]]
      )
      await expect(read()).rejects.toThrow('SECRET_UNAVAILABLE')
    })
    // Wave 134 (S9): presence and active-fingerprint checks used by the receiving-account slot and the seal retries.
    it('integration secret presence and the active fingerprint are scoped counts, never material', async () => {
      const shell = {
        tenantId: 'tenant-alfa',
        integrationId: 'gateway_shell',
        environment: 'sandbox',
      }
      await scope.withPlatformTransaction((tx) =>
        tx.tenantIntegration.create({
          data: {
            id: shell.integrationId,
            tenantId: shell.tenantId,
            provider: 'ASAAS',
            status: 'DISABLED',
            credentialSource: 'VAULT',
            environment: 'sandbox',
          },
        })
      )
      const value = 'synthetic-shell-key-' + 'z'.repeat(24)
      const fingerprint = vault.fingerprint(value)
      const asPlatform = <T>(
        operation: (tx: Prisma.TransactionClient) => Promise<T>
      ) => scope.withPlatformTransaction(operation)
      expect(await asPlatform((tx) => hasIntegrationSecrets(tx, shell))).toBe(
        false
      )
      expect(
        await asPlatform((tx) => hasActiveFingerprint(tx, shell, fingerprint))
      ).toBe(false)
      const stored = await asPlatform((tx) =>
        vault.store(tx, { ...shell, purpose: 'ASAAS_API_KEY' }, value)
      )
      // A PENDING secret already makes the integration a non-shell, but is not the active key.
      expect(await asPlatform((tx) => hasIntegrationSecrets(tx, shell))).toBe(
        true
      )
      expect(
        await asPlatform((tx) => hasActiveFingerprint(tx, shell, fingerprint))
      ).toBe(false)
      await asPlatform((tx) => vault.activate(tx, stored.id))
      const answer = await asPlatform((tx) =>
        hasActiveFingerprint(tx, shell, fingerprint)
      )
      expect(answer).toBe(true)
      expect(
        await asPlatform((tx) =>
          hasActiveFingerprint(tx, shell, vault.fingerprint(value + 'x'))
        )
      ).toBe(false)
      expect(
        await asPlatform((tx) =>
          hasActiveFingerprint(
            tx,
            { ...shell, tenantId: 'tenant-bravo' },
            fingerprint
          )
        )
      ).toBe(false)
      // The tenant runtime reads only its own company; another company is refused before any query.
      expect(
        await inTenant((tx) => hasIntegrationSecrets(tx, shell), 'tenant-alfa')
      ).toBe(true)
      await expect(
        inTenant((tx) => hasIntegrationSecrets(tx, shell), 'tenant-bravo')
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      await expect(
        inTenant(
          (tx) => hasActiveFingerprint(tx, shell, fingerprint),
          'tenant-bravo'
        )
      ).rejects.toThrow('SECRET_UNAVAILABLE')
      await expect(
        asPlatform((tx) => hasActiveFingerprint(tx, shell, 'not-a-fingerprint'))
      ).rejects.toThrow('SECRET_CONTEXT_INVALID')
      expect(JSON.stringify(answer)).toBe('true')
    })
    it('the configured runtime and both existing cron adapters use only scoped account keys', async () => {
      const f = await configurationFixture()
      const integrations = await unsafe.tenantIntegration.findMany({
        where: {
          provider: 'ASAAS',
          credentialSource: 'VAULT',
          paymentAccount: { isNot: null },
        },
        include: { organization: true },
      })
      const documents = new Map<string, string>()
      for (const integration of integrations) {
        const key = await scope.withPlatformTransaction((tx) =>
          rotated.reveal(tx, {
            tenantId: integration.tenantId,
            integrationId: integration.id,
            environment: integration.environment,
            purpose: 'ASAAS_API_KEY',
          })
        )
        documents.set(
          key.use((value) => value),
          integration.organization.document!
        )
      }
      const hooks = new Map<string, any[]>()
      const recoveredExternalId = 'pay-recovery-' + f.account.tenantId
      const fetch = vi.fn(
        async (target: string | URL | Request, init?: RequestInit) => {
          const key = new Headers(init?.headers).get('access_token')!
          expect(documents.has(key)).toBe(true)
          const url = new URL(String(target))
          if (url.pathname === '/v3/payments/' + recoveredExternalId) {
            expect(key).toBe(f.apiKey)
            expect(init?.method).toBe('GET')
            return Response.json({
              id: recoveredExternalId,
              status: 'RECEIVED',
              value: 120,
              billingType: 'BOLETO',
              paymentDate: '2026-10-04',
              deleted: false,
            })
          }
          if (url.pathname === '/v3/myAccount/commercialInfo/')
            return Response.json({ cpfCnpj: documents.get(key) })
          if (url.pathname === '/v3/myAccount/status/')
            return Response.json((await f.ports.read()).status)
          if (url.pathname === '/v3/webhooks' && init?.method === 'GET')
            return Response.json({
              hasMore: false,
              totalCount: (hooks.get(key) ?? []).length,
              data: hooks.get(key) ?? [],
            })
          if (
            url.pathname.startsWith('/v3/webhooks') &&
            ['POST', 'PUT'].includes(init?.method ?? '')
          ) {
            const body = JSON.parse(String(init!.body))
            const value = {
              ...body,
              id: 'hook-' + (documents.get(key) ?? 'missing'),
              apiVersion: 3,
            }
            expect(body.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
            hooks.set(key, [value])
            return Response.json(value)
          }
          throw new Error('Unexpected synthetic transport call')
        }
      )
      const values = {
        DATABASE_URL: businessPool.options.connectionString!,
        PLATFORM_DATABASE_URL: pool.options.connectionString!,
        PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
        PLATFORM_ASAAS_ROOT_API_KEY: '',
        PLATFORM_WEBHOOK_ORIGIN: 'https://api.example.test',
        PLATFORM_OPS_EMAIL: 'ops@example.test',
        PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
        PLATFORM_SECRETS_KEK_PROVIDER: 'env',
        PLATFORM_SECRETS_KEK_CURRENT: 'K1',
        PLATFORM_SECRETS_KEK_K1: key1.toString('base64'),
        PLATFORM_SECRETS_KEK_K2: key2.toString('base64'),
        PLATFORM_SECRETS_KMS_KEY_ARN: '',
        PLATFORM_SELF_SERVICE_SIGNUP: 'off',
        PLATFORM_ASAAS_OUTBOUND_DISABLED: 'false',
        PLATFORM_ASAAS_EGRESS_PROXY_URL: '',
        RESEND_API_KEY: '',
        CRON_SECRET: 'synthetic-account-cron',
      }
      for (const [name, value] of Object.entries(values))
        vi.stubEnv(name, value)
      vi.stubGlobal('fetch', fetch)
      const runtime = getPlatformDatabaseRuntime()
      let financialRuntime: ReturnType<typeof getDatabaseRuntime> | undefined
      try {
        for (
          let pass = 0;
          pass < 3 && (await f.current()).status !== 'APPROVED';
          pass++
        )
          expect((await runConfiguredPlatformJobs()).status).toBe(200)
        expect((await f.current()).status).toBe('APPROVED')
        expect(hooks.get(f.apiKey)).toHaveLength(1)
        const request = () =>
          new Request('http://internal.example.test/api/cron/platform', {
            headers: { authorization: 'Bearer synthetic-account-cron' },
          })
        expect((await legacyPlatformCron(request())).status).toBe(200)
        expect((await apiPlatformCron(request())).status).toBe(200)
        expect(fetch).toHaveBeenCalled()
        const payment = await unsafe.payment.create({
          data: {
            tenantId: f.account.tenantId,
            amount: 120,
            method: 'BOLETO',
            dueDate: connectionAt,
            transactionId: recoveredExternalId,
          },
        })
        await unsafe.paymentAttempt.create({
          data: {
            tenantId: f.account.tenantId,
            integrationId: f.account.integrationId,
            paymentId: payment.id,
            provider: 'ASAAS',
            externalId: recoveredExternalId,
            idempotencyKey: 'recover-' + payment.id,
            status: 'ISSUED',
            amount: 120,
            dueDate: connectionAt,
          },
        })
        await unsafe.externalResourceTenant.create({
          data: {
            tenantId: f.account.tenantId,
            integrationId: f.account.integrationId,
            provider: 'ASAAS',
            resourceType: 'PAYMENT',
            resourceId: payment.id,
            externalId: recoveredExternalId,
          },
        })
        hooks.set(
          f.apiKey,
          hooks.get(f.apiKey)!.map((row) => ({ ...row, interrupted: true }))
        )
        await scope.withPlatformTransaction((tx) =>
          tx.paymentAccount.update({
            where: { id: f.account.id },
            data: { nextAttemptAt: new Date(0) },
          })
        )
        // The existing service runtime gets a real business-role pool only for financial work.
        financialRuntime = getDatabaseRuntime()
        expect((await legacyPlatformCron(request())).status).toBe(200)
        expect(
          (
            await unsafe.payment.findUniqueOrThrow({
              where: { id: payment.id },
            })
          ).status
        ).toBe('PAID')
        expect((await f.current()).lastErrorCode).toBe(
          'WEBHOOK_RECONCILIATION_REQUIRED'
        )
        expect(hooks.get(f.apiKey)![0].interrupted).toBe(true)
        expect((await apiPlatformCron(request())).status).toBe(200)
      } finally {
        if (financialRuntime) {
          await financialRuntime.prisma.$disconnect()
          await financialRuntime.pool.end()
          global.__prisma = undefined
          global.__pool = undefined
        }
        await runtime.prisma.$disconnect()
        await runtime.pool.end()
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
      }
    })
  }
)
