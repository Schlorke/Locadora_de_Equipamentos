import { parseAsaasEvent, isKnownAsaasEvent } from '../billing/index'
import { enqueuePlatformOutbox, type OutboxHandler } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { resolveAsaasSubscription, subscriptionHintMatches } from './binding'
import {
  SUBSCRIPTION_RECONCILE_TOPIC,
  SUBSCRIPTION_DEACTIVATE_TOPIC,
} from './topics'

export const SUBSCRIPTION_EVENT_TOPIC = 'subscriptions.event.webhook'

/** A receipt is processed only after its reconciliation handoff commits; payload never grants access. */
export function createSubscriptionEventConsumer(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  now?: () => Date
}) {
  const now = options.now ?? (() => new Date())
  const handler: OutboxHandler<string | null> = async (message) =>
    options.transaction(async (tx) => {
      const id = (message.payload as { inboxId?: unknown } | null)?.inboxId
      if (typeof id !== 'string' || message.aggregateId !== id)
        throw new Error('INVALID_SUBSCRIPTION_MESSAGE')
      let receipt = await tx.platformWebhookInbox.findUniqueOrThrow({
        where: { id },
      })
      if (
        receipt.source !== 'ASAAS_ROOT' ||
        !receipt.tenantId ||
        receipt.tenantId !== message.tenantId ||
        (receipt.sourceEnvironment !== null &&
          receipt.sourceEnvironment !== options.environment)
      )
        throw new Error('INVALID_SUBSCRIPTION_MESSAGE')
      if (
        ['PROCESSED', 'IGNORED', 'CONFLICT', 'UNROUTED'].includes(
          receipt.status
        )
      )
        return
      const parsed = parseAsaasEvent(receipt.payload)
      if (
        !parsed.ok ||
        parsed.event.category !== 'SUBSCRIPTION' ||
        !isKnownAsaasEvent(parsed.event.type)
      )
        throw new Error('INVALID_SUBSCRIPTION_EVENT')
      const hint = parsed.event.subscription
      const sub = await resolveAsaasSubscription(
        tx,
        { providerId: hint.id, reference: hint.externalReference },
        options.environment
      )
      if (sub) {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${sub.tenantId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id} FOR UPDATE`
      }
      await tx.$queryRaw`SELECT id FROM platform_webhook_inbox WHERE id=${id} FOR UPDATE`
      receipt = await tx.platformWebhookInbox.findUniqueOrThrow({
        where: { id },
      })
      if (!['RECEIVED', 'FAILED'].includes(receipt.status)) return
      if (
        receipt.source !== 'ASAAS_ROOT' ||
        receipt.tenantId !== message.tenantId ||
        (receipt.sourceEnvironment !== null &&
          receipt.sourceEnvironment !== options.environment)
      )
        throw new Error('INVALID_SUBSCRIPTION_MESSAGE')
      if (receipt.lockedUntil && receipt.lockedUntil >= now())
        throw new Error('SUBSCRIPTION_RECEIPT_BUSY')
      const current = sub
        ? await tx.subscription.findUniqueOrThrow({ where: { id: sub.id } })
        : null
      const valid =
        current &&
        current.tenantId === receipt.tenantId &&
        current.billingMode === 'ASAAS' &&
        current.providerEnvironment === options.environment &&
        subscriptionHintMatches(current, hint)
      const changed = await tx.platformWebhookInbox.updateMany({
        where: { id, status: { in: ['RECEIVED', 'FAILED'] } },
        data: {
          status: valid ? 'PROCESSED' : 'IGNORED',
          processedAt: now(),
          lastError: valid ? null : 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
          attempts: { increment: 1 },
          processingToken: null,
          lockedUntil: null,
        },
      })
      if (!changed.count) return
      if (!valid) {
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: receipt.tenantId,
            action: 'subscription.event.reconciliation',
            targetType: 'PlatformWebhookInbox',
            targetId: id,
            reasonCategory: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
          },
        })
        return
      }
      await enqueuePlatformOutbox(tx, {
        tenantId: current.tenantId,
        topic:
          current.status === 'CANCELED'
            ? SUBSCRIPTION_DEACTIVATE_TOPIC
            : SUBSCRIPTION_RECONCILE_TOPIC,
        aggregateId: current.id,
        payload: { subscriptionId: current.id, sourceInboxId: id },
        dedupeKey: 'subscription-receipt:' + id,
        availableAt:
          current.providerNextAttemptAt > now()
            ? current.providerNextAttemptAt
            : now(),
      })
    })
  return {
    handlers: { [SUBSCRIPTION_EVENT_TOPIC]: handler },
    enqueue: () =>
      options.transaction(async (tx) => {
        const jobs = await tx.$queryRaw<{ id: string }[]>`
        SELECT o.id FROM platform_outbox_events o JOIN platform_webhook_inbox i ON i.id=o."aggregateId"
        WHERE o.topic='platform.webhook.process' AND o.status='PENDING' AND o."lockedBy" IS NULL
          AND i.source='ASAAS_ROOT' AND i.status IN ('RECEIVED','FAILED') AND i."tenantId" IS NOT NULL
          AND left(i."eventType",13)='SUBSCRIPTION_'
        ORDER BY i."receivedAt",i.id LIMIT 20 FOR UPDATE OF o SKIP LOCKED`
        for (const job of jobs)
          await tx.platformOutboxEvent.updateMany({
            where: {
              id: job.id,
              topic: 'platform.webhook.process',
              status: 'PENDING',
              lockedBy: null,
            },
            data: { topic: SUBSCRIPTION_EVENT_TOPIC },
          })
      }),
  }
}
