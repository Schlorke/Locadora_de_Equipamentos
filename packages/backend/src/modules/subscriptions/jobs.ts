import type { Prisma, Subscription } from '@prisma/client'
import {
  diaCivilDeColunaDate,
  diaCivilEmSaoPaulo,
} from '@gb-locacoes/domain/assinatura'
import {
  BillingProviderError,
  parseAsaasEvent,
  isKnownAsaasEvent,
  type AsaasPlatformInvoice,
  type AsaasPlatformSubscription,
  type AsaasSubscriptionSnapshot,
} from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxHandler,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { applySubscriptionInvoice, matchesSubscriptionInvoice } from './invoice'
import { recomputeSubscription } from './projection'
import {
  subscriptionHintMatches,
  matchesRemoteSubscription as binding,
} from './binding'
import { createSubscriptionReactivationJob } from './reactivation'
import {
  SUBSCRIPTION_RECONCILE_TOPIC,
  SUBSCRIPTION_DEACTIVATE_TOPIC,
  SUBSCRIPTION_REACTIVATE_TOPIC,
} from './topics'

type SubscriptionProvider = {
  snapshot: (_target: {
    id: string | null
    reference: string
    knownPaymentIds: readonly string[]
  }) => Promise<AsaasSubscriptionSnapshot>
  subscription: (_id: string) => Promise<AsaasPlatformSubscription>
  inactive: (_id: string) => Promise<void>
  invoice: (_id: string) => Promise<AsaasPlatformInvoice>
  cancelInvoice: (_id: string) => Promise<void>
}
type Current = Subscription & { planVersion: { amount: Prisma.Decimal } }

