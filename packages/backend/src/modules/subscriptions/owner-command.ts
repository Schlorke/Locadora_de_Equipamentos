import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { OwnerSubscriptionCommandKeySchema } from '@gb-locacoes/contracts/subscription'
import { isFreshAuthentication, type TenantPrincipal } from '../identity/index'
import type { PlatformScope } from '../platform-scope/index'

export class OwnerSubscriptionCommandError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    readonly code: string
  ) {
    super(code)
  }
}
export type OwnerCommandPorts = {
  transaction: PlatformScope['withProvisioningTransaction']
  now?: () => Date
}
type LockedSubscription = Prisma.SubscriptionGetPayload<{
  include: { invoices: true; planVersion: true }
}>
type OwnerInput = { key: string; authenticatedAt: number }
type Receipt = {
  subscriptionId: string
  planVersionId: string
  fromStatus: LockedSubscription['status'] | null
  toStatus: LockedSubscription['status']
}

/** All owner commands share current ownership, lock order, freshness and immutable replay receipts. */
export function createOwnerCommand<Input extends OwnerInput = OwnerInput>(
  ports: OwnerCommandPorts,
  reason: string,
  apply: (
    tx: Prisma.TransactionClient,
    sub: LockedSubscription,
    now: Date,
    key: string,
    input: Input
  ) => Promise<void | Receipt>,
  options?: {
    canceled?: boolean
    selectedPlan?: (input: Input) => string
  }
) {
  return async (principal: TenantPrincipal, input: Input) => {
    if (!OwnerSubscriptionCommandKeySchema.safeParse(input.key).success)
      throw new OwnerSubscriptionCommandError(400, 'INVALID_IDEMPOTENCY_KEY')
    const key =
      'owner:' +
      createHash('sha256')
        .update(
          JSON.stringify([principal.tenantId, principal.userId, input.key])
        )
        .digest('hex')
    const clock = ports.now ?? (() => new Date())
    return ports.transaction(principal.tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${principal.tenantId} FOR UPDATE`
      const membership = await tx.membership.findFirst({
        where: {
          id: principal.membershipId,
          tenantId: principal.tenantId,
          userId: principal.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: {
          organization: { select: { status: true, ownerUserId: true } },
        },
      })
      if (
        principal.role !== 'ADMIN' ||
        membership?.organization.status !== 'ACTIVE' ||
        membership.organization.ownerUserId !== principal.userId
      )
        throw new OwnerSubscriptionCommandError(403, 'OWNER_REQUIRED')
      if (!isFreshAuthentication(input.authenticatedAt, clock()))
        throw new OwnerSubscriptionCommandError(401, 'FRESH_SESSION_REQUIRED')
      const previous = await tx.subscriptionEvent.findFirst({
        where: {
          tenantId: principal.tenantId,
          actorUserId: principal.userId,
          dedupeKey: key,
        },
      })
      if (previous) {
        if (
          previous.reason !== reason ||
          (options?.selectedPlan &&
            previous.planVersionId !== options.selectedPlan(input))
        )
          throw new OwnerSubscriptionCommandError(409, 'IDEMPOTENCY_KEY_REUSED')
        return { accepted: true as const }
      }
      if (
        options?.canceled &&
        (await tx.subscription.findFirst({
          where: { tenantId: principal.tenantId, status: { not: 'CANCELED' } },
          select: { id: true },
        }))
      )
        throw new OwnerSubscriptionCommandError(
          409,
          'SUBSCRIPTION_NOT_REACTIVATABLE'
        )
      const status = options?.canceled
        ? ('CANCELED' as const)
        : { not: 'CANCELED' as const }
      const candidate = await tx.subscription.findFirst({
        where: { tenantId: principal.tenantId, status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      })
      if (!candidate)
        throw new OwnerSubscriptionCommandError(404, 'SUBSCRIPTION_NOT_FOUND')
      await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${candidate.id} FOR UPDATE`
      const sub = await tx.subscription.findFirst({
        where: {
          id: candidate.id,
          tenantId: principal.tenantId,
          status,
        },
        include: { invoices: true, planVersion: true },
      })
      if (!sub)
        throw new OwnerSubscriptionCommandError(404, 'SUBSCRIPTION_NOT_FOUND')
      const lockedAt = clock()
      if (!isFreshAuthentication(input.authenticatedAt, lockedAt))
        throw new OwnerSubscriptionCommandError(401, 'FRESH_SESSION_REQUIRED')
      const receipt = await apply(tx, sub, lockedAt, key, input)
      await tx.subscriptionEvent.create({
        data: {
          tenantId: principal.tenantId,
          subscriptionId: receipt?.subscriptionId ?? sub.id,
          fromStatus: receipt ? receipt.fromStatus : sub.status,
          toStatus: receipt?.toStatus ?? sub.status,
          reason,
          source: 'OWNER',
          dedupeKey: key,
          actorUserId: principal.userId,
          planVersionId: receipt?.planVersionId ?? sub.planVersionId,
          occurredAt: lockedAt,
        },
      })
      return { accepted: true as const }
    })
  }
}
