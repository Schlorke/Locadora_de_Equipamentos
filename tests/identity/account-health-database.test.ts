import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
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
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createPlatformAsaasIngress } from '../../packages/backend/src/modules/platform-webhooks/index'
import {
  createAccountWebhookConsumer,
  ACCOUNT_WEBHOOK_TOPIC,
  createOwnerPaymentAccountReader,
  createOwnerAccountRecovery,
  createConnectedAccountConfiguration,
  createUncertainSubaccountRecovery,
} from '../../packages/backend/src/modules/payment-accounts/index'
import {
  BillingProviderError,
  createAccountPaymentReconciliation,
  ACCOUNT_WEBHOOK_EVENTS,
  type AccountReconciliationTarget,
  type AsaasAccountHealth,
} from '@gb-locacoes/backend/billing'
import { createPlatformJobs } from '../../packages/backend/src/modules/platform-jobs/index'
import { createPlatformOutboxRepository } from '../../packages/backend/src/modules/outbox/index'
import { SecretValue } from '../../packages/backend/src/modules/secrets/secret-value'
import { getPlatformDatabaseRuntime } from '../../packages/backend/src/runtime/platform-database'
import { runConfiguredPlatformJobs } from '@gb-locacoes/backend/runtime'
import { GET as legacyCron } from '../../app/api/cron/platform/route'
import { GET as apiCron } from '../../apps/services/api/src/app/api/cron/platform/route'
import { alphanumericCnpjFor } from '../helpers/fake-asaas'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'account health on isolated PostgreSQL roles',
  () => {
    const suffix = randomUUID().replaceAll('-', ''),
      database = 'account_health_' + suffix + '_test'
    const role = 'platform_' + suffix,
      businessRole = 'business_' + suffix
    let admin: Pool, db: Pool, platformPool: Pool, businessPool: Pool
    let platform: PrismaClient,
      inspector: PrismaClient,
      business: PrismaClient,
      platformUrl: string
    let scope: ReturnType<typeof createPlatformScope>,
      receive: ReturnType<typeof createPlatformAsaasIngress>
    let configured = false,
      counter = 0,
      tenantId: string,
      integrationId: string,
      accountId: string
    const now = new Date('2026-10-03T16:00:00Z')
    const approved: AsaasAccountHealth = {
      status: {
        id: 'status-id-not-account-id',
        commercialInfo: 'APPROVED',
        bankAccountInfo: 'APPROVED',
        documentation: 'APPROVED',
        general: 'APPROVED',
      },
      commercialInfoExpired: null,
      commercialInfoExpiresAt: null,
    }
    const read = vi.fn<(_target: unknown) => Promise<AsaasAccountHealth>>()
    const consumer = () =>
      createAccountWebhookConsumer({
        transaction: scope.withPlatformTransaction,
        read,
        now: () => now,
      })
    const receipt = async (
      extra = {},
      source: 'ASAAS_ACCOUNT' | 'ASAAS_ROOT' = 'ASAAS_ACCOUNT'
    ) => {
      const body = {
        id: 'event-' + ++counter,
        event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
        account: { id: 'acc-' + tenantId },
        ...extra,
      }
      await receive({
        source,
        body,
        payloadHash: createHash('sha256')
          .update(JSON.stringify(body))
          .digest('hex'),
        integration: {
          id: integrationId,
          tenantId,
          provider: 'ASAAS',
          externalAccountId: 'acc-' + tenantId,
        },
      })
      const row = await inspector.platformWebhookInbox.findFirstOrThrow({
        where: { tenantId, payload: { path: ['id'], equals: body.id } },
      })
      const outbox = await inspector.platformOutboxEvent.findFirstOrThrow({
        where: { aggregateId: row.id },
      })
      const message = {
        ...outbox,
        lockedBy: 'local-worker',
        payload: { inboxId: row.id },
      }
      return { row, message, body }
    }
    const current = () =>
      inspector.paymentAccount.findUniqueOrThrow({ where: { id: accountId } })
    const activeKey = async (id = 'current-key') => {
      await scope.withPlatformTransaction(async (tx) => {
        await tx.tenantIntegration.update({
          where: { id: integrationId },
          data: { credentialSource: 'VAULT', credentialsRef: null },
        })
        await tx.integrationSecret.create({
          data: {
            tenantId,
            integrationId,
            purpose: 'ASAAS_API_KEY',
            version: 1,
            state: 'ACTIVE',
            environment: 'sandbox',
            kekProvider: 'env',
            kekId: 'LOCAL',
            wrappedDek: Buffer.alloc(32),
            iv: Buffer.alloc(12),
            ciphertext: Buffer.alloc(16),
            authTag: Buffer.alloc(16),
            fingerprint: createHash('sha256')
              .update(integrationId)
              .digest('hex'),
            providerCredentialId: id,
          },
        })
      })
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
      scope = createPlatformScope(platform)
      receive = createPlatformAsaasIngress({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
      })
    }, 120_000)
    beforeEach(async () => {
      read.mockReset().mockResolvedValue(approved)
      tenantId = 'health-' + ++counter
      integrationId = 'integration-' + tenantId
      accountId = 'account-' + tenantId
      await scope.withPlatformTransaction(async (tx) => {
        await tx.organization.create({
          data: { id: tenantId, slug: tenantId, name: 'Synthetic account' },
        })
        await tx.tenantIntegration.create({
          data: {
            id: integrationId,
            tenantId,
            provider: 'ASAAS',
            environment: 'sandbox',
            externalAccountId: 'acc-' + tenantId,
            credentialsRef: 'env:LOCADORA_INTEGRATION_HEALTH_FIXTURE',
          },
        })
        await tx.paymentAccount.create({
          data: {
            id: accountId,
            tenantId,
            integrationId,
            mode: 'ASAAS_CONNECTED_ACCOUNT',
            environment: 'sandbox',
            providerAccountId: 'acc-' + tenantId,
            status: 'UNDER_REVIEW',
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
      for (const client of [platform, inspector, business])
        await client?.$disconnect()
      for (const pool of [platformPool, businessPool, db]) await pool?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const name of [role, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + name + '"')
        await admin.end()
      }
    })
    const financialFixture = async () => {
      await activeKey()
      await inspector.paymentAccount.update({
        where: { id: accountId },
        data: {
          status: 'RESTRICTED',
          healthIssue: 'WEBHOOK_INTERRUPTED',
          lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
        },
      })
      const key = await inspector.integrationSecret.findFirstOrThrow({
        where: { integrationId, state: 'ACTIVE' },
      })
      const target: AccountReconciliationTarget = {
        tenantId,
        accountId,
        integrationId,
        environment: 'sandbox',
        keyId: key.id,
        incidentId: 'incident-' + tenantId,
      }
      const externalId = 'pay-' + tenantId
      const payment = await inspector.payment.create({
        data: {
          tenantId,
          amount: 120,
          method: 'BOLETO',
          dueDate: now,
          transactionId: externalId,
        },
      })
      const attempt = await inspector.paymentAttempt.create({
        data: {
          tenantId,
          integrationId,
          paymentId: payment.id,
          provider: 'ASAAS',
          externalId,
          idempotencyKey: 'issuance-' + externalId,
          status: 'ISSUED',
          amount: 120,
          dueDate: now,
        },
      })
      await inspector.externalResourceTenant.create({
        data: {
          tenantId,
          integrationId,
          provider: 'ASAAS',
          resourceType: 'PAYMENT',
          resourceId: payment.id,
          externalId,
        },
      })
      const pointRead = vi.fn(async (_id: string) => ({
        status: 'paid' as const,
        amount: 120,
        billingType: 'BOLETO' as const,
        paidAt: now,
      }))
      const reconcile = () =>
        createAccountPaymentReconciliation({
          withTenantTransaction: (context, operation) =>
            withTenantTransaction(business, context, operation),
          readPayment: pointRead,
          now: () => new Date('2030-01-01T00:00:00Z'),
        })
      return { target, payment, attempt, externalId, pointRead, reconcile }
    }
    const completedOwnerSnapshot = async () => {
      const f = await financialFixture()
      const clock = new Date('2030-01-01T00:10:00Z')
      const owner = await inspector.user.create({
        data: { email: tenantId + '@example.test', name: 'Synthetic owner' },
      })
      const membership = await inspector.membership.create({
        data: { tenantId, userId: owner.id, role: 'ADMIN', status: 'ACTIVE' },
      })
      await scope.withProvisioningTransaction(tenantId, async (tx) => {
        await tx.organization.update({
          where: { id: tenantId },
          data: {
            ownerUserId: owner.id,
            document: '11222333000181',
            documentNormalized: '11222333000181',
          },
        })
        await tx.paymentAccount.update({
          where: { id: accountId },
          data: { nextAttemptAt: clock },
        })
        await tx.platformAuditLog.create({
          data: {
            id: f.target.incidentId,
            actorKind: 'SYSTEM',
            tenantId,
            action: 'payment-account.reconciliation.started',
            targetType: 'PaymentAccount',
            targetId: accountId,
            createdAt: new Date('2030-01-01T00:00:00Z'),
          },
        })
      })
      const result = await f.reconcile()(f.target)
      const oldReceipt = await scope.withProvisioningTransaction(
        tenantId,
        (tx) =>
          tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              tenantId,
              action: 'payment-account.reconciliation.progress',
              targetType: 'PaymentAccount',
              targetId: accountId,
              metadata: {
                incidentId: f.target.incidentId,
                keyId: f.target.keyId,
                ...result,
              },
            },
          })
      )
      const actor = {
        tenantId,
        userId: owner.id,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      const recovery = createOwnerAccountRecovery({
        readTransaction: createPlatformScope(platform, { readOnly: true })
          .withProvisioningTransaction,
        transaction: scope.withProvisioningTransaction,
        environment: 'sandbox',
        now: () => clock,
      })
      return { ...f, clock, actor, recovery, oldReceipt }
    }
    it('a confirmed fresh snapshot rereads a later refund and includes later issuance through the real health queue and RLS roles', async () => {
      const f = await completedOwnerSnapshot()
      const afterCutoff = new Date('2030-01-01T00:05:00Z')
      const payment = await inspector.payment.create({
        data: {
          tenantId,
          amount: 120,
          method: 'BOLETO',
          dueDate: f.clock,
          transactionId: 'new-' + f.externalId,
          createdAt: afterCutoff,
        },
      })
      const attempt = await inspector.paymentAttempt.create({
        data: {
          tenantId,
          integrationId,
          paymentId: payment.id,
          provider: 'ASAAS',
          externalId: 'new-' + f.externalId,
          idempotencyKey: 'new-issuance-' + tenantId,
          status: 'ISSUED',
          amount: 120,
          dueDate: f.clock,
          createdAt: afterCutoff,
        },
      })
      await inspector.externalResourceTenant.create({
        data: {
          tenantId,
          integrationId,
          provider: 'ASAAS',
          resourceType: 'PAYMENT',
          resourceId: payment.id,
          externalId: 'new-' + f.externalId,
          createdAt: afterCutoff,
        },
      })
      // Control: replaying the completed incident performs no fresh provider read.
      expect(await f.reconcile()(f.target)).toEqual({
        complete: true,
        checked: 1,
      })
      expect(f.pointRead).toHaveBeenCalledOnce()
      for (const result of await Promise.all(
        [0, 1].map(() => f.recovery.request(f.actor, f.clock.getTime()))
      ))
        expect(result).toEqual({ accepted: true })
      expect((await f.recovery.read(f.actor)).recovery).toMatchObject({
        state: 'WAITING',
        checked: 0,
        requestPending: true,
        canRequest: false,
      })
      const incidents = await inspector.platformAuditLog.findMany({
        where: {
          tenantId,
          targetId: accountId,
          action: 'payment-account.reconciliation.started',
        },
        orderBy: { createdAt: 'asc' },
      })
      expect(incidents).toHaveLength(2)
      expect(incidents[1]).toMatchObject({
        actorKind: 'OWNER',
        actorUserId: f.actor.userId,
        reasonCategory: 'OWNER_RECHECK_REQUESTED',
        metadata: {
          previousIncidentId: f.target.incidentId,
          keyId: f.target.keyId,
        },
      })
      const pointRead = vi.fn(async (id: string) => ({
        status: id === f.externalId ? ('refunded' as const) : ('paid' as const),
        amount: 120,
        billingType: 'BOLETO' as const,
        paidAt: f.clock,
      }))
      const configure = vi.fn(),
        create = vi.fn()
      const handler = createConnectedAccountConfiguration({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        origin: 'https://api.example.test',
        email: 'fixture-ops@example.test',
        now: () => f.clock,
        token: () =>
          new SecretValue('synthetic-webhook-token-with-over32-characters'),
        provider: async () => ({
          identity: async () => ({
            document: '11222333000181',
            status: approved.status!,
          }),
          webhooks: {
            list: async () => [
              {
                id: 'fixture-hook',
                name: 'Locadora-' + integrationId,
                url:
                  'https://api.example.test/api/webhooks/asaas/' +
                  integrationId,
                enabled: true,
                interrupted: true,
                apiVersion: 3 as const,
                sendType: 'SEQUENTIALLY' as const,
                events: [...ACCOUNT_WEBHOOK_EVENTS],
              },
            ],
            configure,
            create,
          },
          reconcilePayments: createAccountPaymentReconciliation({
            withTenantTransaction: (context, operation) =>
              withTenantTransaction(business, context, operation),
            readPayment: pointRead,
            now: () => f.clock,
          }),
        }),
      })
      const repository = createPlatformOutboxRepository(
        scope.withPlatformTransaction,
        ['payment-accounts.health']
      )
      const message = await repository.claim('fixture-worker', f.clock, 300_000)
      expect(message?.aggregateId).toBe(accountId)
      await expect(
        handler.handlers['payment-accounts.health']!(message!)
      ).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
      expect(
        await repository.fail(
          message!,
          'WEBHOOK_RECONCILIATION_REQUIRED',
          new Date(f.clock.getTime() + 300_000),
          false
        )
      ).toBe(true)
      expect(pointRead.mock.calls.map(([id]) => id)).toEqual([
        f.externalId,
        'new-' + f.externalId,
      ])
      for (const [paymentId, attemptId, status] of [
        [f.payment.id, f.attempt.id, 'REFUNDED'],
        [payment.id, attempt.id, 'PAID'],
      ]) {
        expect(
          (
            await inspector.payment.findUniqueOrThrow({
              where: { id: paymentId! },
            })
          ).status
        ).toBe(status)
        expect(
          (
            await inspector.paymentAttempt.findUniqueOrThrow({
              where: { id: attemptId! },
            })
          ).status
        ).toBe(status)
      }
      const checkpoints = await inspector.auditLog.findMany({
        where: { tenantId, action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' },
      })
      expect(checkpoints.map((row) => row.changes)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            incidentId: f.target.incidentId,
            cutoff: '2030-01-01T00:00:00.000Z',
            checked: 1,
            complete: true,
          }),
          expect.objectContaining({
            incidentId: incidents[1]!.id,
            cutoff: f.clock.toISOString(),
            checked: 2,
            complete: true,
          }),
        ])
      )
      expect(
        await inspector.platformAuditLog.findUnique({
          where: { id: f.oldReceipt.id },
        })
      ).toEqual(f.oldReceipt)
      expect((await f.recovery.read(f.actor)).recovery).toMatchObject({
        state: 'SNAPSHOT_COMPLETE',
        checked: 2,
        requestPending: true,
        canRequest: true,
      })
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        approvedAt: null,
        healthIssue: 'WEBHOOK_INTERRUPTED',
      })
      expect(configure).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
    })
    it('a claimed queue row prevents incident replacement even before the account lease is acquired', async () => {
      const f = await completedOwnerSnapshot()
      await f.recovery.request(f.actor, f.clock.getTime())
      const incident = await inspector.platformAuditLog.findFirstOrThrow({
        where: { tenantId, action: 'payment-account.reconciliation.started' },
        orderBy: { createdAt: 'desc' },
      })
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId,
            targetType: 'PaymentAccount',
            targetId: accountId,
            action: 'payment-account.reconciliation.progress',
            metadata: {
              incidentId: incident.id,
              keyId: f.target.keyId,
              checked: 1,
              complete: true,
            },
          },
        })
      )
      const repository = createPlatformOutboxRepository(
        scope.withPlatformTransaction,
        ['payment-accounts.health']
      )
      const message = await repository.claim('fixture-worker', f.clock, 300_000)
      expect(message?.aggregateId).toBe(accountId)
      expect((await f.recovery.read(f.actor)).recovery?.canRequest).toBe(false)
      const audits = await inspector.platformAuditLog.count({
        where: { tenantId },
      })
      expect(await f.recovery.request(f.actor, f.clock.getTime())).toEqual({
        accepted: true,
      })
      expect(
        await inspector.platformAuditLog.count({ where: { tenantId } })
      ).toBe(audits)
      expect(await repository.complete(message!, f.clock)).toBe(true)
    })
    it('a failed request audit rolls back the fresh incident and queue intent together', async () => {
      const f = await completedOwnerSnapshot()
      const audits = await inspector.platformAuditLog.count({
        where: { tenantId },
      })
      await db.query(
        `ALTER TABLE platform_audit_logs ADD CONSTRAINT fixture_request_failure CHECK (action <> 'payment-account.reconciliation.requested') NOT VALID`
      )
      try {
        await expect(
          f.recovery.request(f.actor, f.clock.getTime())
        ).rejects.toThrow()
        expect(
          await inspector.platformAuditLog.count({ where: { tenantId } })
        ).toBe(audits)
        expect(
          await inspector.platformOutboxEvent.count({
            where: { tenantId, topic: 'payment-accounts.health' },
          })
        ).toBe(0)
        expect((await f.recovery.read(f.actor)).recovery).toMatchObject({
          state: 'SNAPSHOT_COMPLETE',
          checked: 1,
          canRequest: true,
          requestPending: false,
        })
      } finally {
        await db.query(
          'ALTER TABLE platform_audit_logs DROP CONSTRAINT fixture_request_failure'
        )
      }
    })
    it('recovers current payment through the existing processor under tenant RLS and leaves platform readiness restricted', async () => {
      const f = await financialFixture()
      expect(await business.payment.findMany()).toEqual([])
      await expect(platform.payment.findMany()).rejects.toThrow()
      expect(await f.reconcile()(f.target)).toEqual({
        complete: true,
        checked: 1,
      })
      expect(
        await inspector.payment.findUniqueOrThrow({
          where: { id: f.payment.id },
        })
      ).toMatchObject({ status: 'PAID', billingStatus: 'PAID', paidAt: now })
      expect(
        await inspector.paymentAttempt.findUniqueOrThrow({
          where: { id: f.attempt.id },
        })
      ).toMatchObject({ status: 'PAID' })
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
      })
      // Recreating the service resumes the durable incident without another provider read.
      expect(await f.reconcile()(f.target)).toEqual({
        complete: true,
        checked: 1,
      })
      expect(f.pointRead).toHaveBeenCalledTimes(1)
    })
    it('provider I/O releases the sole business connection; paid quote recovery keeps one conversion event', async () => {
      const f = await financialFixture()
      const quote = await inspector.quote.create({
        data: {
          tenantId,
          name: 'Synthetic payer',
          email: 'payer@example.test',
          phone: '00000000000',
          total: 120,
          approvedAt: now,
        },
      })
      await inspector.payment.update({
        where: { id: f.payment.id },
        data: { quoteId: quote.id },
      })
      f.pointRead.mockImplementation(async () => {
        expect(await business.payment.findMany()).toEqual([])
        expect(
          await withTenantTransaction(business, { tenantId }, (tx) =>
            tx.payment.count({ where: { id: f.payment.id } })
          )
        ).toBe(1)
        return {
          status: 'paid',
          amount: 120,
          billingType: 'BOLETO',
          paidAt: now,
        }
      })
      await f.reconcile()(f.target)
      await f.reconcile()({ ...f.target, incidentId: 'second-incident' })
      expect(
        await inspector.outboxEvent.count({
          where: {
            tenantId,
            topic: 'quote.payment.convert',
            aggregateId: quote.id,
          },
        })
      ).toBe(1)
      expect(
        (await inspector.quote.findUniqueOrThrow({ where: { id: quote.id } }))
          .status
      ).toBe('APPROVED')
    })
    it('a mapped legacy reference without its attempt cannot produce an empty complete snapshot', async () => {
      const f = await financialFixture()
      await inspector.paymentAttempt.delete({ where: { id: f.attempt.id } })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_LEGACY_REFERENCE_UNCOVERED'
      )
      expect(f.pointRead).not.toHaveBeenCalled()
    })
    it('a changed obligation during the provider read keeps its new amount and the old cursor', async () => {
      const f = await financialFixture()
      f.pointRead.mockImplementationOnce(async () => {
        await inspector.payment.update({
          where: { id: f.payment.id },
          data: { amount: 130 },
        })
        return {
          status: 'paid',
          amount: 120,
          billingType: 'BOLETO',
          paidAt: now,
        }
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_PAYMENT_CHANGED'
      )
      expect(
        await inspector.payment.findUniqueOrThrow({
          where: { id: f.payment.id },
        })
      ).toMatchObject({ status: 'PENDING', amount: expect.anything() })
      expect(
        await inspector.auditLog.count({
          where: { tenantId, action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' },
        })
      ).toBe(1)
    })
    it('rejects an invalid persisted checkpoint instead of declaring readiness', async () => {
      const f = await financialFixture()
      await inspector.auditLog.create({
        data: {
          tenantId,
          action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS',
          entity: 'PaymentAccount',
          entityId: accountId,
          changes: {
            incidentId: f.target.incidentId,
            keyId: f.target.keyId,
            complete: true,
            checked: -1,
          },
        },
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_CHECKPOINT_INVALID'
      )
      expect(f.pointRead).not.toHaveBeenCalled()
    })
    it('persists bounded pages and resumes a failed read without repeating earlier financial effects', async () => {
      const f = await financialFixture()
      for (let i = 0; i < 6; i++) {
        const externalId = f.externalId + '-' + i
        const payment = await inspector.payment.create({
          data: {
            tenantId,
            amount: 120,
            method: 'BOLETO',
            dueDate: now,
            transactionId: externalId,
          },
        })
        await inspector.paymentAttempt.create({
          data: {
            tenantId,
            integrationId,
            paymentId: payment.id,
            provider: 'ASAAS',
            externalId,
            idempotencyKey: 'issue-' + externalId,
            status: 'ISSUED',
            amount: 120,
            dueDate: now,
          },
        })
        await inspector.externalResourceTenant.create({
          data: {
            tenantId,
            integrationId,
            provider: 'ASAAS',
            resourceType: 'PAYMENT',
            resourceId: payment.id,
            externalId,
          },
        })
      }
      expect(await f.reconcile()(f.target)).toEqual({
        complete: false,
        checked: 5,
      })
      expect(f.pointRead).toHaveBeenCalledTimes(5)
      f.pointRead.mockRejectedValueOnce(new Error('private-read-error'))
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_PROVIDER_UNAVAILABLE'
      )
      expect(await f.reconcile()(f.target)).toEqual({
        complete: true,
        checked: 7,
      })
      expect(
        await inspector.payment.count({ where: { tenantId, status: 'PAID' } })
      ).toBe(7)
      expect(f.pointRead).toHaveBeenCalledTimes(8)
      expect(
        await inspector.auditLog.count({
          where: { tenantId, action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' },
        })
      ).toBe(9)
    })
    it.each([
      'foreign-tenant',
      'wrong-integration',
      'wrong-key',
      'production',
      'blocked',
      'suspended',
    ])('refuses binding %s before provider I/O', async (scenario) => {
      const f = await financialFixture(),
        target = { ...f.target }
      if (scenario === 'foreign-tenant') target.tenantId = 'foreign-tenant'
      if (scenario === 'wrong-integration')
        target.integrationId = 'wrong-integration'
      if (scenario === 'wrong-key') target.keyId = 'wrong-key'
      if (scenario === 'production') target.environment = 'production'
      if (scenario === 'blocked')
        await inspector.paymentAccount.update({
          where: { id: accountId },
          data: { status: 'BLOCKED' },
        })
      if (scenario === 'suspended')
        await scope.withPlatformTransaction((tx) =>
          tx.organization.update({
            where: { id: tenantId },
            data: { status: 'SUSPENDED' },
          })
        )
      await expect(f.reconcile()(target)).rejects.toThrow()
      expect(f.pointRead).not.toHaveBeenCalled()
      expect(
        (
          await inspector.payment.findUniqueOrThrow({
            where: { id: f.payment.id },
          })
        ).status
      ).toBe('PENDING')
    })
    it.each(['amount', 'method', 'paid-date', 'resource', 'collision'])(
      'retains the cursor and obligation when evidence has invalid %s',
      async (scenario) => {
        const f = await financialFixture()
        if (scenario === 'amount')
          f.pointRead.mockResolvedValueOnce({
            status: 'paid',
            amount: 119.99,
            billingType: 'BOLETO',
            paidAt: now,
          })
        if (scenario === 'method')
          f.pointRead.mockResolvedValueOnce({
            status: 'paid',
            amount: 120,
            billingType: 'PIX',
            paidAt: now,
          } as any)
        if (scenario === 'paid-date')
          f.pointRead.mockResolvedValueOnce({
            status: 'paid',
            amount: 120,
            billingType: 'BOLETO',
          } as any)
        if (scenario === 'resource')
          await inspector.externalResourceTenant.deleteMany({
            where: { tenantId, integrationId },
          })
        if (scenario === 'collision') {
          // A second Asaas integration is forbidden by SQL; nullable legacy attempts still need quarantine.
          await inspector.paymentAttempt.create({
            data: {
              tenantId,
              integrationId: null,
              paymentId: f.payment.id,
              provider: 'ASAAS',
              externalId: f.externalId,
              idempotencyKey: 'collision-' + f.attempt.id,
              amount: 120,
              dueDate: now,
              status: 'ISSUED',
            },
          })
        }
        await expect(f.reconcile()(f.target)).rejects.toThrow('RECONCILIATION_')
        expect(
          (
            await inspector.payment.findUniqueOrThrow({
              where: { id: f.payment.id },
            })
          ).status
        ).toBe('PENDING')
        expect(
          await inspector.auditLog.count({
            where: { tenantId, action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' },
          })
        ).toBe(1)
        if (scenario === 'resource' || scenario === 'collision')
          expect(f.pointRead).not.toHaveBeenCalled()
      }
    )
    it('a block or changed obligation during GET prevents financial writes', async () => {
      const f = await financialFixture()
      f.pointRead.mockImplementationOnce(async () => {
        await inspector.paymentAccount.update({
          where: { id: accountId },
          data: { status: 'BLOCKED' },
        })
        return {
          status: 'paid',
          amount: 120,
          billingType: 'BOLETO',
          paidAt: now,
        }
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_BINDING_CHANGED'
      )
      expect(
        (
          await inspector.payment.findUniqueOrThrow({
            where: { id: f.payment.id },
          })
        ).status
      ).toBe('PENDING')
    })
    it('a paid historical attempt records review without settling the new obligation', async () => {
      const f = await financialFixture()
      await inspector.payment.update({
        where: { id: f.payment.id },
        data: { transactionId: 'pay-new-current' },
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_MANUAL_REVIEW_REQUIRED'
      )
      expect(
        (
          await inspector.payment.findUniqueOrThrow({
            where: { id: f.payment.id },
          })
        ).status
      ).toBe('PENDING')
      expect(
        (
          await inspector.paymentAttempt.findUniqueOrThrow({
            where: { id: f.attempt.id },
          })
        ).status
      ).toBe('PAID')
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_MANUAL_REVIEW_REQUIRED'
      )
      expect(
        await inspector.auditLog.count({
          where: { tenantId, action: 'PAYMENT_RECONCILIATION_REQUIRED' },
        })
      ).toBe(1)
    })
    it('confirmed cancellation updates only the attempt, preserving the payable obligation', async () => {
      const f = await financialFixture()
      f.pointRead.mockResolvedValueOnce({
        status: 'cancelled',
        amount: 120,
        billingType: 'BOLETO',
      } as any)
      await f.reconcile()(f.target)
      expect(
        (
          await inspector.payment.findUniqueOrThrow({
            where: { id: f.payment.id },
          })
        ).status
      ).toBe('PENDING')
      expect(
        await inspector.paymentAttempt.findUniqueOrThrow({
          where: { id: f.attempt.id },
        })
      ).toMatchObject({ status: 'CANCELLED', cancellationStatus: 'CONFIRMED' })
    })
    it('a full refund preserves historical payment and attempt instead of recreating a charge', async () => {
      const f = await financialFixture()
      await inspector.payment.update({
        where: { id: f.payment.id },
        data: { status: 'PAID', paidAt: now },
      })
      await inspector.paymentAttempt.update({
        where: { id: f.attempt.id },
        data: { status: 'PAID' },
      })
      f.pointRead.mockResolvedValueOnce({
        status: 'refunded',
        amount: 120,
        billingType: 'BOLETO',
      } as any)
      await f.reconcile()(f.target)
      expect(
        await inspector.payment.findUniqueOrThrow({
          where: { id: f.payment.id },
        })
      ).toMatchObject({ status: 'REFUNDED', paidAt: now })
      expect(
        (
          await inspector.paymentAttempt.findUniqueOrThrow({
            where: { id: f.attempt.id },
          })
        ).status
      ).toBe('REFUNDED')
    })
    it('uncertain issuance without an external ID never supplies a complete financial snapshot', async () => {
      const f = await financialFixture()
      await inspector.paymentAttempt.update({
        where: { id: f.attempt.id },
        data: { externalId: null, status: 'UNKNOWN' },
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_ISSUANCE_UNCERTAIN'
      )
      expect(f.pointRead).not.toHaveBeenCalled()
    })
    it('key expiry during the network read prevents use of the captured credential', async () => {
      const f = await financialFixture()
      f.pointRead.mockImplementationOnce(async () => {
        await scope.withPlatformTransaction((tx) =>
          tx.integrationSecret.update({
            where: { id: f.target.keyId },
            data: { expiresAt: new Date('2020-01-01T00:00:00Z') },
          })
        )
        return {
          status: 'paid',
          amount: 120,
          billingType: 'BOLETO',
          paidAt: now,
        }
      })
      await expect(f.reconcile()(f.target)).rejects.toThrow(
        'RECONCILIATION_BINDING_CHANGED'
      )
      expect(
        (
          await inspector.payment.findUniqueOrThrow({
            where: { id: f.payment.id },
          })
        ).status
      ).toBe('PENDING')
    })
    it('checkpoint failure rolls back payment and conversion effects in the same transaction', async () => {
      const f = await financialFixture()
      await db.query(
        `ALTER TABLE audit_logs ADD CONSTRAINT fixture_reconcile_checkpoint CHECK ("tenantId" <> '${tenantId}' OR action <> 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' OR (changes->>'checked')::integer <> 1)`
      )
      try {
        await expect(f.reconcile()(f.target)).rejects.toThrow()
        expect(
          (
            await inspector.payment.findUniqueOrThrow({
              where: { id: f.payment.id },
            })
          ).status
        ).toBe('PENDING')
        expect(
          (
            await inspector.paymentAttempt.findUniqueOrThrow({
              where: { id: f.attempt.id },
            })
          ).status
        ).toBe('ISSUED')
        expect(
          await inspector.auditLog.count({
            where: { tenantId, action: 'ASAAS_QUEUE_RECONCILIATION_PROGRESS' },
          })
        ).toBe(1)
      } finally {
        await db.query(
          'ALTER TABLE audit_logs DROP CONSTRAINT fixture_reconcile_checkpoint'
        )
      }
    })
    it.each(['ASAAS_ACCOUNT', 'ASAAS_ROOT'] as const)(
      'uses fresh account facts for %s and commits receipt and audit once',
      async (source) => {
        const input = await receipt(
          { accountStatus: { general: 'REJECTED' } },
          source
        )
        const worker = consumer()
        await worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
        await worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
        expect(read).toHaveBeenCalledTimes(1)
        expect(read.mock.calls[0]![0]).toMatchObject({
          account: { id: accountId },
          integration: { id: integrationId, tenantId },
        })
        expect(await current()).toMatchObject({
          status: 'APPROVED',
          generalStatus: 'APPROVED',
          healthIssue: null,
        })
        expect(
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).toMatchObject({
          status: 'PROCESSED',
          processingToken: null,
          lockedUntil: null,
        })
        expect(
          await inspector.platformAuditLog.count({
            where: {
              targetId: accountId,
              action: 'payment-account.health.changed',
            },
          })
        ).toBe(1)
      }
    )
    it.each([
      'WEBHOOK_CREATE_PENDING',
      'WEBHOOK_CREATE_UNKNOWN',
      'WEBHOOK_UPDATE_PENDING',
      'WEBHOOK_UPDATE_UNKNOWN',
      'WEBHOOK_RECONCILIATION_REQUIRED',
    ])(
      'health events cannot clear configuration intent %s, including credential failures',
      async (stage) => {
        await inspector.paymentAccount.update({
          where: { id: accountId },
          data: {
            status: 'RESTRICTED',
            lastErrorCode: stage,
            healthIssue: 'WEBHOOK_MISSING',
          },
        })
        for (const unavailable of [false, true, false]) {
          if (unavailable)
            read.mockRejectedValueOnce(
              new BillingProviderError('REJECTED', {
                reason: 'AUTHENTICATION',
                status: 401,
              })
            )
          await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](
            (await receipt()).message
          )
          expect(await current()).toMatchObject({
            status: 'RESTRICTED',
            lastErrorCode: stage,
          })
        }
        expect(read).toHaveBeenCalledTimes(3)
        expect((await current()).healthIssue).toBe(
          stage === 'WEBHOOK_RECONCILIATION_REQUIRED'
            ? 'WEBHOOK_INTERRUPTED'
            : 'WEBHOOK_MISSING'
        )
      }
    )
    it('owner projection uses the actual scoped business role, hides secrets and refuses revoked ownership', async () => {
      const owner = await inspector.user.create({
        data: { email: tenantId + '@example.test', name: 'Synthetic owner' },
      })
      const membership = await inspector.membership.create({
        data: { tenantId, userId: owner.id, role: 'ADMIN', status: 'ACTIVE' },
      })
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: owner.id },
        })
      )
      const principal = {
        tenantId,
        userId: owner.id,
        membershipId: membership.id,
        role: 'ADMIN' as const,
      }
      const reader = createOwnerPaymentAccountReader({
        withTenantTransaction: (context, operation, options) =>
          withTenantTransaction(business, context, operation, options),
      })
      const stateBefore = await current()
      expect((await reader(principal)).account).toMatchObject({
        kind: 'CONNECTED',
        status: 'UNDER_REVIEW',
        environment: 'sandbox',
      })
      expect(await current()).toEqual(stateBefore)
      await business.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id',${tenantId},true)`
        expect(
          await tx.paymentAccount.findMany({ where: { tenantId } })
        ).toHaveLength(1)
      })
      expect(await business.paymentAccount.findMany()).toEqual([])
      await expect(
        inspector.membership.update({
          where: { id: membership.id },
          data: { status: 'REVOKED' },
        })
      ).rejects.toThrow('OWNER_MEMBERSHIP_REQUIRED')
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: null },
        })
      )
      await inspector.membership.update({
        where: { id: membership.id },
        data: { status: 'REVOKED' },
      })
      await expect(reader(principal)).rejects.toThrow('OWNER_REQUIRED')
      await inspector.membership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE' },
      })
      await scope.withProvisioningTransaction(tenantId, (tx) =>
        tx.organization.update({
          where: { id: tenantId },
          data: { ownerUserId: null },
        })
      )
      await expect(reader(principal)).rejects.toThrow('OWNER_REQUIRED')
      await expect(
        reader({ ...principal, tenantId: 'other-tenant' })
      ).rejects.toThrow('OWNER_REQUIRED')
      const settings = await businessPool.query(
        "SELECT current_setting('app.tenant_id',true) AS tenant, current_setting('app.platform_scope',true) AS scope"
      )
      expect(settings.rows[0].tenant || '').toBe('')
      expect(settings.rows[0].scope || '').toBe('')
    })
    it('annual expiry restricts an already approved account, independently of general approval', async () => {
      await inspector.paymentAccount.update({
        where: { id: accountId },
        data: { status: 'APPROVED', generalStatus: 'APPROVED' },
      })
      read.mockResolvedValue({
        status: null,
        commercialInfoExpired: true,
        commercialInfoExpiresAt: new Date('2026-10-02T03:00:00Z'),
      })
      const input = await receipt({
        event: 'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
      })
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        generalStatus: 'APPROVED',
        commercialInfoExpired: true,
        healthIssue: 'COMMERCIAL_INFO_EXPIRED',
      })
    })
    it('late expiry messages use the regularized provider state and preserve unrelated webhook restrictions', async () => {
      await inspector.paymentAccount.update({
        where: { id: accountId },
        data: {
          status: 'RESTRICTED',
          commercialInfoExpired: true,
          healthIssue: 'WEBHOOK_INTERRUPTED',
        },
      })
      read.mockResolvedValue({
        ...approved,
        commercialInfoExpired: false,
        commercialInfoExpiresAt: new Date('2027-10-03T03:00:00Z'),
      })
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](
        (await receipt({ event: 'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED' }))
          .message
      )
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        commercialInfoExpired: false,
        healthIssue: 'WEBHOOK_INTERRUPTED',
      })
    })
    it.each(['APPROVED', 'AUTHENTICATION', 'EXPIRED'])(
      'a manual/provider provisioning block remains blocked with %s health',
      async (health) => {
        if (health === 'AUTHENTICATION')
          read.mockRejectedValue(
            new BillingProviderError('REJECTED', {
              reason: 'AUTHENTICATION',
              status: 401,
            })
          )
        if (health === 'EXPIRED') {
          await activeKey()
          await inspector.integrationSecret.updateMany({
            where: { integrationId },
            data: { expiresAt: new Date('2026-10-02T00:00:00Z') },
          })
        }
        await inspector.paymentAccount.update({
          where: { id: accountId },
          data: { status: 'BLOCKED' },
        })
        await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](
          (await receipt()).message
        )
        expect((await current()).status).toBe('BLOCKED')
      }
    )
    it('an administrative block added during the provider read discards the old projection', async () => {
      const input = await receipt()
      const worker = consumer()
      read.mockImplementationOnce(async () => {
        const previous = await current()
        await inspector.paymentAccount.update({
          where: { id: accountId },
          data: {
            status: 'BLOCKED',
            updatedAt: new Date(previous.updatedAt.getTime() + 1),
          },
        })
        return approved
      })
      await expect(
        worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      ).rejects.toThrow('ACCOUNT_HEALTH_UNAVAILABLE')
      expect((await current()).status).toBe('BLOCKED')
      await worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect((await current()).status).toBe('BLOCKED')
      expect(
        (
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).status
      ).toBe('PROCESSED')
    })
    it('temporary provider failures retry without changing account or persisting error text', async () => {
      read.mockRejectedValue(new Error('private-api-key-provider-message'))
      const input = await receipt()
      await expect(
        consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      ).rejects.toThrow('ACCOUNT_HEALTH_UNAVAILABLE')
      expect((await current()).status).toBe('UNDER_REVIEW')
      expect(
        await inspector.platformWebhookInbox.findUniqueOrThrow({
          where: { id: input.row.id },
        })
      ).toMatchObject({
        status: 'FAILED',
        lastError: 'ACCOUNT_HEALTH_UNAVAILABLE',
        processingToken: null,
        lockedUntil: null,
      })
      read.mockResolvedValue(approved)
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect((await current()).status).toBe('APPROVED')
    })
    it('a current credential rejected by Asaas produces a durable health restriction', async () => {
      read.mockRejectedValue(
        new BillingProviderError('REJECTED', {
          reason: 'AUTHENTICATION',
          status: 401,
        })
      )
      const input = await receipt()
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'KEY_DISABLED',
      })
      expect(
        (
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).status
      ).toBe('PROCESSED')
    })
    it('other or missing provider key identities cannot disable the active credential', async () => {
      await activeKey()
      for (const accessToken of [{ id: 'old-key' }, {}]) {
        const input = await receipt({
          event: 'ACCESS_TOKEN_DISABLED',
          accessToken,
        })
        await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
        expect(
          (
            await inspector.platformWebhookInbox.findUniqueOrThrow({
              where: { id: input.row.id },
            })
          ).lastError
        ).toBe('KEY_REFERENCE_NOT_FOUND')
      }
      expect(read).not.toHaveBeenCalled()
      expect((await current()).status).toBe('UNDER_REVIEW')
    })
    it('a delayed disabled-key event cannot override a successful current credential check', async () => {
      await activeKey()
      const input = await receipt({
        event: 'ACCESS_TOKEN_DISABLED',
        accessToken: { id: 'current-key', enabled: false },
      })
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect((await current()).status).toBe('APPROVED')
      expect(read).toHaveBeenCalledTimes(1)
    })
    it('key rotation during the read discards stale results and retries using the new binding', async () => {
      await activeKey()
      const input = await receipt()
      read.mockImplementationOnce(async () => {
        await inspector.integrationSecret.updateMany({
          where: { integrationId },
          data: { state: 'PREVIOUS' },
        })
        return approved
      })
      await expect(
        consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      ).rejects.toThrow('ACCOUNT_HEALTH_UNAVAILABLE')
      expect((await current()).status).toBe('UNDER_REVIEW')
    })
    it('an expired active vault credential restricts the account without revealing or using its key', async () => {
      await activeKey()
      await inspector.integrationSecret.updateMany({
        where: { integrationId },
        data: { expiresAt: new Date('2026-10-02T00:00:00Z') },
      })
      const input = await receipt({
        event: 'ACCESS_TOKEN_EXPIRED',
        accessToken: { id: 'current-key' },
      })
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect(read).not.toHaveBeenCalled()
      expect(await current()).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'KEY_EXPIRED',
      })
    })
    it('a contradictory delivery received during the provider read retains its conflict and suppresses the update', async () => {
      const input = await receipt()
      read.mockImplementationOnce(async () => {
        const body = { ...input.body, accountStatus: { general: 'REJECTED' } }
        await receive({
          source: 'ASAAS_ACCOUNT',
          body,
          payloadHash: createHash('sha256')
            .update(JSON.stringify(body))
            .digest('hex'),
          integration: {
            id: integrationId,
            tenantId,
            provider: 'ASAAS',
            externalAccountId: 'acc-' + tenantId,
          },
        })
        return approved
      })
      await consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect((await current()).status).toBe('UNDER_REVIEW')
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
    it('account or tenant mismatches never invoke the credential reader', async () => {
      const input = await receipt({ account: { id: 'other-account' } })
      await expect(
        consumer().handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      ).rejects.toThrow('ACCOUNT_BINDING_CHANGED')
      await expect(
        consumer().handlers[ACCOUNT_WEBHOOK_TOPIC]({
          ...input.message,
          tenantId: 'other',
        })
      ).rejects.toThrow('INVALID_ACCOUNT_MESSAGE')
      expect(read).not.toHaveBeenCalled()
    })
    it('warning notifications are auditable once without blocking the account', async () => {
      const input = await receipt({
        event: 'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
      })
      const worker = consumer()
      await worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      await worker.handlers[ACCOUNT_WEBHOOK_TOPIC](input.message)
      expect((await current()).status).toBe('APPROVED')
      expect(
        await inspector.platformAuditLog.count({
          where: {
            targetId: accountId,
            action: 'payment-account.health.expiring',
          },
        })
      ).toBe(1)
    })
    it('old S5 account jobs are reassigned once while commercial messages remain untouched', async () => {
      const input = await receipt()
      await inspector.platformOutboxEvent.update({
        where: { id: input.message.id },
        data: { topic: 'platform.webhook.process' },
      })
      const rootBody = {
        id: 'unrouted-commercial',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'commercial-payment',
          value: 10,
          subscription: 'unknown',
        },
      }
      await receive({
        source: 'ASAAS_ROOT',
        body: rootBody,
        payloadHash: createHash('sha256')
          .update(JSON.stringify(rootBody))
          .digest('hex'),
      })
      const worker = consumer()
      await worker.enqueue()
      await worker.enqueue()
      expect(
        await inspector.platformOutboxEvent.count({
          where: { aggregateId: input.row.id },
        })
      ).toBe(1)
      expect(
        (
          await inspector.platformOutboxEvent.findUniqueOrThrow({
            where: { id: input.message.id },
          })
        ).topic
      ).toBe(ACCOUNT_WEBHOOK_TOPIC)
      expect(
        (
          await inspector.platformWebhookInbox.findFirstOrThrow({
            where: { eventId: 'id:unrouted-commercial' },
          })
        ).status
      ).toBe('UNROUTED')
    })
    it('failed converted account jobs do not starve the remaining legacy backlog', async () => {
      const inputs = []
      for (let index = 0; index < 21; index++) inputs.push(await receipt())
      const ids = inputs.map((input) => input.message.id)
      await inspector.platformOutboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { topic: 'platform.webhook.process' },
      })
      const worker = consumer()
      await worker.enqueue()
      const converted = await inspector.platformOutboxEvent.findMany({
        where: { id: { in: ids }, topic: ACCOUNT_WEBHOOK_TOPIC },
      })
      expect(converted).toHaveLength(20)
      await inspector.platformWebhookInbox.updateMany({
        where: { id: { in: converted.map((job) => job.aggregateId) } },
        data: { status: 'FAILED' },
      })
      await worker.enqueue()
      await worker.enqueue()
      const jobs = await inspector.platformOutboxEvent.findMany({
        where: { id: { in: ids } },
      })
      expect(jobs).toHaveLength(21)
      expect(jobs.every((job) => job.topic === ACCOUNT_WEBHOOK_TOPIC)).toBe(
        true
      )
      for (const input of inputs)
        expect(jobs.find((job) => job.id === input.message.id)).toMatchObject({
          aggregateId: input.row.id,
          dedupeKey: input.message.dedupeKey,
          payload: { inboxId: input.row.id },
          attempts: 0,
        })
    })
    it('app account reads stay scoped and it cannot mutate health or access the platform inbox', async () => {
      expect(await business.paymentAccount.findMany()).toEqual([])
      await business.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id',${tenantId},true)`
        expect(
          (await tx.paymentAccount.findMany()).map((row) => row.id)
        ).toEqual([accountId])
      })
      await expect(
        business.paymentAccount.update({
          where: { id: accountId },
          data: { status: 'APPROVED' },
        })
      ).rejects.toThrow()
      await expect(business.platformWebhookInbox.findMany()).rejects.toThrow()
    })
    const uncertainFixture = async () => {
      const owner = await inspector.user.create({
        data: {
          email: tenantId + '@example.test',
          name: 'Synthetic receiving owner',
        },
      })
      await inspector.membership.create({
        data: {
          tenantId,
          userId: owner.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
      const document = alphanumericCnpjFor(tenantId)
      await scope.withProvisioningTransaction(tenantId, async (tx) => {
        await tx.organization.update({
          where: { id: tenantId },
          data: {
            ownerUserId: owner.id,
            document,
            documentNormalized: document,
          },
        })
        await tx.tenantIntegration.update({
          where: { id: integrationId },
          data: {
            status: 'PROVISIONING',
            credentialSource: 'VAULT',
            credentialsRef: null,
            externalAccountId: null,
          },
        })
        await tx.paymentAccount.update({
          where: { id: accountId },
          data: {
            mode: 'ASAAS_SUBACCOUNT',
            subaccountModel: 'BAAS',
            status: 'UNKNOWN',
            providerAccountId: null,
            walletId: null,
            provisioningAttempts: 1,
            requestedByUserId: owner.id,
            nextAttemptAt: now,
          },
        })
      })
      return { id: 'acc_' + tenantId, document, walletId: 'wallet_' + tenantId }
    }
    it('uncertain provisioning serializes inspections under the canonical platform role and never approves or reads another tenant', async () => {
      const found = await uncertainFixture()
      let release!: () => void, started!: () => void
      const waiting = new Promise<void>((resolve) => {
        started = resolve
      })
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const lookup = vi.fn(async (document: string) => {
        expect(document).toBe(found.document)
        started()
        await gate
        return found
      })
      const recovery = createUncertainSubaccountRecovery({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        provider: { find: lookup },
        now: () => now,
      })
      expect(await recovery.enqueue()).toBe(1)
      expect(await recovery.enqueue()).toBe(1)
      const events = await inspector.platformOutboxEvent.findMany({
        where: {
          aggregateId: accountId,
          topic: 'payment-accounts.provisioning-recovery',
        },
      })
      expect(events).toHaveLength(1)
      const message = { ...events[0]!, lockedBy: 'worker' }
      const handle = recovery.handlers['payment-accounts.provisioning-recovery']
      await handle({ ...message, tenantId: 'not-the-owner-tenant' })
      expect(lookup).not.toHaveBeenCalled()
      const first = handle(message)
      await waiting
      try {
        await expect(handle(message)).rejects.toThrow('ACCOUNT_BUSY')
      } finally {
        release()
      }
      await first
      expect(lookup).toHaveBeenCalledTimes(1)
      expect(await current()).toMatchObject({
        status: 'KEY_RECOVERY_REQUIRED',
        healthIssue: 'KEY_DISABLED',
        providerAccountId: found.id,
        walletId: found.walletId,
        lockedUntil: null,
        approvedAt: null,
      })
      expect(
        await inspector.tenantIntegration.findUniqueOrThrow({
          where: { id: integrationId },
        })
      ).toMatchObject({
        status: 'PROVISIONING',
        externalAccountId: found.id,
      })
      expect(
        await inspector.integrationSecret.count({ where: { integrationId } })
      ).toBe(0)
      expect(
        await inspector.platformAuditLog.count({
          where: {
            targetId: accountId,
            action: 'payment-account.provisioning.key-recovery-required',
          },
        })
      ).toBe(1)
      await handle(message)
      expect(lookup).toHaveBeenCalledTimes(1)
    })
    it('a failed provisioning audit rolls back the provider binding and recovery status together', async () => {
      const found = await uncertainFixture()
      const recovery = createUncertainSubaccountRecovery({
        transaction: scope.withPlatformTransaction,
        environment: 'sandbox',
        provider: { find: async () => found },
        now: () => now,
      })
      await recovery.enqueue()
      const event = await inspector.platformOutboxEvent.findFirstOrThrow({
        where: { aggregateId: accountId },
      })
      await db.query(
        "ALTER TABLE platform_audit_logs ADD CONSTRAINT wave129_recovery_audit CHECK(action <> 'payment-account.provisioning.key-recovery-required') NOT VALID"
      )
      try {
        await expect(
          recovery.handlers['payment-accounts.provisioning-recovery']({
            ...event,
            lockedBy: 'worker',
          })
        ).rejects.toThrow()
      } finally {
        await db.query(
          'ALTER TABLE platform_audit_logs DROP CONSTRAINT wave129_recovery_audit'
        )
      }
      expect(await current()).toMatchObject({
        status: 'UNKNOWN',
        providerAccountId: null,
        walletId: null,
      })
      expect(
        (
          await inspector.tenantIntegration.findUniqueOrThrow({
            where: { id: integrationId },
          })
        ).externalAccountId
      ).toBeNull()
      expect(
        await inspector.platformAuditLog.count({
          where: { targetId: accountId },
        })
      ).toBe(0)
      // This fixture is intentionally administratively stopped after proving rollback.
      await inspector.paymentAccount.update({
        where: { id: accountId },
        data: { status: 'BLOCKED' },
      })
    })
    it('the same configured runtime and both cron adapters use only the account credential, without root secrets', async () => {
      // Earlier test retries are completed through the injected reader first.
      const worker = consumer()
      read.mockResolvedValue(approved)
      await worker.enqueue()
      const drain = createPlatformJobs({
        scope,
        handlers: worker.handlers,
        workerId: randomUUID,
        limit: 40,
        minRemainingMs: 0,
      })
      // The new matrix adds more receipts than one bounded dispatch page.
      for (let page = 0; page < 5; page++) {
        const result = await drain()
        if (result.completed === 0 && result.failed === 0) break
      }
      const input = await receipt()
      vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
      vi.stubEnv('PLATFORM_ASAAS_ROOT_API_KEY', 'synthetic-root-never-used')
      vi.stubEnv(
        'LOCADORA_INTEGRATION_HEALTH_FIXTURE_SECRET',
        'synthetic-webhook'
      )
      vi.stubEnv(
        'LOCADORA_INTEGRATION_HEALTH_FIXTURE_API_KEY',
        'synthetic-account-credential'
      )
      vi.stubEnv('LOCADORA_INTEGRATION_HEALTH_FIXTURE_ENVIRONMENT', 'sandbox')
      vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'false')
      vi.stubEnv('PLATFORM_ASAAS_EGRESS_PROXY_URL', '')
      vi.stubEnv('PLATFORM_SECRETS_KEK_CURRENT', '')
      vi.stubEnv('PLATFORM_SECRETS_KMS_KEY_ARN', '')
      vi.stubEnv('PLATFORM_SELF_SERVICE_SIGNUP', 'off')
      const fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          expect((init.headers as Record<string, string>).access_token).toBe(
            'synthetic-account-credential'
          )
          return Response.json(approved.status)
        })
      vi.stubGlobal('fetch', fetch)
      configured = true
      expect((await runConfiguredPlatformJobs()).status).toBe(200)
      expect(
        (
          await inspector.platformWebhookInbox.findUniqueOrThrow({
            where: { id: input.row.id },
          })
        ).status
      ).toBe('PROCESSED')
      expect(fetch).toHaveBeenCalledTimes(1)
      vi.stubEnv('CRON_SECRET', 'synthetic-health-cron')
      for (const handler of [legacyCron, apiCron]) {
        await receipt()
        const response = await handler(
          new Request('http://localhost/api/cron/platform', {
            headers: { authorization: 'Bearer synthetic-health-cron' },
          })
        )
        expect(response.status).toBe(200)
      }
      expect(fetch).toHaveBeenCalledTimes(3)
    })
    it('both cron hosts share the installed uncertain recovery and only root GETs, with no key or account creation', async () => {
      const found = await uncertainFixture()
      vi.stubEnv('PLATFORM_DATABASE_URL', platformUrl)
      vi.stubEnv('PLATFORM_ASAAS_ENVIRONMENT', 'sandbox')
      vi.stubEnv('PLATFORM_ASAAS_ROOT_API_KEY', 'synthetic-root-recovery-key')
      vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'false')
      vi.stubEnv('PLATFORM_ASAAS_EGRESS_PROXY_URL', '')
      vi.stubEnv('PLATFORM_SECRETS_KEK_CURRENT', '')
      vi.stubEnv('PLATFORM_SECRETS_KMS_KEY_ARN', '')
      vi.stubEnv('CRON_SECRET', 'synthetic-health-cron')
      const fetch = vi.fn(async (url: string, request: RequestInit) => {
        expect(request.method).toBe('GET')
        expect(request.body).toBeUndefined()
        expect(new Headers(request.headers).get('access_token')).toBe(
          'synthetic-root-recovery-key'
        )
        const point = {
          id: found.id,
          cpfCnpj: found.document,
          walletId: found.walletId,
        }
        if (new URL(url).pathname === '/v3/accounts') {
          expect(new URL(url).searchParams.get('cpfCnpj')).toBe(found.document)
          return Response.json({ data: [point], hasMore: false, totalCount: 1 })
        }
        expect(new URL(url).pathname).toBe('/v3/accounts/' + found.id)
        return Response.json(point)
      })
      vi.stubGlobal('fetch', fetch)
      configured = true
      for (const handle of [legacyCron, apiCron]) {
        const response = await handle(
          new Request('http://localhost/api/cron/platform', {
            headers: { authorization: 'Bearer synthetic-health-cron' },
          })
        )
        expect(response.status).toBe(200)
        expect(await current()).toMatchObject({
          status: 'KEY_RECOVERY_REQUIRED',
          providerAccountId: found.id,
        })
      }
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(
        await inspector.integrationSecret.count({ where: { integrationId } })
      ).toBe(0)
    })
  }
)
