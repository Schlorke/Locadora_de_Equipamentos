import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import {
  ACCOUNT_WEBHOOK_EVENTS,
  BillingProviderError,
  type AccountWebhook,
  type AsaasConnectedAccount,
  type AccountReconciliationTarget,
  type createAsaasAccountWebhooks,
} from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxHandler,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import {
  readActiveAsaasKeyIdentity,
  type SecretReference,
  type SecretValue,
} from '../secrets/index'
import { projectAccountHealth } from './health'
import { accountWebhookTarget } from './account-webhook-target'
import {
  readAccountRecoveryIncident,
  RECOVERY_PROGRESS_ACTION,
  RECOVERY_BLOCKED_ACTION,
} from './reconciliation'
import { AccountPaymentReconciliationError } from '../billing/index'
import { z } from 'zod'

const TOPIC = 'payment-accounts.health'
const DAY = 86_400_000,
  RETRY = 300_000
/**
 * A subaccount is configured only after the creation worker sealed its key (ADR SaaS B.7.2): creation states,
 * review blocks and cancelled requests belong to the creation worker, the GET-only inspection or the operator.
 */
const SUBACCOUNT_EXCLUDED = [
  'PROVISIONING',
  'UNKNOWN',
  'KEY_RECOVERY_REQUIRED',
  'BLOCKED',
  'DISCONNECTED',
] as const
const CONNECTED_EXCLUDED = ['BLOCKED', 'DISCONNECTED'] as const
const include = { integration: true, organization: true } as const
type Account = Prisma.PaymentAccountGetPayload<{ include: typeof include }>
type Ref = Omit<SecretReference, 'purpose'>
type Provider = {
  identity(): Promise<AsaasConnectedAccount>
  webhooks: ReturnType<typeof createAsaasAccountWebhooks>
  reconcilePayments?(_target: AccountReconciliationTarget): Promise<unknown>
}
class AccountConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/** Initial configuration and daily inspection share durable leases, key binding and one existing scheduler. */
export function createConnectedAccountConfiguration(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  origin: string
  email: string
  token(ref: Ref, activeKeyId: string): SecretValue
  provider(target: { account: Account; ref: Ref }): Promise<Provider>
  now?: () => Date
}) {
  const origin = new URL(options.origin)
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email) ||
    !['sandbox', 'production'].includes(options.environment)
  )
    throw new Error('ACCOUNT_CONFIGURATION_INVALID')
  const now = options.now ?? (() => new Date())
  const refOf = (account: Account): Ref => ({
    tenantId: account.tenantId,
    integrationId: account.integrationId,
    environment: account.environment,
  })
  function documentOf(account: Account) {
    const document =
      account.organization.documentNormalized ?? account.organization.document
    if (
      !document ||
      !validarCnpj(document) ||
      (account.organization.document &&
        normalizarCnpj(account.organization.document) !==
          normalizarCnpj(document))
    )
      throw new AccountConfigurationError('ACCOUNT_DOCUMENT_MISMATCH')
    return normalizarCnpj(document)
  }
  function eligible(account: Account) {
    const excluded: readonly string[] =
      account.mode === 'ASAAS_CONNECTED_ACCOUNT'
        ? CONNECTED_EXCLUDED
        : account.mode === 'ASAAS_SUBACCOUNT'
          ? SUBACCOUNT_EXCLUDED
          : []
    return (
      excluded.length > 0 &&
      !account.disconnectedAt &&
      !excluded.includes(account.status) &&
      account.environment === options.environment &&
      account.organization.status === 'ACTIVE' &&
      account.organization.access !== 'ARCHIVED' &&
      account.integration.provider === 'ASAAS' &&
      account.integration.credentialSource === 'VAULT' &&
      account.integration.environment === options.environment &&
      ['PROVISIONING', 'ACTIVE'].includes(account.integration.status)
    )
  }
  function needsReconciliation(account: Account) {
    return (
      account.healthIssue === 'WEBHOOK_INTERRUPTED' ||
      account.lastErrorCode === 'WEBHOOK_RECONCILIATION_REQUIRED'
    )
  }
  async function locked<T>(
    id: string,
    tenantId: string,
    operation: (tx: Prisma.TransactionClient, account: Account) => Promise<T>
  ) {
    return options.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
      const first = await tx.paymentAccount.findFirst({
        where: { id, tenantId },
        include,
      })
      if (!first) throw new AccountConfigurationError('ACCOUNT_NOT_FOUND')
      await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${first.integrationId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${id} FOR UPDATE`
      return operation(
        tx,
        await tx.paymentAccount.findUniqueOrThrow({ where: { id }, include })
      )
    })
  }
  function ready(row: AccountWebhook, name: string, url: string) {
    return (
      row.name === name &&
      row.url === url &&
      row.apiVersion === 3 &&
      row.enabled &&
      !row.interrupted &&
      row.sendType === 'SEQUENTIALLY' &&
      ACCOUNT_WEBHOOK_EVENTS.every((event) => row.events.includes(event)) &&
      row.events.every((event) => ACCOUNT_WEBHOOK_EVENTS.includes(event))
    )
  }
  const handler: OutboxHandler<string | null> = async (message) => {
    const id = (message.payload as { accountId?: unknown } | null)?.accountId
    if (
      typeof id !== 'string' ||
      id !== message.aggregateId ||
      !message.tenantId
    )
      throw new Error('INVALID_ACCOUNT_MESSAGE')
    const work = await locked(id, message.tenantId, async (tx, account) => {
      if (!eligible(account) || account.nextAttemptAt > now()) return null
      if (account.lockedUntil && account.lockedUntil > now())
        throw new RetryDeliveryAtError(account.lockedUntil, 'ACCOUNT_BUSY')
      const key = await readActiveAsaasKeyIdentity(tx, refOf(account), {
        lock: true,
      })
      if (!key || (key.expiresAt && key.expiresAt <= now())) {
        await tx.paymentAccount.update({
          where: { id },
          data: {
            status: 'RESTRICTED',
            healthIssue: needsReconciliation(account)
              ? 'WEBHOOK_INTERRUPTED'
              : key
                ? 'KEY_EXPIRED'
                : 'KEY_DISABLED',
            lastErrorCode: needsReconciliation(account)
              ? 'WEBHOOK_RECONCILIATION_REQUIRED'
              : account.lastErrorCode,
            nextAttemptAt: new Date(now().getTime() + DAY),
            lockedUntil: null,
          },
        })
        return null
      }
      const claimed = await tx.paymentAccount.update({
        where: { id },
        data: {
          provisioningAttempts: { increment: 1 },
          lockedUntil: new Date(now().getTime() + RETRY),
        },
        include,
      })
      return {
        account: claimed,
        keyId: key.id,
        previousStage: account.lastErrorCode,
      }
    })
    if (!work) return
    let accountStamp = work.account.updatedAt.getTime(),
      integrationStamp = work.account.integration.updatedAt.getTime()
    // Set once this run's listing proved the webhook it wrote: a later failure no longer leaves its creation uncertain.
    let webhookConfirmed = false
    const check = async (tx: Prisma.TransactionClient, account: Account) => {
      const key = await readActiveAsaasKeyIdentity(tx, refOf(account), {
        lock: true,
      })
      if (
        !eligible(account) ||
        account.updatedAt.getTime() !== accountStamp ||
        account.integration.updatedAt.getTime() !== integrationStamp ||
        key?.id !== work.keyId ||
        (key.expiresAt && key.expiresAt <= now())
      )
        throw new AccountConfigurationError('ACCOUNT_BINDING_CHANGED')
    }
    const fail = async (code: string, issue: string) =>
      locked(id, message.tenantId!, async (tx, account) => {
        // A concurrent block, disconnect, rotation or webhook projection wins.
        try {
          await check(tx, account)
        } catch {
          return
        }
        await tx.paymentAccount.update({
          where: { id },
          data: {
            status: 'RESTRICTED',
            healthIssue:
              needsReconciliation(account) ||
              code === 'WEBHOOK_RECONCILIATION_REQUIRED'
                ? 'WEBHOOK_INTERRUPTED'
                : issue,
            lockedUntil: null,
            lastErrorCode:
              needsReconciliation(account) ||
              code === 'WEBHOOK_RECONCILIATION_REQUIRED'
                ? 'WEBHOOK_RECONCILIATION_REQUIRED'
                : !webhookConfirmed &&
                    [
                      'WEBHOOK_CREATE_PENDING',
                      'WEBHOOK_CREATE_UNKNOWN',
                    ].includes(account.lastErrorCode ?? '')
                  ? 'WEBHOOK_CREATE_UNKNOWN'
                  : code,
            nextAttemptAt: new Date(now().getTime() + RETRY),
          },
        })
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: account.tenantId,
            action: 'payment-account.configuration.pending',
            targetType: 'PaymentAccount',
            targetId: id,
            reasonCategory: code,
          },
        })
      })
    try {
      const ref = refOf(work.account),
        token = options.token(ref, work.keyId)
      const hash = token.use((value) =>
        createHash('sha256').update(value).digest('hex')
      )
      const provider = await options.provider({ account: work.account, ref })
      const facts = await provider.identity()
      const document = documentOf(work.account)
      if (
        !validarCnpj(facts.document) ||
        normalizarCnpj(facts.document) !== document
      )
        throw new AccountConfigurationError('ACCOUNT_DOCUMENT_MISMATCH')
      const { name, url } = accountWebhookTarget(
        origin,
        work.account.integrationId
      )
      const input = { name, url, email: options.email, token }
      const rows = await provider.webhooks.list()
      const matches = rows.filter((row) => row.url === url || row.name === name)
      if (
        matches.length > 1 ||
        matches.some(
          (row) => row.url !== url || row.name !== name || row.apiVersion !== 3
        )
      )
        throw new AccountConfigurationError('WEBHOOK_OWNERSHIP_CONFLICT')
      const current = matches[0]
      const initial = work.account.integration.status === 'PROVISIONING'
      if (
        current?.interrupted ||
        needsReconciliation(work.account) ||
        (!initial && !current)
      ) {
        if (provider.reconcilePayments) {
          const incident = await locked(
            id,
            message.tenantId!,
            async (tx, account) => {
              await check(tx, account)
              let started = await readAccountRecoveryIncident(
                tx,
                account.tenantId,
                id
              )
              if (!started)
                started = await tx.platformAuditLog.create({
                  data: {
                    actorKind: 'SYSTEM',
                    tenantId: account.tenantId,
                    action: 'payment-account.reconciliation.started',
                    targetType: 'PaymentAccount',
                    targetId: id,
                    reasonCategory: 'WEBHOOK_RECONCILIATION_REQUIRED',
                  },
                })
              const updated = await tx.paymentAccount.update({
                where: { id },
                data: {
                  status: 'RESTRICTED',
                  healthIssue: 'WEBHOOK_INTERRUPTED',
                  lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
                },
              })
              accountStamp = updated.updatedAt.getTime()
              return started.id
            }
          )
          const checkIncident = async (
            tx: Prisma.TransactionClient,
            account: Account
          ) => {
            await check(tx, account)
            if (
              (await readAccountRecoveryIncident(tx, account.tenantId, id))
                ?.id !== incident
            )
              throw new AccountConfigurationError(
                'RECONCILIATION_INCIDENT_CHANGED'
              )
          }
          // Financial proof uses the business role. It is not proof that the delivery endpoint has been repaired.
          try {
            const result = z
              .strictObject({
                complete: z.boolean(),
                checked: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
              })
              .parse(
                await provider.reconcilePayments({
                  ...ref,
                  accountId: id,
                  keyId: work.keyId,
                  incidentId: incident,
                  environment: options.environment,
                })
              )
            await locked(id, message.tenantId!, async (tx, account) => {
              await checkIncident(tx, account)
              await tx.platformAuditLog.create({
                data: {
                  actorKind: 'SYSTEM',
                  tenantId: account.tenantId,
                  targetType: 'PaymentAccount',
                  targetId: id,
                  action: RECOVERY_PROGRESS_ACTION,
                  metadata: {
                    incidentId: incident,
                    keyId: work.keyId,
                    ...result,
                  },
                },
              })
            })
          } catch (error) {
            await locked(id, message.tenantId!, async (tx, account) => {
              await checkIncident(tx, account)
              await tx.platformAuditLog.create({
                data: {
                  actorKind: 'SYSTEM',
                  tenantId: account.tenantId,
                  targetType: 'PaymentAccount',
                  targetId: id,
                  action: RECOVERY_BLOCKED_ACTION,
                  reasonCategory:
                    error instanceof AccountPaymentReconciliationError
                      ? error.code
                      : error instanceof z.ZodError
                        ? 'RECONCILIATION_CHECKPOINT_INVALID'
                        : 'RECONCILIATION_PROVIDER_UNAVAILABLE',
                  metadata: { incidentId: incident, keyId: work.keyId },
                },
              })
            })
            throw error
          }
        }
        throw new AccountConfigurationError('WEBHOOK_RECONCILIATION_REQUIRED')
      }
      if (
        !current &&
        (work.previousStage === 'WEBHOOK_CREATE_PENDING' ||
          work.previousStage === 'WEBHOOK_CREATE_UNKNOWN')
      )
        throw new AccountConfigurationError('WEBHOOK_CREATE_UNKNOWN')
      if (!current && rows.length >= 10)
        throw new AccountConfigurationError('WEBHOOK_LIMIT_REACHED')
      // GET never proves the remote token. Reassert the same recoverable token with PUT on each daily inspection.
      if (!initial && !current)
        throw new AccountConfigurationError('WEBHOOK_RECONCILIATION_REQUIRED')
      {
        await locked(id, message.tenantId!, async (tx, account) => {
          await check(tx, account)
          if (documentOf(account) !== document)
            throw new AccountConfigurationError('COMPANY_DATA_CHANGED')
          const integration = await tx.tenantIntegration.update({
            where: { id: account.integrationId },
            data: {
              webhookTokenHash: hash,
              ...(account.integration.webhookTokenHash &&
              account.integration.webhookTokenHash !== hash
                ? {
                    webhookTokenPreviousHash:
                      account.integration.webhookTokenHash,
                    webhookTokenPreviousUntil: new Date(now().getTime() + DAY),
                  }
                : {}),
            },
          })
          const updated = await tx.paymentAccount.update({
            where: { id },
            data: {
              status: 'RESTRICTED',
              lastErrorCode: current
                ? 'WEBHOOK_UPDATE_PENDING'
                : 'WEBHOOK_CREATE_PENDING',
            },
          })
          integrationStamp = integration.updatedAt.getTime()
          accountStamp = updated.updatedAt.getTime()
        })
        let result: AccountWebhook
        try {
          result = current
            ? await provider.webhooks.configure(current.id, input)
            : await provider.webhooks.create(input)
        } catch {
          // Even a definite rejection leaves the creation intent conservative; no POST is repeated after a lost response.
          throw new AccountConfigurationError(
            current ? 'WEBHOOK_UPDATE_UNKNOWN' : 'WEBHOOK_CREATE_UNKNOWN'
          )
        }
        if (!ready(result, name, url))
          throw new AccountConfigurationError(
            current ? 'WEBHOOK_UPDATE_UNKNOWN' : 'WEBHOOK_CREATE_UNKNOWN'
          )
        const confirmed = (await provider.webhooks.list()).filter(
          (row) => row.url === url || row.name === name
        )
        if (
          confirmed.length !== 1 ||
          confirmed[0]!.id !== result.id ||
          !ready(confirmed[0]!, name, url)
        )
          throw new AccountConfigurationError(
            current ? 'WEBHOOK_UPDATE_UNKNOWN' : 'WEBHOOK_CREATE_UNKNOWN'
          )
        webhookConfirmed = true
      }
      await locked(id, message.tenantId!, async (tx, account) => {
        await check(tx, account)
        if (documentOf(account) !== document)
          throw new AccountConfigurationError('COMPANY_DATA_CHANGED')
        const data = projectAccountHealth(
          {
            ...account,
            healthIssue: ['WEBHOOK_MISSING'].includes(account.healthIssue ?? '')
              ? null
              : account.healthIssue,
          },
          {
            status: facts.status,
            commercialInfoExpired: null,
            commercialInfoExpiresAt: null,
          }
        )
        const fullyApproved = data.status === 'APPROVED'
        await tx.paymentAccount.update({
          where: { id },
          data: {
            ...data,
            lockedUntil: null,
            lastErrorCode: null,
            nextAttemptAt: new Date(now().getTime() + DAY),
            lastSyncedAt: now(),
            lastKeyUseAt: now(),
            ...(fullyApproved && !account.approvedAt
              ? { approvedAt: now() }
              : {}),
          },
        })
        // A subaccount integration becomes ACTIVE only on its first full approval (ADR SaaS B.7.2) and is never
        // demoted here; until then no new charge can select it. The connected account keeps its current rule.
        if (
          account.mode === 'ASAAS_CONNECTED_ACCOUNT' ||
          (fullyApproved && account.integration.status !== 'ACTIVE')
        )
          await tx.tenantIntegration.update({
            where: { id: account.integrationId },
            data: { status: 'ACTIVE' },
          })
        // The first full approval verifies the CNPJ (ADR SaaS, ownership of the CNPJ). The verification carries the
        // normalized CNPJ, which a legacy registration lacks (CHECK organizations_document_verified). A CNPJ another
        // company verified first stays unverified here and goes to review once (unique organizations_verified_document);
        // either violation would undo the whole confirmation on every inspection.
        if (fullyApproved && !account.organization.documentVerifiedAt) {
          const verifiedElsewhere = await tx.organization.findFirst({
            where: {
              documentVerifiedAt: { not: null },
              documentNormalized: document,
            },
            select: { id: true },
          })
          if (!verifiedElsewhere)
            await tx.organization.update({
              where: { id: account.tenantId },
              data: {
                documentVerifiedAt: now(),
                documentNormalized: document,
              },
            })
          else if (!account.approvedAt)
            await tx.platformAuditLog.create({
              data: {
                actorKind: 'SYSTEM',
                tenantId: account.tenantId,
                action: 'payment-account.document.in-use',
                targetType: 'PaymentAccount',
                targetId: id,
                reasonCategory: 'DOCUMENT_IN_USE',
              },
            })
        }
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: account.tenantId,
            action: 'payment-account.configuration.confirmed',
            targetType: 'PaymentAccount',
            targetId: id,
            reasonCategory: data.status,
          },
        })
      })
    } catch (error) {
      const code =
        error instanceof AccountConfigurationError
          ? error.code
          : error instanceof BillingProviderError &&
              error.reason === 'AUTHENTICATION'
            ? 'ACCOUNT_KEY_REJECTED'
            : 'ACCOUNT_CONFIGURATION_UNAVAILABLE'
      const issue =
        code === 'ACCOUNT_KEY_REJECTED'
          ? 'KEY_DISABLED'
          : code === 'WEBHOOK_RECONCILIATION_REQUIRED'
            ? 'WEBHOOK_INTERRUPTED'
            : 'WEBHOOK_MISSING'
      await fail(code, issue)
      throw new RetryDeliveryAtError(new Date(now().getTime() + RETRY), code)
    }
  }
  return {
    handlers: { [TOPIC]: handler },
    enqueue: () =>
      options.transaction(async (tx) => {
        const accounts = await tx.paymentAccount.findMany({
          where: {
            OR: [
              {
                mode: 'ASAAS_CONNECTED_ACCOUNT',
                status: { notIn: [...CONNECTED_EXCLUDED] },
              },
              {
                mode: 'ASAAS_SUBACCOUNT',
                status: { notIn: [...SUBACCOUNT_EXCLUDED] },
              },
            ],
            environment: options.environment,
            disconnectedAt: null,
            nextAttemptAt: { lte: now() },
            AND: [
              { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now() } }] },
            ],
            organization: { status: 'ACTIVE', access: { not: 'ARCHIVED' } },
            integration: {
              provider: 'ASAAS',
              credentialSource: 'VAULT',
              environment: options.environment,
              status: { in: ['PROVISIONING', 'ACTIVE'] },
            },
          },
          orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
          take: 20,
        })
        for (const account of accounts)
          await enqueuePlatformOutbox(tx, {
            tenantId: account.tenantId,
            topic: TOPIC,
            aggregateId: account.id,
            payload: { accountId: account.id },
            dedupeKey:
              'account-health:' +
              account.id +
              ':' +
              account.nextAttemptAt.toISOString(),
          })
        return accounts.length
      }),
  }
}
