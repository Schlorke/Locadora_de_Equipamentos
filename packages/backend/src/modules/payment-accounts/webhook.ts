import { randomUUID } from 'node:crypto'
import {
  BillingProviderError,
  parseAsaasEvent,
  isKnownAsaasEvent,
  type AsaasAccountHealth,
} from '../billing/index'
import { isInboundIntegrationStatus } from '../identity/index'
import type { OutboxHandler } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { readActiveAsaasKeyIdentity } from '../secrets/index'
import { projectAccountHealth, type AccountHealthReader } from './health'

export const ACCOUNT_WEBHOOK_TOPIC = 'payment-accounts.webhook'
const SUBACCOUNT_CREATION_STATES: readonly string[] = [
  'PROVISIONING',
  'UNKNOWN',
  'KEY_RECOVERY_REQUIRED',
]

/** Receipt and account change commit together; the provider call holds no SQL transaction open. */
export function createAccountWebhookConsumer(options: {
  transaction: PlatformTransaction
  read: AccountHealthReader
  now?: () => Date
  token?: () => string
}) {
  const now = options.now ?? (() => new Date())
  const handler: OutboxHandler<string | null> = async (message) => {
    const id = (message.payload as { inboxId?: unknown } | null)?.inboxId
    if (typeof id !== 'string' || id !== message.aggregateId)
      throw new Error('INVALID_ACCOUNT_MESSAGE')
    const token = (options.token ?? randomUUID)()
    const work = await options.transaction(async (tx) => {
      const receipt = await tx.platformWebhookInbox.findUniqueOrThrow({
        where: { id },
      })
      if (receipt.tenantId !== message.tenantId)
        throw new Error('INVALID_ACCOUNT_MESSAGE')
      if (
        ['PROCESSED', 'IGNORED', 'CONFLICT', 'UNROUTED'].includes(
          receipt.status
        )
      )
        return null
      const parsed = parseAsaasEvent(receipt.payload)
      if (
        !parsed.ok ||
        !isKnownAsaasEvent(parsed.event.type) ||
        !['ACCOUNT_STATUS', 'ACCESS_TOKEN'].includes(parsed.event.category)
      )
        throw new Error('INVALID_ACCOUNT_EVENT')
      const account = await tx.paymentAccount.findFirst({
        where: {
          integrationId: receipt.routeKey ?? '',
          tenantId: receipt.tenantId ?? '',
          disconnectedAt: null,
        },
        include: { integration: true },
      })
      if (!account || account.status === 'DISCONNECTED') {
        const changed = await tx.platformWebhookInbox.updateMany({
          where: { id, status: { in: ['RECEIVED', 'FAILED'] } },
          data: {
            status: 'UNROUTED',
            lastError: 'ACCOUNT_NOT_FOUND',
            processingToken: null,
            lockedUntil: null,
          },
        })
        if (changed.count)
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'payment-account.webhook.unrouted',
              tenantId: receipt.tenantId,
              targetType: 'PlatformWebhookInbox',
              targetId: id,
              reasonCategory: 'ACCOUNT_NOT_FOUND',
            },
          })
        return null
      }
      // A subaccount still being created has no projection to update: the creation worker and the GET-only
      // inspection own these states, and the health GET is the source of truth afterwards (no deferral).
      if (
        account.mode === 'ASAAS_SUBACCOUNT' &&
        SUBACCOUNT_CREATION_STATES.includes(account.status)
      ) {
        const changed = await tx.platformWebhookInbox.updateMany({
          where: { id, status: { in: ['RECEIVED', 'FAILED'] } },
          data: {
            status: 'IGNORED',
            processedAt: now(),
            lastError: 'ACCOUNT_PROVISIONING',
            processingToken: null,
            lockedUntil: null,
          },
        })
        if (changed.count)
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'payment-account.webhook.ignored',
              tenantId: account.tenantId,
              targetType: 'PlatformWebhookInbox',
              targetId: id,
              reasonCategory: 'ACCOUNT_PROVISIONING',
            },
          })
        return null
      }
      if (
        account.integration.provider !== 'ASAAS' ||
        account.environment !== account.integration.environment ||
        !isInboundIntegrationStatus(account.integration.status) ||
        (parsed.event.account &&
          parsed.event.account.id !== account.providerAccountId)
      )
        throw new Error('ACCOUNT_BINDING_CHANGED')
      const activeKey =
        account.integration.credentialSource === 'VAULT'
          ? await readActiveAsaasKeyIdentity(tx, {
              integrationId: account.integrationId,
              tenantId: account.tenantId,
              environment: account.environment,
            })
          : null
      if (parsed.event.category === 'ACCESS_TOKEN') {
        const keyId = parsed.event.accessToken?.id
        if (!keyId || activeKey?.providerCredentialId !== keyId) {
          const changed = await tx.platformWebhookInbox.updateMany({
            where: { id, status: { in: ['RECEIVED', 'FAILED'] } },
            data: {
              status: 'IGNORED',
              processedAt: now(),
              lastError: 'KEY_REFERENCE_NOT_FOUND',
              processingToken: null,
              lockedUntil: null,
            },
          })
          if (changed.count)
            await tx.platformAuditLog.create({
              data: {
                actorKind: 'SYSTEM',
                action: 'payment-account.key.uncorrelated',
                tenantId: account.tenantId,
                targetType: 'PlatformWebhookInbox',
                targetId: id,
                reasonCategory: 'KEY_REFERENCE_NOT_FOUND',
              },
            })
          return null
        }
      }
      const claimed = await tx.platformWebhookInbox.updateMany({
        where: {
          id,
          status: { in: ['RECEIVED', 'FAILED'] },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now() } }],
        },
        data: {
          processingToken: token,
          lockedUntil: new Date(now().getTime() + 120_000),
          attempts: { increment: 1 },
        },
      })
      if (!claimed.count) throw new Error('ACCOUNT_RECEIPT_BUSY')
      return {
        account,
        integration: account.integration,
        activeKeyId: activeKey?.id ?? null,
        activeKeyExpiresAt: activeKey?.expiresAt ?? null,
        eventType: parsed.event.type,
      }
    })
    if (!work) return
    try {
      let facts: AsaasAccountHealth | undefined
      let unavailable: string | null =
        work.activeKeyExpiresAt && work.activeKeyExpiresAt <= now()
          ? 'KEY_EXPIRED'
          : null
      try {
        if (!unavailable) facts = await options.read(work)
      } catch (error) {
        if (
          !(error instanceof BillingProviderError) ||
          error.reason !== 'AUTHENTICATION'
        )
          throw error
        unavailable = 'KEY_DISABLED'
      }
      await options.transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`account-health:${work.account.id}`},0))`
        const receipt = await tx.platformWebhookInbox.findFirst({
          where: {
            id,
            processingToken: token,
            status: { in: ['RECEIVED', 'FAILED'] },
          },
        })
        if (!receipt) return
        // Match credential-import lock order; a concurrent disconnect/block or
        // integration change must not land between the recheck and the update.
        await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${work.integration.id} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${work.account.id} FOR UPDATE`
        const current = await tx.paymentAccount.findUniqueOrThrow({
          where: { id: work.account.id },
          include: { integration: true },
        })
        const activeKey =
          current.integration.credentialSource === 'VAULT'
            ? await readActiveAsaasKeyIdentity(
                tx,
                {
                  integrationId: current.integrationId,
                  tenantId: current.tenantId,
                  environment: current.environment,
                },
                { lock: true }
              )
            : null
        if (
          current.updatedAt.getTime() !== work.account.updatedAt.getTime() ||
          current.integration.updatedAt.getTime() !==
            work.integration.updatedAt.getTime() ||
          (activeKey?.id ?? null) !== work.activeKeyId ||
          current.disconnectedAt ||
          current.status === 'DISCONNECTED'
        )
          throw new Error('ACCOUNT_BINDING_CHANGED')
        const data = unavailable
          ? {
              status:
                current.status === 'BLOCKED'
                  ? ('BLOCKED' as const)
                  : ('RESTRICTED' as const),
              healthIssue: unavailable,
            }
          : projectAccountHealth(current, facts!)
        // An approval seen here never activates a subaccount integration: the health worker confirms it now.
        const confirmApproval =
          current.mode === 'ASAAS_SUBACCOUNT' &&
          current.integration.status !== 'ACTIVE' &&
          data.status === 'APPROVED'
        // A health notification proves provider facts, never completion of a
        // webhook write or financial reconciliation owned by configuration.
        const configurationStage =
          current.healthIssue === 'WEBHOOK_INTERRUPTED'
            ? 'WEBHOOK_RECONCILIATION_REQUIRED'
            : current.lastErrorCode
        const configurationPending = [
          'WEBHOOK_CREATE_PENDING',
          'WEBHOOK_CREATE_UNKNOWN',
          'WEBHOOK_UPDATE_PENDING',
          'WEBHOOK_UPDATE_UNKNOWN',
          'WEBHOOK_RECONCILIATION_REQUIRED',
        ].includes(configurationStage ?? '')
        if (configurationPending && data.status !== 'BLOCKED') {
          data.status = 'RESTRICTED'
          data.healthIssue ??=
            configurationStage === 'WEBHOOK_RECONCILIATION_REQUIRED'
              ? 'WEBHOOK_INTERRUPTED'
              : 'WEBHOOK_MISSING'
        }
        // Lock/CAS the receipt before changing the account. A concurrent conflict wins
        // either before this CAS or after this transaction; it is never overwritten.
        const completed = await tx.platformWebhookInbox.updateMany({
          where: {
            id,
            processingToken: token,
            status: { in: ['RECEIVED', 'FAILED'] },
          },
          data: {
            status: 'PROCESSED',
            processedAt: now(),
            processingToken: null,
            lockedUntil: null,
            lastError: null,
          },
        })
        if (!completed.count) return
        await tx.paymentAccount.update({
          where: { id: current.id },
          data: {
            ...data,
            lastSyncedAt: now(),
            ...(facts ? { lastKeyUseAt: now() } : {}),
            lastErrorCode: configurationPending ? configurationStage : null,
            ...(confirmApproval ? { nextAttemptAt: now() } : {}),
          },
        })
        if (
          data.status !== current.status ||
          data.healthIssue !== current.healthIssue
        )
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'payment-account.health.changed',
              tenantId: current.tenantId,
              targetType: 'PaymentAccount',
              targetId: current.id,
              reasonCategory: data.healthIssue ?? data.status,
            },
          })
        if (work.eventType.endsWith('_EXPIRING_SOON'))
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'payment-account.health.expiring',
              tenantId: current.tenantId,
              targetType: 'PaymentAccount',
              targetId: current.id,
              reasonCategory: work.eventType,
            },
          })
      })
    } catch {
      await options.transaction((tx) =>
        tx.platformWebhookInbox.updateMany({
          where: {
            id,
            processingToken: token,
            status: { in: ['RECEIVED', 'FAILED'] },
          },
          data: {
            status: 'FAILED',
            processingToken: null,
            lockedUntil: null,
            lastError: 'ACCOUNT_HEALTH_UNAVAILABLE',
          },
        })
      )
      throw new Error('ACCOUNT_HEALTH_UNAVAILABLE')
    }
  }
  return {
    handlers: { [ACCOUNT_WEBHOOK_TOPIC]: handler },
    // Existing account receipts queued by S5 are picked up without claiming commercial topics.
    enqueue: () =>
      options.transaction(async (tx) => {
        // Select only unconverted legacy jobs. Retried/terminal account jobs must
        // not occupy the first page forever and starve the remaining S5 backlog.
        const jobs = await tx.$queryRaw<{ id: string }[]>`
          SELECT o.id FROM platform_outbox_events o
          JOIN platform_webhook_inbox i ON i.id=o."aggregateId"
          WHERE o.topic='platform.webhook.process' AND o.status='PENDING' AND o."lockedBy" IS NULL
            AND i.status IN ('RECEIVED','FAILED') AND i."routeKey" IS NOT NULL AND i."tenantId" IS NOT NULL
            AND (left(i."eventType",15)='ACCOUNT_STATUS_' OR left(i."eventType",13)='ACCESS_TOKEN_')
          ORDER BY i."receivedAt",i.id LIMIT 20 FOR UPDATE OF o SKIP LOCKED
        `
        for (const job of jobs) {
          await tx.platformOutboxEvent.updateMany({
            where: {
              id: job.id,
              topic: 'platform.webhook.process',
              status: 'PENDING',
              lockedBy: null,
            },
            data: { topic: ACCOUNT_WEBHOOK_TOPIC },
          })
        }
      }),
  }
}
