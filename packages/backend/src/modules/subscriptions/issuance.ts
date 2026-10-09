import type { Prisma } from '@prisma/client'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import {
  diaCivilDeColunaDate,
  diaCivilEmSaoPaulo,
} from '@gb-locacoes/domain/assinatura'
import {
  BillingProviderError,
  sameAmount,
  type AsaasPlatformSubscription,
  type PlatformCustomer,
  type PlatformCustomerInput,
  type PlatformRecurringInput,
} from '../billing/index'
import {
  enqueuePlatformOutbox,
  RetryDeliveryAtError,
  type OutboxHandler,
} from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import {
  issuanceInclude,
  readIssuanceProfile,
  type IssuanceSubscription,
} from './issuance-profile'
import { OwnerSubscriptionCommandError } from './owner-command'
import {
  reactivationPending,
  REACTIVATION_REQUESTED,
  REACTIVATION_READY,
} from './reactivation-state'
import {
  SUBSCRIPTION_ISSUE_TOPIC,
  SUBSCRIPTION_RECONCILE_TOPIC,
  SUBSCRIPTION_DEACTIVATE_TOPIC,
} from './topics'

type IssuanceProvider = {
  findCustomer(
    input: Pick<PlatformCustomerInput, 'cpfCnpj' | 'externalReference'>
  ): Promise<PlatformCustomer | null>
  createCustomer(input: PlatformCustomerInput): Promise<PlatformCustomer>
  findSubscription(reference: string): Promise<AsaasPlatformSubscription | null>
  createSubscription(
    input: PlatformRecurringInput
  ): Promise<AsaasPlatformSubscription>
}
const delayMs = 300_000
/** Customer id commits before any recurrence POST. Uncertain phases reconcile through reads only. */
export function createSubscriptionIssuance(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  provider: IssuanceProvider
  now?: () => Date
}) {
  const clock = options.now ?? (() => new Date())
  const locked = async <T>(
    id: string,
    tenantId: string,
    operation: (
      tx: Prisma.TransactionClient,
      sub: IssuanceSubscription
    ) => Promise<T>
  ) =>
    options.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${tenantId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${id} FOR UPDATE`
      const sub = await tx.subscription.findFirst({
        where: { id, tenantId },
        include: issuanceInclude,
      })
      if (
        !sub ||
        (sub.providerEnvironment &&
          sub.providerEnvironment !== options.environment)
      )
        throw new Error('SUBSCRIPTION_ISSUANCE_BINDING')
      return operation(tx, sub)
    })
  const audit = (
    tx: Prisma.TransactionClient,
    sub: IssuanceSubscription,
    code: string
  ) =>
    tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        tenantId: sub.tenantId,
        action: 'subscription.provider.issuance',
        targetType: 'Subscription',
        targetId: sub.id,
        reasonCategory: code,
      },
    })
  const compensate = (
    tx: Prisma.TransactionClient,
    sub: IssuanceSubscription,
    providerId: string
  ) =>
    enqueuePlatformOutbox(tx, {
      tenantId: sub.tenantId,
      topic: SUBSCRIPTION_DEACTIVATE_TOPIC,
      aggregateId: sub.id,
      payload: { subscriptionId: sub.id },
      dedupeKey: 'subscription-deactivate:' + sub.id + ':issue:' + providerId,
    })
  const retryAt = (sub: IssuanceSubscription) => {
    throw new RetryDeliveryAtError(
      sub.providerNextAttemptAt,
      'ISSUANCE_PENDING'
    )
  }
  const fail = async (
    snapshot: IssuanceSubscription,
    error: unknown,
    writing: boolean
  ) => {
    let retry: Date | undefined
    await locked(snapshot.id, snapshot.tenantId, async (tx, sub) => {
      if (
        sub.providerAttempts !== snapshot.providerAttempts ||
        sub.providerCustomerId !== snapshot.providerCustomerId ||
        sub.providerSubscriptionId
      )
        return
      const known = error instanceof BillingProviderError
      const uncertain =
        writing &&
        (!known ||
          error.maybeApplied ||
          error.code === 'INVALID_RESPONSE' ||
          error.code === 'AMBIGUOUS')
      const temporary =
        known && error.code === 'UNAVAILABLE' && !error.maybeApplied
      const mismatch =
        known && error.code === 'REJECTED' && error.reason === 'AMBIGUOUS_MATCH'
      const state = mismatch
        ? 'FAILED'
        : uncertain ||
            sub.providerSync === 'UNKNOWN' ||
            (!writing && sub.providerSync === 'PROCESSING')
          ? 'UNKNOWN'
          : temporary
            ? 'PENDING'
            : 'FAILED'
      const code =
        error instanceof OwnerSubscriptionCommandError
          ? error.code
          : known
            ? 'ISSUANCE_' + (error.reason ?? error.code)
            : 'ISSUANCE_UNCERTAIN'
      const availableAt = new Date(
        clock().getTime() +
          Math.max(
            delayMs,
            Math.min(86_400, known ? (error.retryAfterSeconds ?? 0) : 0) * 1000
          )
      )
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerSync: state,
          providerLastError: code,
          providerNextAttemptAt: availableAt,
          revision: { increment: 1 },
        },
      })
      await audit(tx, sub, code)
      if (state !== 'FAILED') retry = availableAt
    })
    if (retry)
      throw new RetryDeliveryAtError(retry, 'ISSUANCE_RECONCILIATION_REQUIRED')
  }
  const reserve = (
    snapshot: IssuanceSubscription,
    customerPhase: boolean,
    profile: PlatformCustomerInput
  ) =>
    locked(snapshot.id, snapshot.tenantId, async (tx, sub) => {
      if (
        sub.providerAttempts !== snapshot.providerAttempts ||
        sub.planVersionId !== snapshot.planVersionId ||
        sub.providerCustomerId !== snapshot.providerCustomerId ||
        sub.providerSubscriptionId ||
        sub.status === 'CANCELED' ||
        sub.cancelAtPeriodEnd
      )
        return null
      if (
        sub.providerSync === 'PROCESSING' ||
        sub.providerSync === 'UNKNOWN' ||
        sub.providerNextAttemptAt > clock()
      )
        return retryAt(sub)
      if (
        JSON.stringify(await readIssuanceProfile(tx, sub, clock())) !==
        JSON.stringify(profile)
      )
        throw new OwnerSubscriptionCommandError(409, 'BILLING_PROFILE_CHANGED')
      if (customerPhase) {
        const predecessor = await tx.subscription.findFirst({
          where: {
            tenantId: sub.tenantId,
            id: { not: sub.id },
            billingMode: 'ASAAS',
            providerCustomerId: null,
            providerSync: { in: ['PROCESSING', 'UNKNOWN'] },
          },
          select: { id: true },
        })
        if (predecessor)
          throw new RetryDeliveryAtError(
            new Date(clock().getTime() + delayMs),
            'CUSTOMER_PREDECESSOR_UNCERTAIN'
          )
      }
      return tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerSync: 'PROCESSING',
          providerAttempts: { increment: 1 },
          providerNextAttemptAt: new Date(clock().getTime() + delayMs),
          providerLastError: null,
          revision: { increment: 1 },
        },
        include: issuanceInclude,
      })
    })
  const bindCustomer = (
    snapshot: IssuanceSubscription,
    remote: PlatformCustomer,
    profile: PlatformCustomerInput
  ) =>
    locked(snapshot.id, snapshot.tenantId, async (tx, sub) => {
      if (
        sub.providerAttempts !== snapshot.providerAttempts ||
        sub.providerCustomerId !== snapshot.providerCustomerId ||
        sub.providerSubscriptionId
      )
        return null
      if (
        remote.cpfCnpj !== profile.cpfCnpj ||
        remote.externalReference !== profile.externalReference ||
        remote.notificationDisabled !== true
      )
        throw new BillingProviderError('REJECTED', {
          reason: 'AMBIGUOUS_MATCH',
        })
      return tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerCustomerId: remote.id,
          providerSync: 'PENDING',
          providerLastError: null,
          providerNextAttemptAt: clock(),
          revision: { increment: 1 },
        },
        include: issuanceInclude,
      })
    })
  const bindSubscription = (
    snapshot: IssuanceSubscription,
    remote: AsaasPlatformSubscription
  ) =>
    locked(snapshot.id, snapshot.tenantId, async (tx, sub) => {
      if (
        sub.providerAttempts !== snapshot.providerAttempts ||
        sub.providerCustomerId !== snapshot.providerCustomerId ||
        sub.providerSubscriptionId
      )
        return
      if (
        remote.customer !== sub.providerCustomerId ||
        remote.externalReference !== 'sub:' + sub.id ||
        remote.cycle !== 'MONTHLY' ||
        !sameAmount(remote.amount, sub.planVersion.amount) ||
        (sub.status !== 'CANCELED' && remote.status !== 'ACTIVE')
      )
        throw new BillingProviderError('REJECTED', {
          reason: 'AMBIGUOUS_MATCH',
        })
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerSubscriptionId: remote.id,
          providerSync: 'SYNCED',
          providerLastError: null,
          providerNextAttemptAt: clock(),
          revision: { increment: 1 },
        },
      })
      if (sub.status === 'CANCELED') await compensate(tx, sub, remote.id)
      else
        await enqueuePlatformOutbox(tx, {
          tenantId: sub.tenantId,
          topic: SUBSCRIPTION_RECONCILE_TOPIC,
          aggregateId: sub.id,
          payload: { subscriptionId: sub.id },
          dedupeKey:
            'subscription-reconcile:' + sub.id + ':issued:' + remote.id,
        })
      await audit(tx, sub, 'RECURRENCE_BOUND')
    })
  const issue: OutboxHandler<string | null> = async (message) => {
    const payload = message.payload as { subscriptionId?: unknown } | null
    if (!message.tenantId || payload?.subscriptionId !== message.aggregateId)
      throw new Error('INVALID_SUBSCRIPTION_ISSUANCE')
    let sub = await locked(
      message.aggregateId,
      message.tenantId,
      async (tx, current) => {
        if (
          current.billingMode !== 'ASAAS' ||
          current.providerSync === 'FAILED'
        )
          return null
        if (current.providerSubscriptionId) {
          if (current.status === 'CANCELED')
            await compensate(tx, current, current.providerSubscriptionId)
          return null
        }
        if (
          current.status === 'CANCELED' &&
          !['PROCESSING', 'UNKNOWN'].includes(current.providerSync)
        )
          return null
        if (current.cancelAtPeriodEnd && current.status !== 'CANCELED')
          return null
        if (
          current.status !== 'CANCELED' &&
          (await reactivationPending(tx, current.id))
        )
          throw new RetryDeliveryAtError(
            new Date(clock().getTime() + delayMs),
            'REACTIVATION_PENDING'
          )
        if (current.providerNextAttemptAt > clock()) return retryAt(current)
        if (
          current.providerEnvironment === null ||
          current.providerSync === 'NOT_REQUIRED'
        )
          return tx.subscription.update({
            where: { id: current.id },
            data: {
              providerEnvironment: options.environment,
              ...(current.providerSync === 'NOT_REQUIRED'
                ? { providerSync: 'PENDING' }
                : {}),
              revision: { increment: 1 },
            },
            include: issuanceInclude,
          })
        return current
      }
    )
    if (!sub) return
    let writing = false
    try {
      const profile =
        sub.status === 'CANCELED'
          ? {
              name: sub.organization.legalName ?? '',
              cpfCnpj: sub.organization.documentNormalized ?? '',
              email: '',
              externalReference: 'org:' + sub.tenantId,
              notificationDisabled: true as const,
            }
          : await options.transaction((tx) =>
              readIssuanceProfile(tx, sub!, clock())
            )
      if (!sub.providerCustomerId) {
        let remote = await options.provider.findCustomer(profile)
        if (!remote) {
          if (['PROCESSING', 'UNKNOWN'].includes(sub.providerSync))
            throw new BillingProviderError('AMBIGUOUS', {
              reason: 'AMBIGUOUS_MATCH',
            })
          const reserved = await reserve(sub, true, profile)
          if (!reserved) return
          sub = reserved
          writing = true
          remote = await options.provider.createCustomer(profile)
        }
        const bound = await bindCustomer(sub, remote, profile)
        if (!bound || bound.status === 'CANCELED' || bound.cancelAtPeriodEnd)
          return
        sub = bound
        writing = false
      }
      let remote = await options.provider.findSubscription('sub:' + sub.id)
      if (!remote) {
        if (['PROCESSING', 'UNKNOWN'].includes(sub.providerSync))
          throw new BillingProviderError('AMBIGUOUS', {
            reason: 'AMBIGUOUS_MATCH',
          })
        const reserved = await reserve(sub, false, profile)
        if (!reserved) return
        sub = reserved
        writing = true
        const today = diaCivilEmSaoPaulo(clock())
        const trialEnd = sub.trialEndsAt
          ? diaCivilDeColunaDate(sub.trialEndsAt)
          : null
        remote = await options.provider.createSubscription({
          customer: sub.providerCustomerId!,
          amount: sub.planVersion.amount,
          nextDueDate: trialEnd && trialEnd > today ? trialEnd : today,
          externalReference: 'sub:' + sub.id,
          description:
            PLATFORM.displayName +
            ' · Plano ' +
            sub.planVersion.plan.name +
            ' · ' +
            sub.organization.slug,
        })
      }
      await bindSubscription(sub, remote)
    } catch (error) {
      if (error instanceof RetryDeliveryAtError) throw error
      await fail(sub, error, writing)
    }
  }
  return {
    handlers: { [SUBSCRIPTION_ISSUE_TOPIC]: issue },
    enqueue: () =>
      options.transaction(async (tx) => {
        const today = diaCivilEmSaoPaulo(clock())
        const due = await tx.$queryRaw<{ id: string; tenantId: string }[]>`
        SELECT s.id,s."tenantId" FROM subscriptions s JOIN organizations o ON o.id=s."tenantId"
        WHERE s."billingMode"='ASAAS' AND s."providerSubscriptionId" IS NULL
          AND (s."providerEnvironment" IS NULL OR s."providerEnvironment"=${options.environment})
          AND s."providerNextAttemptAt"<=${clock()} AND s."providerSync"<>'FAILED'
          AND NOT EXISTS (SELECT 1 FROM subscription_events request WHERE request."subscriptionId"=s.id AND request.reason=${REACTIVATION_REQUESTED}
            AND NOT EXISTS (SELECT 1 FROM subscription_events ready WHERE ready."subscriptionId"=s.id AND ready.reason=${REACTIVATION_READY}))
          AND ((o.status='ACTIVE' AND s.status IN ('INCOMPLETE','TRIALING') AND NOT s."cancelAtPeriodEnd"
            AND (s."providerSync"<>'NOT_REQUIRED' OR s."trialEndsAt" IS NULL OR s."trialEndsAt"<=${new Date(today + 'T00:00:00Z')}::date+INTERVAL '7 days'))
            OR (s.status='CANCELED' AND s."providerSync" IN ('PROCESSING','UNKNOWN')))
          AND NOT EXISTS (SELECT 1 FROM platform_outbox_events e WHERE e.topic=${SUBSCRIPTION_ISSUE_TOPIC} AND e."aggregateId"=s.id AND e.status IN ('PENDING','PROCESSING'))
        ORDER BY s."providerNextAttemptAt",s.id LIMIT 20`
        for (const sub of due)
          await enqueuePlatformOutbox(tx, {
            tenantId: sub.tenantId,
            topic: SUBSCRIPTION_ISSUE_TOPIC,
            aggregateId: sub.id,
            payload: { subscriptionId: sub.id },
            dedupeKey:
              'subscription-issue:' +
              sub.id +
              ':' +
              Math.floor(clock().getTime() / delayMs),
          })
      }),
  }
}
