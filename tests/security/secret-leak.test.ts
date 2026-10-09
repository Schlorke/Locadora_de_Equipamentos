import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { formatWithOptions, inspect, type InspectOptions } from 'node:util'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { FakeAsaas } from '../helpers/fake-asaas'
import { calcularDigitosCnpj } from '../../packages/domain/src/documento/cnpj'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  createEnvKeyring,
  createSecretVault,
} from '../../packages/backend/src/modules/secrets/index'
import {
  AsaasSecretValue,
  createAsaasAccountWebhooks,
  createAsaasSubaccounts,
  readAsaasConnectedAccount,
} from '../../packages/backend/src/modules/billing/index'
import {
  createConnectedAccountConfiguration,
  createOwnerSubaccountRequest,
  createProvisioningRequestsMaintenance,
  createSubaccountProvisioning,
  createUncertainSubaccountRecovery,
} from '../../packages/backend/src/modules/payment-accounts/index'
import { createOwnerPaymentAccountCreateHandler } from '../../packages/backend/src/http/owner-payment-account-create'

/**
 * T-S3 (ADR SaaS B.15, wave 134): neither the subaccount key, the creation webhook token, the declared monthly
 * income nor the mobile phone leave the vault and the live request. Every outcome of the creation (created,
 * refused, uncertain, cancelled by the switch, dead process) ends with a scan of logs, HTTP responses and every
 * platform row that could carry them. Only the Asaas contract double is called.
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'T-S3: no secret or financial datum outside the vault and the live request',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'secret_leak_' + suffix + '_test',
      platformRole = 'leak_platform_' + suffix
    const INCOME = '98765.43'
    const PHONE = '21976543210'
    const TOKEN = 'synthetic-leak-webhook-token-' + 'z'.repeat(16)
    const ring = createEnvKeyring('K1', { K1: Buffer.alloc(32, 51) })
    const vault = createSecretVault({
      current: ring,
      providers: [ring],
      fingerprintKey: Buffer.alloc(32, 52),
    })
    const fake = new FakeAsaas()
    const keys: string[] = []
    const logs: string[] = []
    const responses: string[] = []
    let clock = new Date('2026-10-07T12:00:00.000Z')
    const now = () => clock
    let admin: Pool, db: Pool, pool: Pool
    let platform: PrismaClient, unsafe: PrismaClient
    let scope: ReturnType<typeof createPlatformScope>,
      readScope: ReturnType<typeof createPlatformScope>
    let counter = 0
    const site = (slug: string) => 'https://' + slug + '.locadora.example.test'
    const settings = {
      environment: 'sandbox' as const,
      model: 'STANDARD' as const,
      requiresPaid: false,
      site,
    }
    const policy = () => ({
      outboundDisabled: false,
      egress: { kind: 'direct' as const },
    })
    /**
     * What a log line would carry, in full: the console format of every argument (objects, arrays, errors and their
     * causes at any depth, never `[object Object]`) and, for the HTTP client logger, its JSON as well.
     */
    const deep: InspectOptions = {
      depth: Infinity,
      maxArrayLength: Infinity,
      maxStringLength: Infinity,
      breakLength: Infinity,
      colors: false,
    }
    const printed = (...args: unknown[]) => formatWithOptions(deep, ...args)
    const logger = (entry: unknown) =>
      logs.push(JSON.stringify(entry) + '\n' + inspect(entry, deep))
    /** Every key the double issues is a marker: it must exist only as ciphertext. */
    const transport = async (url: string, init: RequestInit) => {
      const response = await fake.fetch(url, init)
      if (
        init.method === 'POST' &&
        new URL(url).pathname === '/v3/accounts' &&
        response.ok
      ) {
        const body = (await response.clone().json()) as {
          apiKey?: string
          accessToken?: { apiKey?: string }
        }
        const key = body.apiKey ?? body.accessToken?.apiKey
        if (key) keys.push(key)
      }
      return response
    }
    const root = () =>
      createAsaasSubaccounts({
        credential: new AsaasSecretValue(fake.rootApiKey),
        environment: 'sandbox',
        fetch: transport,
        policy,
        logger,
      })
    const worker = () =>
      createSubaccountProvisioning({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        model: 'STANDARD',
        origin: 'https://api.example.test',
        email: 'ops@example.test',
        provider: root(),
        vault,
        site,
        token: () => new AsaasSecretValue(TOKEN),
        now,
        sleep: async () => {},
      })
    const health = () =>
      createConnectedAccountConfiguration({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        origin: 'https://api.example.test',
        email: 'ops@example.test',
        token: (ref, keyId) => vault.webhookToken(ref, keyId),
        provider: async ({ ref }) => {
          const credential = await scope.withPlatformTransaction((tx) =>
            vault.reveal(tx, { ...ref, purpose: 'ASAAS_API_KEY' })
          )
          const config = {
            credential,
            environment: 'sandbox' as const,
            fetch: transport,
            policy,
            logger,
          }
          return {
            identity: () => readAsaasConnectedAccount(config),
            webhooks: createAsaasAccountWebhooks(config),
          }
        },
        now,
      })
    const message = (
      account: { id: string; tenantId: string },
      topic: string
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

    /** A company and its owner's request through the real HTTP handler (offer, then POST). */
    async function requested() {
      const n = ++counter
      const tenantId = 'leak-' + n + '-' + suffix.slice(0, 6)
      const base = '7400000000' + String(n).padStart(2, '0')
      const document = base + calcularDigitosCnpj(base)
      {
        const owner = await unsafe.user.create({
          data: { email: tenantId + '@example.test', authEmailVerified: true },
        })
        await scope.withPlatformTransaction((tx) =>
          tx.organization.create({
            data: {
              id: tenantId,
              slug: tenantId,
              name: 'Locadora sintetica ' + n,
              legalName: 'Locadora Sintetica ' + n + ' Ltda',
              companyType: 'LIMITED',
              document,
              documentNormalized: document,
              phone: '11912345678',
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
        const principal = {
          tenantId,
          userId: owner.id,
          membershipId: membership.id,
          role: 'ADMIN' as const,
        }
        const handler = createOwnerPaymentAccountCreateHandler({
          environment: () => ({
            PLATFORM_ENV: 'development',
            PLATFORM_ROOT_DOMAIN: 'localhost',
            PLATFORM_PUBLIC_PORT: '3001',
          }),
          getSession: async () => ({
            user: { id: owner.id },
            authenticatedAt: clock.getTime(),
          }),
          creation: createOwnerSubaccountRequest({
            readTransaction: readScope.withProvisioningTransaction,
            transaction: scope.withProvisioningTransaction,
            configuration: () => settings,
            enforcement: () => 'off',
            now,
          }),
          now,
        })
        const url = 'http://app.localhost:3001/api/admin/payment-account/create'
        const offer = await handler(
          new Request(url, {
            headers: { Origin: 'http://app.localhost:3001' },
          }),
          principal
        )
        const offerText = await offer.text()
        responses.push(offerText)
        const accepted = await handler(
          new Request(url, {
            method: 'POST',
            headers: {
              Origin: 'http://app.localhost:3001',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              incomeValue: INCOME,
              mobilePhone: PHONE,
              companyDataConfirmed: true,
              companyDataVersion: JSON.parse(offerText).companyDataVersion,
            }),
          }),
          principal
        )
        expect(accepted.status).toBe(202)
        responses.push(await accepted.text())
        return unsafe.paymentAccount.findFirstOrThrow({
          where: { tenantId, disconnectedAt: null },
        })
      }
    }

    /** Text of every row that could carry a secret or the declared values, as stored. */
    async function stored() {
      const rows: string[] = []
      for (const table of [
        'platform_audit_logs',
        'platform_outbox_events',
        'payment_accounts',
        'tenant_integrations',
        'platform_webhook_inbox',
        'payment_account_provisioning_requests',
        'integration_secrets',
      ]) {
        const result = await db.query(
          `SELECT row_to_json(t)::text AS row FROM "${table}" t`
        )
        rows.push(...result.rows.map((row: { row: string }) => row.row))
      }
      return rows.join('\n')
    }
    async function scan() {
      expect(keys.length).toBeGreaterThan(0)
      const evidence = [await stored(), ...logs, ...responses].join('\n')
      for (const marker of [
        INCOME,
        '98765',
        PHONE,
        TOKEN,
        fake.rootApiKey,
        ...keys,
      ])
        expect(evidence).not.toContain(marker)
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
      await db.query(
        fs
          .readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8')
          .replaceAll('platform_runtime', platformRole)
      )
      pool = new Pool({ connectionString: platformUrl, max: 4 })
      platform = new PrismaClient({ adapter: new PrismaPg(pool) })
      unsafe = new PrismaClient({ adapter: new PrismaPg(db) })
      scope = createPlatformScope(platform)
      readScope = createPlatformScope(platform, { readOnly: true })
      for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
        vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
          logs.push(printed(...args))
        })
    }, 120_000)
    afterAll(async () => {
      vi.restoreAllMocks()
      for (const client of [platform, unsafe]) await client?.$disconnect()
      for (const connection of [pool, db]) await connection?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        await admin.query('DROP ROLE IF EXISTS "' + platformRole + '"')
        await admin.end()
      }
    })

    it('the scan reads a console line as printed: objects, errors and causes in depth', () => {
      const line = printed(
        'provisioning',
        { request: { income: INCOME, nested: [{ phone: PHONE }] } },
        new Error('failed', { cause: new Error(TOKEN) })
      )
      for (const marker of [INCOME, PHONE, TOKEN])
        expect(line).toContain(marker)
      expect(line).not.toContain('[object Object]')
    })

    it('created: the key is sealed, the embedded token replaced and the values purged', async () => {
      const account = await requested()
      await worker().handlers['payment-accounts.provisioning'](
        message(account, 'payment-accounts.provisioning')
      )
      clock = new Date(clock.getTime() + 15_000)
      await health().handlers['payment-accounts.health'](
        message(account, 'payment-accounts.health')
      )
      expect(
        (
          await db.query(
            'SELECT status, "lastErrorCode" FROM payment_accounts WHERE id=$1',
            [account.id]
          )
        ).rows[0]
      ).toEqual({ status: 'AWAITING_OWNER', lastErrorCode: null })
      await scan()
    })

    it('refused (D-3): the provider codes reach the audit, the values never do', async () => {
      const account = await requested()
      fake.inject({
        method: 'POST',
        path: '/accounts',
        fault: {
          kind: 'status',
          status: 400,
          body: {
            errors: [
              {
                code: 'invalid_mobilePhone',
                description: PHONE + ' ' + INCOME,
              },
            ],
          },
        },
      })
      await worker().handlers['payment-accounts.provisioning'](
        message(account, 'payment-accounts.provisioning')
      )
      expect(
        (
          await db.query(
            `SELECT metadata FROM platform_audit_logs WHERE "targetId"=$1 AND action='payment-account.provisioning.rejected'`,
            [account.id]
          )
        ).rows[0].metadata
      ).toEqual({ status: 400, providerCodes: ['invalid_mobilePhone'] })
      await scan()
    })

    it('uncertain: the values are purged on the first unknown outcome', async () => {
      const account = await requested()
      fake.inject({
        method: 'POST',
        path: '/accounts',
        // A 5xx after the body was sent may have been applied: the outcome is unknown (never a new POST).
        fault: { kind: 'status', status: 502 },
      })
      await worker().handlers['payment-accounts.provisioning'](
        message(account, 'payment-accounts.provisioning')
      )
      clock = new Date(clock.getTime() + 300_000)
      await createUncertainSubaccountRecovery({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        provider: root(),
        now,
      }).handlers['payment-accounts.provisioning-recovery'](
        message(account, 'payment-accounts.provisioning-recovery')
      )
      await scan()
    })

    it('cancelled by the switch and a dead process: the database-only maintenance purges both', async () => {
      const cancelled = await requested()
      const dead = await requested()
      let fail!: (error: unknown) => void
      const hung = createSubaccountProvisioning({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        model: 'STANDARD',
        origin: 'https://api.example.test',
        email: 'ops@example.test',
        provider: {
          find: root().find,
          create: () =>
            new Promise((_resolve, reject) => {
              fail = reject
            }),
        },
        vault,
        site,
        token: () => new AsaasSecretValue(TOKEN),
        now,
      }).handlers['payment-accounts.provisioning'](
        message(dead, 'payment-accounts.provisioning')
      )
      await vi.waitFor(async () =>
        expect(
          (
            await db.query(
              'SELECT "lastErrorCode" FROM payment_accounts WHERE id=$1',
              [dead.id]
            )
          ).rows[0].lastErrorCode
        ).toBe('SUBACCOUNT_CREATE_PENDING')
      )
      clock = new Date(clock.getTime() + 300_000)
      await createProvisioningRequestsMaintenance({
        transaction: scope.withPlatformTransaction,
        creation: { enabled: false, model: 'STANDARD' },
        now,
      }).run()
      fail(new DOMException('synthetic', 'TimeoutError'))
      await hung
      const purged = await db.query(
        `SELECT "paymentAccountId", "purgeReason", "incomeValue", "mobilePhone" FROM payment_account_provisioning_requests WHERE "paymentAccountId" = ANY($1)`,
        [[cancelled.id, dead.id]]
      )
      expect(
        Object.fromEntries(
          purged.rows.map((row) => [row.paymentAccountId, row])
        )
      ).toEqual({
        [cancelled.id]: expect.objectContaining({
          purgeReason: 'CANCELLED',
          incomeValue: null,
          mobilePhone: null,
        }),
        [dead.id]: expect.objectContaining({
          purgeReason: 'UNCERTAIN',
          incomeValue: null,
          mobilePhone: null,
        }),
      })
      await scan()
    })
  }
)