export function createSubscriptionJobs(options: {
  transaction: PlatformTransaction
  environment?: 'sandbox' | 'production'
  provider?: SubscriptionProvider
  now?: () => Date
}) {
  const now = options.now ?? (() => new Date())
  const lock = async (tx: Prisma.TransactionClient, sub: Subscription) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id=${sub.tenantId} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id} FOR UPDATE`
  }
  const audit = (
    tx: Prisma.TransactionClient,
    sub: Subscription,
    code: string
  ) =>
    tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        tenantId: sub.tenantId,
        action: 'subscription.provider.reconciliation',
        targetType: 'Subscription',
        targetId: sub.id,
        reasonCategory: code,
      },
    })
  const sourceAllows = async (
    tx: Prisma.TransactionClient,
    sub: Subscription,
    message: Parameters<OutboxHandler<string | null>>[0],
    locked = false
  ) => {
    const source = (message.payload as { sourceInboxId?: unknown } | null)
      ?.sourceInboxId
    if (source === undefined) return true
    if (typeof source !== 'string')
      throw new Error('INVALID_SUBSCRIPTION_SOURCE')
    if (locked)
      await tx.$queryRaw`SELECT id FROM platform_webhook_inbox WHERE id=${source} FOR UPDATE`
    const receipt = await tx.platformWebhookInbox.findUnique({
      where: { id: source },
    })
    if (
      !receipt ||
      receipt.source !== 'ASAAS_ROOT' ||
      receipt.tenantId !== sub.tenantId ||
      (receipt.sourceEnvironment !== null &&
        receipt.sourceEnvironment !== options.environment)
    )
      throw new Error('INVALID_SUBSCRIPTION_SOURCE')
    if (receipt.status !== 'PROCESSED') return false
    const parsed = parseAsaasEvent(receipt.payload)
    return (
      parsed.ok &&
      parsed.event.category === 'SUBSCRIPTION' &&
      isKnownAsaasEvent(parsed.event.type) &&
      subscriptionHintMatches(sub, parsed.event.subscription)
    )
  }
  const load = (message: Parameters<OutboxHandler<string | null>>[0]) =>
    options.transaction(async (tx) => {
      const id = (message.payload as { subscriptionId?: unknown } | null)
        ?.subscriptionId
      if (typeof id !== 'string' || id !== message.aggregateId)
        throw new Error('INVALID_SUBSCRIPTION_JOB')
      const sub = await tx.subscription.findUniqueOrThrow({
        where: { id },
        include: { planVersion: true },
      })
      if (sub.tenantId !== message.tenantId)
        throw new Error('INVALID_SUBSCRIPTION_JOB')
      if (!(await sourceAllows(tx, sub, message))) return null
      return sub
    })
  const fail = async (sub: Subscription, error: unknown): Promise<never> => {
    // No provider descriptions, keys or URLs in durable errors; next job respects a provider backoff.
    const delay =
      error instanceof BillingProviderError && error.reason === 'RATE_LIMITED'
        ? Math.min(86_400, Math.max(300, error.retryAfterSeconds ?? 300))
        : 300
    const retryAt = new Date(now().getTime() + delay * 1000)
    await options.transaction((tx) =>
      tx.subscription.updateMany({
        where: { id: sub.id },
        data: {
          providerLastError: 'SUBSCRIPTION_PROVIDER_UNAVAILABLE',
          providerNextAttemptAt: retryAt,
        },
      })
    )
    throw new RetryDeliveryAtError(retryAt, 'SUBSCRIPTION_PROVIDER_UNAVAILABLE')
  }
  const reconcile: OutboxHandler<string | null> = async (message) => {
    const sub = await load(message)
    if (!sub) return
    if (sub.status === 'CANCELED') return
    if (sub.providerNextAttemptAt > now())
      throw new RetryDeliveryAtError(
        sub.providerNextAttemptAt,
        'SUBSCRIPTION_PROVIDER_BACKOFF'
      )
    try {
      let snapshot: AsaasSubscriptionSnapshot | undefined
      if (
        sub.billingMode === 'ASAAS' &&
        (sub.providerSubscriptionId || sub.providerSync === 'UNKNOWN')
      ) {
        if (
          !options.provider ||
          sub.providerEnvironment !== options.environment
        )
          throw new Error('SUBSCRIPTION_PROVIDER_UNAVAILABLE')
        const ids = await options.transaction((tx) =>
          tx.platformInvoice.findMany({
            where: { subscriptionId: sub.id },
            select: { providerPaymentId: true },
          })
        )
        snapshot = await options.provider.snapshot({
          id: sub.providerSubscriptionId,
          reference: 'sub:' + sub.id,
          knownPaymentIds: ids.map((i) => i.providerPaymentId),
        })
      }
      await options.transaction(async (tx) => {
        await lock(tx, sub)
        let current = await tx.subscription.findUniqueOrThrow({
          where: { id: sub.id },
          include: { planVersion: true },
        })
        if (current.status === 'CANCELED') return
        if (!(await sourceAllows(tx, current, message, true))) return
        if (current.updatedAt.getTime() !== sub.updatedAt.getTime())
          throw new Error('SUBSCRIPTION_BINDING_CHANGED')
        if (snapshot) {
          const remote = snapshot.subscription
          if (!remote) {
            // UNKNOWN creation never retries a POST or assumes the operation did not happen.
            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                providerNextAttemptAt: new Date(now().getTime() + 300_000),
                providerLastError: 'SUBSCRIPTION_UNKNOWN_NOT_FOUND',
              },
            })
            await audit(tx, sub, 'SUBSCRIPTION_UNKNOWN_NOT_FOUND')
            return
          }
          if (!binding(current, remote) || remote.status !== 'ACTIVE') {
            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                reconciledAt: now(),
                providerLastError: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
              },
            })
            await audit(tx, sub, 'SUBSCRIPTION_RECONCILIATION_REQUIRED')
            return
          }
          if (
            !(await sourceAllows(
              tx,
              { ...current, providerSubscriptionId: remote.id },
              message,
              true
            ))
          ) {
            await audit(tx, sub, 'SUBSCRIPTION_EVENT_BINDING_MISMATCH')
            return
          }
          if (!current.providerSubscriptionId)
            current = await tx.subscription.update({
              where: { id: current.id },
              data: {
                providerSubscriptionId: remote.id,
                providerSync: 'SYNCED',
              },
              include: { planVersion: true },
            })
          // Validate all bindings before applying any invoice: one bad item never commits a partial projection.
          const records = []
          for (const invoice of snapshot.invoices) {
            const local = await tx.platformInvoice.findUnique({
              where: { providerPaymentId: invoice.id },
            })
            if (!matchesSubscriptionInvoice(current, local, invoice)) {
              throw new Error('SUBSCRIPTION_INVOICE_BINDING_MISMATCH')
            }
            records.push({ local, invoice })
          }
          for (const item of records)
            await applySubscriptionInvoice(
              tx,
              current,
              item.local,
              item.invoice,
              now(),
              { id: message.id, type: 'PlatformOutboxEvent' }
            )
        }
        await recomputeSubscription(tx, sub.id, message.id, now(), 'JOB')
        await tx.subscription.update({
          where: { id: sub.id },
          data: { providerLastError: null },
        })
      })
    } catch (error) {
      await fail(sub, error)
    }
  }

  const deactivate: OutboxHandler<string | null> = async (message) => {
    const initial = await load(message)
    if (!initial) return
    let sub: Current = initial
    if (
      sub.status !== 'CANCELED' ||
      sub.billingMode !== 'ASAAS' ||
      sub.providerEnvironment !== options.environment ||
      (!sub.providerSubscriptionId && sub.providerSync !== 'UNKNOWN') ||
      !options.provider
    )
      throw new Error('INVALID_SUBSCRIPTION_DEACTIVATION')
    if (sub.providerNextAttemptAt > now())
      throw new RetryDeliveryAtError(
        sub.providerNextAttemptAt,
        'SUBSCRIPTION_PROVIDER_BACKOFF'
      )
    const provider = options.provider
    try {
      if (!sub.providerSubscriptionId) {
        const original = sub
        const snapshot = await provider.snapshot({
          id: null,
          reference: 'sub:' + sub.id,
          knownPaymentIds: [],
        })
        const found = snapshot.subscription
        if (!found || !binding(sub, found))
          throw new Error('SUBSCRIPTION_UNKNOWN_NOT_FOUND')
        sub = await options.transaction(async (tx) => {
          await lock(tx, original)
          const current = await tx.subscription.findUniqueOrThrow({
            where: { id: original.id },
            include: { planVersion: true },
          })
          if (
            current.updatedAt.getTime() !== original.updatedAt.getTime() ||
            current.status !== 'CANCELED' ||
            !(await sourceAllows(
              tx,
              { ...current, providerSubscriptionId: found.id },
              message,
              true
            ))
          )
            throw new Error('SUBSCRIPTION_BINDING_CHANGED')
          return tx.subscription.update({
            where: { id: current.id },
            data: { providerSubscriptionId: found.id, providerSync: 'SYNCED' },
            include: { planVersion: true },
          })
        })
      }
      const providerId = sub.providerSubscriptionId
      if (!providerId) throw new Error('SUBSCRIPTION_UNKNOWN_NOT_FOUND')
      let remote = await provider.subscription(providerId)
      if (!binding(sub, remote))
        throw new Error('SUBSCRIPTION_BINDING_MISMATCH')
      if (remote.status !== 'INACTIVE') {
        try {
          await provider.inactive(remote.id)
        } catch (error) {
          if (error instanceof BillingProviderError && !error.maybeApplied)
            throw error
          // A timeout may have applied INACTIVE. Only the read can confirm it.
        }
        remote = await provider.subscription(remote.id)
      }
      if (!binding(sub, remote) || remote.status !== 'INACTIVE')
        throw new Error('SUBSCRIPTION_DEACTIVATION_UNCONFIRMED')
      const ownerCancel = sub.cancelReason === 'OWNER_REQUEST'
      const cutoff = sub.currentPeriodEnd
        ? diaCivilDeColunaDate(sub.currentPeriodEnd)
        : diaCivilEmSaoPaulo(now())
      if (ownerCancel) {
        const snapshot = await provider.snapshot({
          id: remote.id,
          reference: 'sub:' + sub.id,
          knownPaymentIds: [],
        })
        if (
          !snapshot.subscription ||
          !binding(sub, snapshot.subscription) ||
          snapshot.subscription.status !== 'INACTIVE'
        )
          throw new Error('SUBSCRIPTION_BINDING_MISMATCH')
        for (const candidate of snapshot.invoices) {
          if (
            candidate.dueDate < cutoff ||
            !['PENDING', 'OVERDUE', 'CANCELED'].includes(candidate.status)
          )
            continue
          await cancelFuture(sub, candidate.id, cutoff, message)
        }
        // A deleted or unknown attempt can disappear from listing; reconcile its original ID explicitly.
        const uncertain = await options.transaction((tx) =>
          tx.platformInvoice.findMany({
            where: {
              subscriptionId: sub.id,
              providerCancelState: { in: ['PROCESSING', 'UNKNOWN'] },
              OR: [
                { canceledReason: null },
                { canceledReason: { not: 'REACTIVATION_WAIVER' } },
              ],
            },
            select: { providerPaymentId: true },
          })
        )
        for (const item of uncertain)
          await cancelFuture(sub, item.providerPaymentId, cutoff, message)
      }
      await options.transaction(async (tx) => {
        await lock(tx, sub)
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: sub.id },
        })
        if (!(await sourceAllows(tx, current, message, true)))
          throw new Error('SUBSCRIPTION_SOURCE_CHANGED')
        if (
          current.status !== 'CANCELED' ||
          current.providerSubscriptionId !== sub.providerSubscriptionId
        )
          throw new Error('SUBSCRIPTION_BINDING_CHANGED')
        await tx.subscription.update({
          where: { id: sub.id },
          data: { reconciledAt: now(), providerLastError: null },
        })
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: sub.tenantId,
            action: 'subscription.provider.deactivated',
            targetType: 'Subscription',
            targetId: sub.id,
            reasonCategory: 'PROVIDER_CONFIRMED_INACTIVE',
          },
        })
      })
    } catch (error) {
      await fail(sub, error)
    }
  }

  async function cancelFuture(
    sub: Current,
    id: string,
    cutoff: string,
    message: Parameters<OutboxHandler<string | null>>[0],
    waiver = false
  ) {
    const provider = options.provider!
    let remote = await provider.invoice(id)
    const intent = await options.transaction(async (tx) => {
      await lock(tx, sub)
      const current = await tx.subscription.findUniqueOrThrow({
        where: { id: sub.id },
        include: { planVersion: true },
      })
      if (!(await sourceAllows(tx, current, message, true)))
        throw new Error('SUBSCRIPTION_SOURCE_CHANGED')
      const local = await tx.platformInvoice.findUnique({
        where: { providerPaymentId: id },
      })
      if (!waiver && local?.canceledReason === 'REACTIVATION_WAIVER')
        return null
      if (
        current.status !== 'CANCELED' ||
        !matchesSubscriptionInvoice(current, local, remote) ||
        (waiver
          ? !local?.debtWaivedAt ||
            local.canceledReason !== 'REACTIVATION_WAIVER'
          : remote.dueDate < cutoff)
      )
        throw new Error('SUBSCRIPTION_CANCELLATION_BINDING_MISMATCH')
      const invoice = await applySubscriptionInvoice(
        tx,
        current,
        local,
        remote,
        now(),
        { id: sub.id, type: 'Subscription' }
      )
      if (remote.status === 'PAID' || invoice.status === 'PAID') {
        await audit(tx, sub, 'PAID_AFTER_SUBSCRIPTION_CANCEL')
        return null
      }
      if (invoice.status === 'REFUNDED' || invoice.status === 'CHARGEBACK')
        if (waiver) return null
        else
          throw new Error('SUBSCRIPTION_CANCELLATION_RECONCILIATION_REQUIRED')
      if (remote.status === 'CANCELED') {
        await tx.platformInvoice.update({
          where: { id: invoice.id },
          data: {
            providerCancelState: 'CONFIRMED',
            canceledReason: waiver
              ? 'REACTIVATION_WAIVER'
              : 'FUTURE_AFTER_CANCEL',
          },
        })
        return null
      }
      if (
        remote.unknownStatus ||
        !['PENDING', 'OVERDUE'].includes(remote.status)
      )
        throw new Error('SUBSCRIPTION_CANCELLATION_RECONCILIATION_REQUIRED')
      if (
        invoice.providerCancelState === 'PROCESSING' ||
        invoice.providerCancelState === 'UNKNOWN'
      )
        throw new Error('SUBSCRIPTION_CANCELLATION_UNKNOWN')
      if (invoice.providerCancelState === 'CONFIRMED')
        throw new Error('SUBSCRIPTION_CANCELLATION_RESTORED')
      await tx.platformInvoice.update({
        where: { id: invoice.id },
        data: { providerCancelState: 'PROCESSING' },
      })
      return invoice.id
    })
    if (!intent) return
    try {
      await provider.cancelInvoice(id)
    } catch (error) {
      await options.transaction((tx) =>
        tx.platformInvoice.update({
          where: { id: intent },
          data: {
            providerCancelState:
              error instanceof BillingProviderError && !error.maybeApplied
                ? 'NONE'
                : 'UNKNOWN',
          },
        })
      )
      throw error
    }
    remote = await provider.invoice(id) // 404 here does not prove cancellation.
    await options.transaction(async (tx) => {
      await lock(tx, sub)
      const current = await tx.subscription.findUniqueOrThrow({
        where: { id: sub.id },
        include: { planVersion: true },
      })
      const local = await tx.platformInvoice.findUniqueOrThrow({
        where: { id: intent },
      })
      if (!(await sourceAllows(tx, current, message, true)))
        throw new Error('SUBSCRIPTION_SOURCE_CHANGED')
      if (
        current.status !== 'CANCELED' ||
        current.providerSubscriptionId !== sub.providerSubscriptionId ||
        !matchesSubscriptionInvoice(current, local, remote)
      )
        throw new Error('SUBSCRIPTION_CANCELLATION_BINDING_MISMATCH')
      await applySubscriptionInvoice(tx, current, local, remote, now(), {
        id: sub.id,
        type: 'Subscription',
      })
      if (remote.status === 'CANCELED')
        await tx.platformInvoice.update({
          where: { id: intent },
          data: {
            providerCancelState: 'CONFIRMED',
            canceledReason: waiver
              ? 'REACTIVATION_WAIVER'
              : 'FUTURE_AFTER_CANCEL',
          },
        })
      else {
        await tx.platformInvoice.update({
          where: { id: intent },
          data: { providerCancelState: 'UNKNOWN' },
        })
        await audit(tx, sub, 'SUBSCRIPTION_CANCELLATION_UNCONFIRMED')
      }
    })
    if (remote.status !== 'CANCELED')
      throw new Error('SUBSCRIPTION_CANCELLATION_UNCONFIRMED')
  }

  return {
    handlers: {
      [SUBSCRIPTION_RECONCILE_TOPIC]: reconcile,
      ...(options.provider
        ? {
            [SUBSCRIPTION_DEACTIVATE_TOPIC]: deactivate,
            [SUBSCRIPTION_REACTIVATE_TOPIC]: createSubscriptionReactivationJob({
              ...options,
              provider: options.provider,
              now,
              deactivate,
              waive: (sub, id, message) =>
                cancelFuture(sub, id, '', message, true),
            }),
          }
        : {}),
    },
    enqueue: () =>
      options.transaction(async (tx) => {
        const eligible = await tx.$queryRaw<{ id: string; tenantId: string }[]>`
        SELECT s.id,s."tenantId" FROM subscriptions s WHERE s.status<>'CANCELED'
          AND s."providerNextAttemptAt"<=${now()}
          AND (s."billingMode"='COMPLIMENTARY' OR (s."providerSubscriptionId" IS NULL AND s."providerSync"<>'UNKNOWN')
            OR (${Boolean(options.provider)} AND s."providerEnvironment"=${options.environment ?? ''}))
          AND NOT EXISTS (SELECT 1 FROM platform_outbox_events o WHERE o.topic=${SUBSCRIPTION_RECONCILE_TOPIC}
            AND o."aggregateId"=s.id AND o.status IN ('PENDING','PROCESSING'))
        ORDER BY s."reconciledAt" ASC NULLS FIRST,s.id LIMIT 20 FOR UPDATE OF s SKIP LOCKED`
        for (const sub of eligible)
          await enqueuePlatformOutbox(tx, {
            tenantId: sub.tenantId,
            topic: SUBSCRIPTION_RECONCILE_TOPIC,
            aggregateId: sub.id,
            payload: { subscriptionId: sub.id },
            dedupeKey:
              'subscription-reconcile:' +
              sub.id +
              ':' +
              Math.floor(now().getTime() / 300_000),
            availableAt: now(),
          })
      }),
  }
}
