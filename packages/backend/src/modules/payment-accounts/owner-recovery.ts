import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { AccountRecoveryResponseSchema } from '@gb-locacoes/contracts/payment-account'
import { isFreshAuthentication, type TenantPrincipal } from '../identity/index'
import type { PlatformScope } from '../platform-scope/index'
import { readActiveAsaasKeyIdentity } from '../secrets/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import {
  readAccountRecoveryIncident,
  RECOVERY_PROGRESS_ACTION,
  RECOVERY_BLOCKED_ACTION,
} from './reconciliation'

export class OwnerAccountRecoveryError extends Error {
  constructor(
    readonly status: 401 | 403 | 409,
    readonly code: string
  ) {
    super(code)
  }
}
const progressSchema = z.strictObject({
  incidentId: z.string().min(1),
  keyId: z.string().min(1),
  checked: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  complete: z.boolean(),
})
type Transaction = PlatformScope['withProvisioningTransaction']

/** Only platform metadata is read. No business payment, credential value or provider payload enters this projection. */
export function createOwnerAccountRecovery(ports: {
  readTransaction: Transaction
  transaction: Transaction
  environment: 'sandbox' | 'production'
  now?: () => Date
}) {
  const now = ports.now ?? (() => new Date())
  async function context(
    tx: Prisma.TransactionClient,
    actor: TenantPrincipal,
    write: boolean
  ) {
    if (write)
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${actor.tenantId} FOR UPDATE`
    const member = await tx.membership.findFirst({
      where: {
        id: actor.membershipId,
        tenantId: actor.tenantId,
        userId: actor.userId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: {
        organization: {
          select: { ownerUserId: true, status: true, access: true },
        },
      },
    })
    if (
      actor.role !== 'ADMIN' ||
      member?.organization.ownerUserId !== actor.userId ||
      member.organization.status !== 'ACTIVE'
    )
      throw new OwnerAccountRecoveryError(403, 'OWNER_REQUIRED')
    if (member.organization.access === 'ARCHIVED')
      throw new OwnerAccountRecoveryError(403, 'TENANT_ARCHIVED')
    let account = await tx.paymentAccount.findFirst({
      where: { tenantId: actor.tenantId, disconnectedAt: null },
      include: { integration: true },
    })
    if (
      !account ||
      account.mode !== 'ASAAS_CONNECTED_ACCOUNT' ||
      account.environment !== ports.environment ||
      !(
        account.healthIssue === 'WEBHOOK_INTERRUPTED' ||
        account.lastErrorCode === 'WEBHOOK_RECONCILIATION_REQUIRED'
      )
    )
      return null
    if (write) {
      await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${account.integrationId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_accounts WHERE id=${account.id} FOR UPDATE`
      account = await tx.paymentAccount.findFirst({
        where: {
          id: account.id,
          tenantId: actor.tenantId,
          disconnectedAt: null,
        },
        include: { integration: true },
      })
      if (
        !account ||
        account.mode !== 'ASAAS_CONNECTED_ACCOUNT' ||
        account.environment !== ports.environment ||
        !(
          account.healthIssue === 'WEBHOOK_INTERRUPTED' ||
          account.lastErrorCode === 'WEBHOOK_RECONCILIATION_REQUIRED'
        )
      )
        return null
    }
    const key = await readActiveAsaasKeyIdentity(
      tx,
      {
        tenantId: actor.tenantId,
        integrationId: account.integrationId,
        environment: account.environment,
      },
      { lock: write }
    )
    const eligible =
      account.status === 'RESTRICTED' &&
      account.integration.provider === 'ASAAS' &&
      account.integration.credentialSource === 'VAULT' &&
      account.integration.environment === ports.environment &&
      ['ACTIVE', 'PROVISIONING'].includes(account.integration.status) &&
      key !== null &&
      (!key.expiresAt || key.expiresAt > now())
    const incident = await readAccountRecoveryIncident(
      tx,
      actor.tenantId,
      account.id
    )
    // Queue claims must not race with replacement of a completed snapshot.
    if (write)
      await tx.$queryRaw`SELECT id FROM platform_outbox_events
        WHERE "tenantId"=${actor.tenantId} AND topic='payment-accounts.health'
          AND "aggregateId"=${account.id} AND status IN ('PENDING','PROCESSING')
        FOR UPDATE`
    const pending = await tx.platformOutboxEvent.findFirst({
      where: {
        tenantId: actor.tenantId,
        topic: 'payment-accounts.health',
        aggregateId: account.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, status: true },
    })
    const receipt =
      key && incident
        ? await tx.platformAuditLog.findFirst({
            where: {
              tenantId: actor.tenantId,
              targetId: account.id,
              targetType: 'PaymentAccount',
              action: {
                in: [RECOVERY_PROGRESS_ACTION, RECOVERY_BLOCKED_ACTION],
              },
              AND: [
                { metadata: { path: ['incidentId'], equals: incident.id } },
                { metadata: { path: ['keyId'], equals: key.id } },
              ],
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              action: true,
              metadata: true,
              createdAt: true,
              reasonCategory: true,
            },
          })
        : null
    const progress =
      receipt?.action === RECOVERY_PROGRESS_ACTION
        ? progressSchema.safeParse(receipt.metadata)
        : null
    const review =
      receipt?.action === RECOVERY_BLOCKED_ACTION &&
      receipt.reasonCategory !== 'RECONCILIATION_PROVIDER_UNAVAILABLE'
    const leased = Boolean(account.lockedUntil && account.lockedUntil > now())
    const busy = Boolean(pending || leased)
    const completed = progress?.success && progress.data.complete
    const refreshable = Boolean(
      completed && !leased && pending?.status !== 'PROCESSING'
    )
    return {
      account,
      key,
      incident,
      eligible,
      busy,
      review,
      progress,
      receipt,
      pending,
      refreshable,
    }
  }
  return {
    read(actor: TenantPrincipal) {
      return ports.readTransaction(actor.tenantId, async (tx) => {
        const c = await context(tx, actor, false)
        if (!c) return { recovery: null }
        const valid = c.progress?.success ? c.progress.data : null
        return AccountRecoveryResponseSchema.parse({
          recovery: {
            state: !c.eligible
              ? 'ACCESS_REQUIRED'
              : c.review || (c.progress && !c.progress.success)
                ? 'REVIEW_REQUIRED'
                : valid?.complete
                  ? 'SNAPSHOT_COMPLETE'
                  : valid
                    ? 'CHECKING'
                    : 'WAITING',
            checked: valid?.checked ?? 0,
            lastCheckedAt: valid ? c.receipt!.createdAt.toISOString() : null,
            requestPending: c.busy,
            canRequest:
              c.eligible &&
              !c.review &&
              !(c.progress && !c.progress.success) &&
              (!c.busy || c.refreshable),
          },
        })
      })
    },
    request(actor: TenantPrincipal, authenticatedAt: number) {
      return ports.transaction(actor.tenantId, async (tx) => {
        if (!isFreshAuthentication(authenticatedAt, now()))
          throw new OwnerAccountRecoveryError(401, 'FRESH_SESSION_REQUIRED')
        const c = await context(tx, actor, true)
        if (
          !c ||
          !c.eligible ||
          c.review ||
          (c.progress && !c.progress.success)
        )
          throw new OwnerAccountRecoveryError(409, 'RECOVERY_REVIEW_REQUIRED')
        if (c.busy && !c.refreshable) return { accepted: true as const }
        // Old completion covers the old cutoff only. A new owner-confirmed incident
        // keeps the previous history and starts a fresh financial snapshot.
        const incident = c.refreshable
          ? await tx.platformAuditLog.create({
              data: {
                actorKind: 'OWNER',
                actorUserId: actor.userId,
                tenantId: actor.tenantId,
                action: 'payment-account.reconciliation.started',
                targetType: 'PaymentAccount',
                targetId: c.account.id,
                reasonCategory: 'OWNER_RECHECK_REQUESTED',
                createdAt: new Date(
                  Math.max(now().getTime(), c.incident!.createdAt.getTime() + 1)
                ),
                metadata: {
                  keyId: c.key!.id,
                  previousIncidentId: c.incident!.id,
                },
              },
            })
          : c.incident
        // Preserve provider backoff and leases. Requests never unlock or approve an account.
        const at =
          c.account.nextAttemptAt > now() ? c.account.nextAttemptAt : now()
        const event =
          c.pending ??
          (await enqueuePlatformOutbox(tx, {
            tenantId: actor.tenantId,
            topic: 'payment-accounts.health',
            aggregateId: c.account.id,
            payload: { accountId: c.account.id },
            availableAt: at,
            // The locked current job supplies retry idempotency. A completed intent must not swallow a later explicit request.
            dedupeKey: `account-recovery:${c.account.id}:${c.key!.id}:${randomUUID()}`,
          }))
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'OWNER',
            actorUserId: actor.userId,
            tenantId: actor.tenantId,
            action: 'payment-account.reconciliation.requested',
            targetType: 'PaymentAccount',
            targetId: c.account.id,
            metadata: {
              eventId: event.id,
              ...(incident ? { incidentId: incident.id } : {}),
            },
          },
        })
        return { accepted: true as const }
      })
    },
  }
}
