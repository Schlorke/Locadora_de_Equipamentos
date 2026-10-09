import { enqueuePlatformOutbox } from '../outbox/index'
import {
  createOwnerCommand,
  OwnerSubscriptionCommandError,
  type OwnerCommandPorts,
} from './owner-command'
import { issuanceInclude, readIssuanceProfile } from './issuance-profile'
import { SUBSCRIPTION_ISSUE_TOPIC } from './topics'

/** A receipt requests durable issuance; neither HTTP success nor recurrence creation confirms payment. */
export function createOwnerSubscriptionActivation(
  ports: OwnerCommandPorts & { environment?: 'sandbox' | 'production' }
) {
  return createOwnerCommand(
    ports,
    'ACTIVATION_REQUESTED',
    async (tx, locked, now) => {
      const sub = await tx.subscription.findUniqueOrThrow({
        where: { id: locked.id },
        include: issuanceInclude,
      })
      if (sub.cancelAtPeriodEnd || sub.billingMode !== 'ASAAS')
        throw new OwnerSubscriptionCommandError(
          409,
          'SUBSCRIPTION_NOT_ACTIVATABLE'
        )
      if (sub.providerSubscriptionId) return
      if (
        !['INCOMPLETE', 'TRIALING'].includes(sub.status) ||
        sub.providerSync === 'FAILED'
      )
        throw new OwnerSubscriptionCommandError(
          409,
          'SUBSCRIPTION_NOT_ACTIVATABLE'
        )
      if (!ports.environment)
        throw new Error('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
      if (
        sub.providerEnvironment &&
        sub.providerEnvironment !== ports.environment
      )
        throw new OwnerSubscriptionCommandError(
          409,
          'PROVIDER_ENVIRONMENT_CONFLICT'
        )
      await readIssuanceProfile(tx, sub, now)
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerEnvironment: ports.environment,
          ...(sub.providerSync === 'NOT_REQUIRED'
            ? { providerSync: 'PENDING', providerNextAttemptAt: now }
            : {}),
          revision: { increment: 1 },
        },
      })
      await enqueuePlatformOutbox(tx, {
        tenantId: sub.tenantId,
        topic: SUBSCRIPTION_ISSUE_TOPIC,
        aggregateId: sub.id,
        payload: { subscriptionId: sub.id },
        dedupeKey:
          'subscription-issue:' +
          sub.id +
          ':' +
          Math.floor(now.getTime() / 300_000),
        availableAt:
          sub.providerNextAttemptAt > now && sub.providerSync !== 'NOT_REQUIRED'
            ? sub.providerNextAttemptAt
            : now,
      })
    }
  )
}
