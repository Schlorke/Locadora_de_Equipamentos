import type { Prisma } from '@prisma/client'
import {
  derivarEstado,
  transicaoPermitida,
} from '@gb-locacoes/domain/assinatura'
import { enqueuePlatformOutbox } from '../outbox/index'
import { SUBSCRIPTION_DEACTIVATE_TOPIC } from './topics'
import { subscriptionCurrentPeriod, subscriptionFacts } from './facts'

const column = (date: string | null) =>
  date ? new Date(date + 'T00:00:00Z') : null

/** Caller holds the subscription/organization locks and owns the receipt transaction. */
export async function recomputeSubscription(
  tx: Prisma.TransactionClient,
  id: string,
  receiptId: string,
  now: Date,
  source: 'WEBHOOK' | 'JOB' | 'OWNER' = 'WEBHOOK'
) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id },
    include: { invoices: true, planVersion: true },
  })
  // Historical subscriptions never overwrite the projection of a later active subscription.
  if (sub.status === 'CANCELED') return
  const { paidCycles, currentEnd, currentStart } =
    subscriptionCurrentPeriod(sub)
  const state = derivarEstado(subscriptionFacts(sub, currentEnd), now, {
    graceDays: sub.planVersion.graceDays,
    suspendDays: sub.planVersion.suspendDays,
    incompleteDays: sub.planVersion.incompleteDays,
  })
  const status = state.encerramentoDevido ? 'CANCELED' : state.estado
  if (!transicaoPermitida(sub.status, status)) {
    await tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        tenantId: sub.tenantId,
        action: 'subscription.transition.rejected',
        targetType: 'Subscription',
        targetId: id,
        reasonCategory: 'STATE_TRANSITION_REJECTED',
      },
    })
    return
  }
  await tx.subscription.update({
    where: { id },
    data: {
      status,
      revision: { increment: 1 },
      reconciledAt: now,
      currentPeriodStart: currentStart,
      currentPeriodEnd: currentEnd,
      pastDueSince: column(state.divida?.desde ?? null),
      graceEndsAt: column(state.divida?.toleranciaAte ?? null),
      suspendedAt: status === 'SUSPENDED' ? (sub.suspendedAt ?? now) : null,
      ...(state.encerramentoDevido
        ? { canceledAt: now, cancelReason: state.encerramentoDevido }
        : {}),
    },
  })
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: sub.tenantId },
  })
  await tx.organization.update({
    where: { id: org.id },
    data: {
      access: status === 'CANCELED' ? 'ARCHIVED' : state.acesso,
      siteIndexable:
        status === 'CANCELED'
          ? false
          : org.siteIndexable || paidCycles.length > 0,
    },
  })
  if (status !== sub.status) {
    const event = await tx.subscriptionEvent.create({
      data: {
        tenantId: sub.tenantId,
        subscriptionId: id,
        fromStatus: sub.status,
        toStatus: status,
        reason: state.encerramentoDevido ?? state.regra,
        source,
        dedupeKey:
          (source === 'OWNER'
            ? 'owner:'
            : source === 'JOB'
              ? 'job:'
              : 'asaas:') + receiptId,
        planVersionId: sub.planVersionId,
        occurredAt: now,
      },
    })
    await enqueuePlatformOutbox(tx, {
      tenantId: sub.tenantId,
      topic: 'subscriptions.notify',
      aggregateId: id,
      payload: { subscriptionEventId: event.id },
      dedupeKey: 'subscription-notice:' + event.id,
    })
  }
  if (
    state.encerramentoDevido &&
    sub.billingMode === 'ASAAS' &&
    (sub.providerSubscriptionId || sub.providerSync === 'UNKNOWN')
  )
    await enqueuePlatformOutbox(tx, {
      tenantId: sub.tenantId,
      topic: SUBSCRIPTION_DEACTIVATE_TOPIC,
      aggregateId: id,
      payload: { subscriptionId: id },
      dedupeKey: 'subscription-deactivate:' + id,
    })
}
