import type { Prisma, Subscription } from '@prisma/client'
import { planejarReativacao } from '@gb-locacoes/domain/assinatura'
import {
  BillingProviderError,
  type AsaasSubscriptionSnapshot,
} from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxHandler,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { matchesRemoteSubscription } from './binding'
import { applySubscriptionInvoice, matchesSubscriptionInvoice } from './invoice'
import { subscriptionFacts } from './facts'
import {
  REACTIVATION_REQUESTED,
  REACTIVATION_READY,
  REACTIVATION_PREDECESSOR,
  reactivationPending,
} from './reactivation-state'
import {
  SUBSCRIPTION_DEACTIVATE_TOPIC,
  SUBSCRIPTION_ISSUE_TOPIC,
} from './topics'

type Previous = Subscription & { planVersion: { amount: Prisma.Decimal } }
type Message = Parameters<OutboxHandler<string | null>>[0]

/** Finish old recurrence/waivers before opening the existing two-phase issuance worker. */
export function createSubscriptionReactivationJob(options: {
  transaction: PlatformTransaction
  environment?: 'sandbox' | 'production'
  provider: {
    snapshot(target: {
      id: string | null
      reference: string
      knownPaymentIds: readonly string[]
    }): Promise<AsaasSubscriptionSnapshot>
  }
  deactivate: OutboxHandler<string | null>
  waive: (sub: Previous, paymentId: string, message: Message) => Promise<void>
  now: () => Date
}): OutboxHandler<string | null> {
  return async (message) => {
    const payload = message.payload as {
      subscriptionId?: unknown
      previousSubscriptionId?: unknown
    } | null
    if (
      !message.tenantId ||
      payload?.subscriptionId !== message.aggregateId ||
      typeof payload.previousSubscriptionId !== 'string'
    )
      throw new Error('INVALID_SUBSCRIPTION_REACTIVATION')
    const previousId = payload.previousSubscriptionId
    const work = await options.transaction(async (tx) => {
      const next = await tx.subscription.findFirstOrThrow({
        where: { id: message.aggregateId, tenantId: message.tenantId! },
      })
      const receipt = await tx.subscriptionEvent.findFirst({
        where: {
          subscriptionId: next.id,
          tenantId: next.tenantId,
          reason: REACTIVATION_REQUESTED,
          source: 'OWNER',
        },
      })
      if (
        !receipt ||
        receipt.planVersionId !== next.planVersionId ||
        next.providerEnvironment !== options.environment
      )
        throw new Error('INVALID_SUBSCRIPTION_REACTIVATION')
      const previous = await tx.subscription.findFirst({
        where: { tenantId: next.tenantId, id: previousId, status: 'CANCELED' },
        include: { planVersion: true, invoices: true },
      })
      const predecessor = await tx.subscriptionEvent.findFirst({
        where: {
          tenantId: next.tenantId,
          subscriptionId: previousId,
          source: 'SYSTEM',
          reason: REACTIVATION_PREDECESSOR,
          dedupeKey: 'reactivation-predecessor:' + next.id,
          planVersionId: receipt.planVersionId,
        },
      })
      if (
        !previous ||
        !predecessor ||
        (previous.providerEnvironment &&
          previous.providerEnvironment !== options.environment)
      )
        throw new Error('INVALID_SUBSCRIPTION_REACTIVATION')
      return { next, receipt, previous }
    })
    if (
      await options.transaction((tx) =>
        tx.subscriptionEvent.findFirst({
          where: { subscriptionId: work.next.id, reason: REACTIVATION_READY },
          select: { id: true },
        })
      )
    )
      return
    if (work.next.providerNextAttemptAt > options.now())
      throw new RetryDeliveryAtError(
        work.next.providerNextAttemptAt,
        'REACTIVATION_PENDING'
      )
    if (
      await options.transaction((tx) =>
        reactivationPending(tx, work.previous.id)
      )
    )
      throw new RetryDeliveryAtError(
        new Date(options.now().getTime() + 300_000),
        'REACTIVATION_PREDECESSOR_PENDING'
      )
    try {
      let previous = work.previous
      const oldMessage: Message = {
        ...message,
        aggregateId: previous.id,
        topic: SUBSCRIPTION_DEACTIVATE_TOPIC,
        payload: { subscriptionId: previous.id },
      }
      if (previous.providerSync === 'PROCESSING')
        throw new Error('REACTIVATION_PREDECESSOR_UNCERTAIN')
      let snapshot: AsaasSubscriptionSnapshot | undefined
      if (
        previous.providerSubscriptionId ||
        previous.providerSync === 'UNKNOWN'
      ) {
        await options.deactivate(oldMessage)
        previous = await options.transaction((tx) =>
          tx.subscription.findUniqueOrThrow({
            where: { id: previousId },
            include: { planVersion: true, invoices: true },
          })
        )
        snapshot = await options.provider.snapshot({
          id: previous.providerSubscriptionId,
          reference: 'sub:' + previous.id,
          knownPaymentIds: previous.invoices.map(
            (row) => row.providerPaymentId
          ),
        })
        if (
          !snapshot.subscription ||
          !matchesRemoteSubscription(previous, snapshot.subscription) ||
          snapshot.subscription.status !== 'INACTIVE'
        )
          throw new Error('REACTIVATION_PREDECESSOR_UNCONFIRMED')
      } else if (
        previous.invoices.some(
          (row) => row.canceledReason === 'REACTIVATION_WAIVER'
        )
      ) {
        throw new Error('REACTIVATION_PREDECESSOR_UNCONFIRMED')
      }
      const invoices = await options.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${previous.tenantId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${previous.id} FOR UPDATE`
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: previous.id },
          include: { planVersion: true, invoices: true },
        })
        if (
          current.status !== 'CANCELED' ||
          current.providerSubscriptionId !== previous.providerSubscriptionId ||
          current.providerCustomerId !== previous.providerCustomerId
        )
          throw new Error('REACTIVATION_PREDECESSOR_CHANGED')
        for (const remote of snapshot?.invoices ?? []) {
          const local = await tx.platformInvoice.findUnique({
            where: { providerPaymentId: remote.id },
          })
          if (
            remote.unknownStatus ||
            !matchesSubscriptionInvoice(current, local, remote)
          )
            throw new Error('REACTIVATION_INVOICE_BINDING')
          await applySubscriptionInvoice(
            tx,
            current,
            local,
            remote,
            options.now(),
            { id: current.id, type: 'Subscription' }
          )
        }
        const refreshed = await tx.subscription.findUniqueOrThrow({
          where: { id: current.id },
          include: { invoices: true },
        })
        const plan = planejarReativacao(
          {
            estado: 'CANCELED',
            invoices: subscriptionFacts(refreshed).invoices,
          },
          work.receipt.occurredAt
        )
        if (!plan.reativavel)
          throw new Error('INVALID_SUBSCRIPTION_REACTIVATION')
        await tx.platformInvoice.updateMany({
          where: {
            subscriptionId: current.id,
            id: { in: [...plan.faturasPerdoadas] },
          },
          data: {
            status: 'CANCELED',
            debtWaivedAt: work.receipt.occurredAt,
            canceledReason: 'REACTIVATION_WAIVER',
          },
        })
        return tx.platformInvoice.findMany({
          where: {
            subscriptionId: current.id,
            canceledReason: 'REACTIVATION_WAIVER',
            debtWaivedAt: { not: null },
            status: { notIn: ['PAID', 'REFUNDED', 'CHARGEBACK'] },
          },
          select: { providerPaymentId: true },
        })
      })
      for (const invoice of invoices)
        await options.waive(previous, invoice.providerPaymentId, oldMessage)
      await options.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${work.next.tenantId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${work.next.id} FOR UPDATE`
        const next = await tx.subscription.findUniqueOrThrow({
          where: { id: work.next.id },
        })
        if (
          next.planVersionId !== work.receipt.planVersionId ||
          next.providerEnvironment !== options.environment ||
          (next.status !== 'CANCELED' &&
            (next.status !== 'INCOMPLETE' ||
              next.providerSubscriptionId ||
              !['NOT_REQUIRED', 'PENDING'].includes(next.providerSync)))
        )
          throw new Error('REACTIVATION_NEW_SUBSCRIPTION_CHANGED')
        const ready = await tx.subscriptionEvent.findFirst({
          where: { subscriptionId: next.id, reason: REACTIVATION_READY },
        })
        if (!ready)
          await tx.subscriptionEvent.create({
            data: {
              tenantId: next.tenantId,
              subscriptionId: next.id,
              fromStatus: next.status,
              toStatus: next.status,
              reason: REACTIVATION_READY,
              source: 'SYSTEM',
              dedupeKey: 'reactivation-ready:' + next.id,
              planVersionId: next.planVersionId,
              occurredAt: options.now(),
            },
          })
        if (next.status === 'CANCELED' || next.cancelAtPeriodEnd) return
        await tx.subscription.update({
          where: { id: next.id },
          data: {
            providerSync: 'PENDING',
            providerLastError: null,
            providerNextAttemptAt: options.now(),
            revision: { increment: 1 },
          },
        })
        await enqueuePlatformOutbox(tx, {
          tenantId: next.tenantId,
          topic: SUBSCRIPTION_ISSUE_TOPIC,
          aggregateId: next.id,
          payload: { subscriptionId: next.id },
          dedupeKey: 'subscription-issue:' + next.id + ':reactivated',
          availableAt: options.now(),
        })
      })
    } catch (error) {
      if (error instanceof RetryDeliveryAtError) throw error
      const delay =
        error instanceof BillingProviderError
          ? Math.min(86_400, Math.max(300, error.retryAfterSeconds ?? 300))
          : 300
      const retryAt = new Date(options.now().getTime() + delay * 1000)
      await options.transaction((tx) =>
        tx.subscription.updateMany({
          where: { id: work.next.id, providerSubscriptionId: null },
          data: {
            providerLastError: 'REACTIVATION_RECONCILIATION_REQUIRED',
            providerNextAttemptAt: retryAt,
          },
        })
      )
      throw new RetryDeliveryAtError(
        retryAt,
        'REACTIVATION_RECONCILIATION_REQUIRED'
      )
    }
  }
}
