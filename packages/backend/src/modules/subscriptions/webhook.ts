import { randomUUID } from 'node:crypto'
import type { Prisma, Subscription } from '@prisma/client'
import {
  parseAsaasEvent,
  isKnownAsaasEvent,
  type AsaasPlatformInvoice,
} from '../billing/index'
import type { OutboxHandler } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { applySubscriptionInvoice, matchesSubscriptionInvoice } from './invoice'
import { recomputeSubscription } from './projection'

export const SUBSCRIPTION_INVOICE_TOPIC = 'subscriptions.invoice.webhook'
type Target = { paymentId: string; subscription: Subscription }

/** Platform receipts cannot read tenant payments; all provider facts come through the root-only port. */
export function createSubscriptionInvoiceConsumer(options: {
  transaction: PlatformTransaction
  environment: 'sandbox' | 'production'
  read: (_target: Target) => Promise<AsaasPlatformInvoice>
  now?: () => Date
  token?: () => string
}) {
  const now = options.now ?? (() => new Date())
  async function terminal(
    tx: Prisma.TransactionClient,
    id: string,
    tenantId: string | null,
    code: string,
    token?: string
  ) {
    const changed = await tx.platformWebhookInbox.updateMany({
      where: {
        id,
        ...(token ? { processingToken: token } : {}),
        status: { in: ['RECEIVED', 'FAILED'] },
      },
      data: {
        status: 'IGNORED',
        processedAt: now(),
        processingToken: null,
        lockedUntil: null,
        lastError: code,
      },
    })
    if (changed.count)
      await tx.platformAuditLog.create({
        data: {
          actorKind: 'SYSTEM',
          tenantId,
          action: 'subscription.invoice.reconciliation',
          targetType: 'PlatformWebhookInbox',
          targetId: id,
          reasonCategory: code,
        },
      })
  }
  const handler: OutboxHandler<string | null> = async (message) => {
    const id = (message.payload as { inboxId?: unknown } | null)?.inboxId
    if (typeof id !== 'string' || id !== message.aggregateId)
      throw new Error('INVALID_SUBSCRIPTION_MESSAGE')
    const token = (options.token ?? randomUUID)()
    const work = await options.transaction(async (tx) => {
      const receipt = await tx.platformWebhookInbox.findUniqueOrThrow({
        where: { id },
      })
      if (
        receipt.source !== 'ASAAS_ROOT' ||
        (receipt.sourceEnvironment !== null &&
          receipt.sourceEnvironment !== options.environment) ||
        !receipt.tenantId ||
        receipt.tenantId !== message.tenantId
      )
        throw new Error('INVALID_SUBSCRIPTION_MESSAGE')
      if (
        ['PROCESSED', 'IGNORED', 'CONFLICT', 'UNROUTED'].includes(
          receipt.status
        )
      )
        return null
      const parsed = parseAsaasEvent(receipt.payload)
      if (
        !parsed.ok ||
        parsed.event.category !== 'PAYMENT' ||
        !isKnownAsaasEvent(parsed.event.type)
      )
        throw new Error('INVALID_SUBSCRIPTION_EVENT')
      const payment = parsed.event.payment
      const invoice = await tx.platformInvoice.findUnique({
        where: { providerPaymentId: payment.id },
      })
      let sub: Subscription | null = invoice
        ? await tx.subscription.findUnique({
            where: { id: invoice.subscriptionId },
          })
        : null
      if (!sub && payment.subscription)
        sub = await tx.subscription.findUnique({
          where: { providerSubscriptionId: payment.subscription },
        })
      if (!sub && payment.externalReference?.startsWith('sub:'))
        sub = await tx.subscription.findUnique({
          where: { id: payment.externalReference.slice(4) },
        })
      if (
        !sub ||
        sub.tenantId !== receipt.tenantId ||
        sub.providerEnvironment !== options.environment ||
        sub.billingMode !== 'ASAAS'
      ) {
        await terminal(
          tx,
          id,
          receipt.tenantId,
          'SUBSCRIPTION_BINDING_NOT_FOUND'
        )
        return null
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
      if (!claimed.count) throw new Error('SUBSCRIPTION_RECEIPT_BUSY')
      return { subscription: sub, paymentId: payment.id }
    })
    if (!work) return
    try {
      const remote = await options.read(work)
      await options.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${work.subscription.tenantId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${work.subscription.id} FOR UPDATE`
        const receipt = await tx.platformWebhookInbox.findFirst({
          where: {
            id,
            processingToken: token,
            status: { in: ['RECEIVED', 'FAILED'] },
          },
        })
        if (!receipt) return
        const sub = await tx.subscription.findUniqueOrThrow({
          where: { id: work.subscription.id },
          include: { planVersion: true },
        })
        if (
          sub.updatedAt.getTime() !== work.subscription.updatedAt.getTime() ||
          sub.billingMode !== 'ASAAS' ||
          sub.providerEnvironment !== options.environment
        )
          throw new Error('SUBSCRIPTION_BINDING_CHANGED')
        const invoice = await tx.platformInvoice.findUnique({
          where: { providerPaymentId: work.paymentId },
        })
        if (
          remote.id !== work.paymentId ||
          !matchesSubscriptionInvoice(sub, invoice, remote)
        ) {
          await terminal(
            tx,
            id,
            sub.tenantId,
            'INVOICE_RECONCILIATION_REQUIRED',
            token
          )
          return
        }
        const done = await tx.platformWebhookInbox.updateMany({
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
            lastError: remote.unknownStatus ? 'UNKNOWN_PROVIDER_STATUS' : null,
          },
        })
        if (!done.count) return
        await applySubscriptionInvoice(tx, sub, invoice, remote, now(), {
          id,
          type: 'PlatformWebhookInbox',
        })
        await recomputeSubscription(tx, sub.id, id, now())
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
            lastError: 'SUBSCRIPTION_INVOICE_UNAVAILABLE',
          },
        })
      )
      throw new Error('SUBSCRIPTION_INVOICE_UNAVAILABLE')
    }
  }
  return {
    handlers: { [SUBSCRIPTION_INVOICE_TOPIC]: handler },
    enqueue: () =>
      options.transaction(async (tx) => {
        const jobs = await tx.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM platform_outbox_events o JOIN platform_webhook_inbox i ON i.id=o."aggregateId"
      WHERE o.topic='platform.webhook.process' AND o.status='PENDING' AND o."lockedBy" IS NULL
        AND i.source='ASAAS_ROOT' AND i.status IN ('RECEIVED','FAILED') AND i."tenantId" IS NOT NULL
        AND left(i."eventType",8)='PAYMENT_'
      ORDER BY i."receivedAt",i.id LIMIT 20 FOR UPDATE OF o SKIP LOCKED`
        for (const job of jobs)
          await tx.platformOutboxEvent.updateMany({
            where: {
              id: job.id,
              topic: 'platform.webhook.process',
              status: 'PENDING',
              lockedBy: null,
            },
            data: { topic: SUBSCRIPTION_INVOICE_TOPIC },
          })
      }),
  }
}
