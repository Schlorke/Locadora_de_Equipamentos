import { ReactivateSubscriptionInputSchema } from '@gb-locacoes/contracts/subscription'
import { planejarReativacao } from '@gb-locacoes/domain/assinatura'
import { enqueuePlatformOutbox } from '../outbox/index'
import {
  createOwnerCommand,
  OwnerSubscriptionCommandError,
  type OwnerCommandPorts,
} from './owner-command'
import { subscriptionFacts } from './facts'
import { issuanceInclude, readIssuanceProfile } from './issuance-profile'
import { publicOfferWhere } from './offers'
import { SUBSCRIPTION_REACTIVATE_TOPIC } from './topics'
import {
  REACTIVATION_PREDECESSOR,
  REACTIVATION_REQUESTED,
} from './reactivation-state'

/** CANCELED history remains terminal. Cleanup must finish before the new recurrence is issued. */
export function createOwnerSubscriptionReactivation(
  ports: OwnerCommandPorts & { environment?: 'sandbox' | 'production' }
) {
  return createOwnerCommand<{
    key: string
    authenticatedAt: number
    planVersionId: string
  }>(
    ports,
    REACTIVATION_REQUESTED,
    async (tx, previous, now, key, input) => {
      if (
        !ReactivateSubscriptionInputSchema.safeParse({
          planVersionId: input.planVersionId,
        }).success
      )
        throw new OwnerSubscriptionCommandError(400, 'INVALID_PLAN_SELECTION')
      if (!ports.environment)
        throw new Error('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
      if (
        previous.providerEnvironment &&
        previous.providerEnvironment !== ports.environment
      )
        throw new OwnerSubscriptionCommandError(
          409,
          'PROVIDER_ENVIRONMENT_CONFLICT'
        )
      const offer = await tx.planVersion.findFirst({
        where: {
          ...publicOfferWhere(now),
          id: input.planVersionId,
          interval: 'MONTHLY',
        },
      })
      if (!offer)
        throw new OwnerSubscriptionCommandError(409, 'PLAN_NOT_AVAILABLE')
      const plan = planejarReativacao(
        {
          estado: previous.status,
          invoices: subscriptionFacts(previous).invoices,
        },
        now
      )
      if (!plan.reativavel)
        throw new OwnerSubscriptionCommandError(
          409,
          'SUBSCRIPTION_NOT_REACTIVATABLE'
        )
      const next = await tx.subscription.create({
        data: {
          tenantId: previous.tenantId,
          planVersionId: offer.id,
          status: plan.estadoInicial,
          billingMode: 'ASAAS',
          billingEmail: previous.billingEmail,
          providerEnvironment: ports.environment,
          providerSync: 'NOT_REQUIRED',
          providerNextAttemptAt: now,
          createdAt: now,
        },
        include: issuanceInclude,
      })
      await readIssuanceProfile(tx, next, now)
      await tx.subscriptionEvent.create({
        data: {
          tenantId: previous.tenantId,
          subscriptionId: previous.id,
          fromStatus: 'CANCELED',
          toStatus: 'CANCELED',
          source: 'SYSTEM',
          reason: REACTIVATION_PREDECESSOR,
          dedupeKey: 'reactivation-predecessor:' + next.id,
          planVersionId: next.planVersionId,
          occurredAt: now,
        },
      })
      await tx.platformInvoice.updateMany({
        where: {
          tenantId: previous.tenantId,
          subscriptionId: previous.id,
          id: { in: [...plan.faturasPerdoadas] },
        },
        data: {
          status: 'CANCELED',
          canceledReason: 'REACTIVATION_WAIVER',
          debtWaivedAt: now,
        },
      })
      await tx.organization.update({
        where: { id: previous.tenantId },
        data: { access: 'SETUP' },
      })
      await enqueuePlatformOutbox(tx, {
        tenantId: previous.tenantId,
        topic: SUBSCRIPTION_REACTIVATE_TOPIC,
        aggregateId: next.id,
        payload: {
          subscriptionId: next.id,
          previousSubscriptionId: previous.id,
        },
        dedupeKey: 'subscription-reactivate:' + next.id + ':' + key,
        availableAt: now,
      })
      return {
        subscriptionId: next.id,
        planVersionId: next.planVersionId,
        fromStatus: null,
        toStatus: next.status,
      }
    },
    { canceled: true, selectedPlan: (input) => input.planVersionId }
  )
}
