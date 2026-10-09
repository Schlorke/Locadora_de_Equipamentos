import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { enqueueOutbox } from './adapters/prisma-outbox'
import { PermanentDeliveryError } from './dispatch'
import {
  isInboundIntegrationStatus,
  type AuthenticatedTenantWebhook,
} from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import { asaasReceiptPayload } from '../billing/index'
type Consumer = (_event: AuthenticatedTenantWebhook) => Promise<Response>
function eventKey(event: AuthenticatedTenantWebhook): string {
  const body = event.body as Record<string, unknown> | null
  const id =
    body &&
    typeof body === 'object' &&
    typeof body.id === 'string' &&
    body.id.length <= 128
      ? body.id
      : null
  return id ? 'id:' + id : 'sha256:' + event.payloadHash
}
export function createWebhookInbox({
  withTenantTransaction,
  consumers,
}: {
  withTenantTransaction: TenantTransactionRunner
  consumers: Record<string, () => Promise<{ consumeWebhook: Consumer }>>
}) {
  async function acceptQueuedAsaasWebhook(
    event: AuthenticatedTenantWebhook,
    ignored = false
  ): Promise<Response> {
    try {
      if (
        event.integration.provider !== 'ASAAS' ||
        event.integration.tenantId !== event.context.tenantId
      )
        throw new Error('INVALID_ASAAS_RECEIPT')
      const result = await withTenantTransaction(event.context, async (tx) => {
        const key = eventKey(event)
        const inserted = await tx.webhookInbox.createMany({
          data: {
            tenantId: event.context.tenantId,
            integrationId: event.integration.id,
            provider: 'ASAAS',
            eventKey: key,
            payloadHash: event.payloadHash,
            payload: asaasReceiptPayload(event.body),
            ...(ignored
              ? { processedAt: new Date(), lastError: 'IGNORED_EVENT' }
              : {}),
          },
          skipDuplicates: true,
        })
        const inbox = await tx.webhookInbox.findUniqueOrThrow({
          where: {
            integrationId_eventKey: {
              integrationId: event.integration.id,
              eventKey: key,
            },
          },
        })
        if (
          inbox.payloadHash !== event.payloadHash ||
          inbox.tenantId !== event.context.tenantId
        ) {
          const changed = await tx.webhookInbox.updateMany({
            where: {
              id: inbox.id,
              tenantId: event.context.tenantId,
              OR: [
                { lastError: null },
                { lastError: { not: 'EVENT_IDENTITY_CONFLICT' } },
              ],
            },
            data: {
              processedAt: new Date(),
              lastError: 'EVENT_IDENTITY_CONFLICT',
              processingToken: null,
              lockedUntil: null,
            },
          })
          if (changed.count)
            await tx.auditLog.create({
              data: {
                tenantId: event.context.tenantId,
                action: 'WEBHOOK_IDENTITY_CONFLICT',
                entity: 'WebhookInbox',
                entityId: inbox.id,
              },
            })
          return { accepted: true, conflict: true }
        }
        if (!inbox.processedAt)
          await enqueueOutbox(tx, {
            tenantId: event.context.tenantId,
            topic: 'webhook.process',
            aggregateId: inbox.id,
            payload: { inboxId: inbox.id, acknowledgement: 'DURABLE_ASAAS' },
            dedupeKey: 'webhook:' + inbox.id,
          })
        return { accepted: true, duplicate: inserted.count === 0 }
      })
      return Response.json(result, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    } catch {
      return Response.json(
        { error: 'Webhook persistence unavailable' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
      )
    }
  }
  async function acceptTenantWebhook(
    event: AuthenticatedTenantWebhook,
    consumer: Consumer
  ): Promise<Response> {
    try {
      const key = eventKey(event)
      const received = await withTenantTransaction(
        event.context,
        async (tx) => {
          // An empty-update Prisma upsert can read first and race on INSERT.
          // PostgreSQL arbitrates this insert atomically without aborting the
          // tenant transaction when another host already received the event.
          await tx.webhookInbox.createMany({
            data: {
              tenantId: event.context.tenantId,
              integrationId: event.integration.id,
              provider: event.integration.provider,
              eventKey: key,
              payloadHash: event.payloadHash,
              payload: event.body as Prisma.InputJsonValue,
            },
            skipDuplicates: true,
          })
          const inbox = await tx.webhookInbox.findUniqueOrThrow({
            where: {
              integrationId_eventKey: {
                integrationId: event.integration.id,
                eventKey: key,
              },
            },
          })
          if (
            inbox.payloadHash !== event.payloadHash ||
            inbox.tenantId !== event.context.tenantId
          )
            return null
          await enqueueOutbox(tx, {
            tenantId: event.context.tenantId,
            topic: 'webhook.process',
            aggregateId: inbox.id,
            payload: { inboxId: inbox.id },
            dedupeKey: 'webhook:' + inbox.id,
          })
          return inbox
        }
      )
      if (!received)
        return Response.json(
          { error: 'Webhook event identity conflict' },
          { status: 409 }
        )
      if (received.processedAt)
        return Response.json({ success: true, duplicate: true })
      return await processReceipt(event, received.id, consumer)
    } catch {
      return Response.json(
        { error: 'Webhook persistence unavailable' },
        { status: 503 }
      )
    }
  }
  async function processReceipt(
    event: AuthenticatedTenantWebhook,
    inboxId: string,
    consumer: Consumer,
    durableAsaas = false
  ): Promise<Response> {
    const token = randomUUID()
    const claimed = await withTenantTransaction(event.context, async (tx) => {
      // Administrative blocks retain authenticated receipts without applying business effects.
      const organization = await tx.organization.findUnique({
        where: { id: event.context.tenantId },
        select: { status: true },
      })
      if (!organization || organization.status !== 'ACTIVE') return null
      return tx.webhookInbox.updateMany({
        where: {
          id: inboxId,
          tenantId: event.context.tenantId,
          processedAt: null,
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
        },
        data: {
          processingToken: token,
          lockedUntil: new Date(Date.now() + 120_000),
        },
      })
    })
    if (!claimed) return Response.json({ accepted: true, deferred: true })
    if (claimed.count !== 1)
      return Response.json(
        { accepted: true, processing: true },
        { status: 202 }
      )
    let response: Response
    try {
      response = await consumer(event)
    } catch {
      response = Response.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      )
    }
    const terminalInvalid =
      [400, 403].includes(response.status) ||
      (durableAsaas && [404, 409].includes(response.status))
    await withTenantTransaction(event.context, async (tx) => {
      const changed = await tx.webhookInbox.updateMany({
        where: {
          id: inboxId,
          tenantId: event.context.tenantId,
          processingToken: token,
          ...(durableAsaas
            ? {
                OR: [
                  { lastError: null },
                  { lastError: { not: 'EVENT_IDENTITY_CONFLICT' } },
                ],
              }
            : {}),
        },
        data: {
          processedAt: response.ok || terminalInvalid ? new Date() : null,
          lastError: response.ok
            ? null
            : durableAsaas && response.status === 409
              ? 'RECONCILIATION_REQUIRED'
              : durableAsaas && response.status === 404
                ? 'IGNORED_UNKNOWN_PAYMENT'
                : 'CONSUMER_HTTP_' + response.status,
          processingToken: null,
          lockedUntil: null,
        },
      })
      if (durableAsaas && response.status === 409 && changed.count)
        await tx.auditLog.create({
          data: {
            tenantId: event.context.tenantId,
            action: 'PAYMENT_RECONCILIATION_REQUIRED',
            entity: 'WebhookInbox',
            entityId: inboxId,
            changes: { reason: 'CONSUMER_VALUE_CONFLICT' },
          },
        })
    })
    return durableAsaas && terminalInvalid
      ? Response.json({ success: true })
      : response
  }
  async function runWebhookInboxEffect(
    context: { tenantId: string },
    _eventId: string,
    payload: unknown
  ) {
    const id =
      payload && typeof payload === 'object' && 'inboxId' in payload
        ? payload.inboxId
        : null
    if (typeof id !== 'string')
      throw new PermanentDeliveryError('INVALID_WEBHOOK_INBOX_PAYLOAD')
    const inbox = await withTenantTransaction(context, (tx) =>
      tx.webhookInbox.findFirst({
        where: { id, tenantId: context.tenantId },
        include: {
          integration: {
            include: { organization: { select: { status: true } } },
          },
        },
      })
    )
    if (!inbox) throw new PermanentDeliveryError('WEBHOOK_INBOX_MISSING')
    if (inbox.processedAt) return
    const integration = inbox.integration
    if (
      !integration ||
      integration.tenantId !== context.tenantId ||
      !isInboundIntegrationStatus(integration.status)
    )
      throw new PermanentDeliveryError('WEBHOOK_INTEGRATION_DISABLED')
    if (integration.organization.status !== 'ACTIVE')
      throw new Error('WEBHOOK_TENANT_BLOCKED')
    const load = consumers[integration.provider]
    if (!load) throw new PermanentDeliveryError('UNKNOWN_WEBHOOK_PROVIDER')
    const result = await processReceipt(
      {
        context,
        integration,
        body: inbox.payload,
        payloadHash: inbox.payloadHash || '',
      },
      inbox.id,
      (await load()).consumeWebhook,
      integration.provider === 'ASAAS' &&
        typeof payload === 'object' &&
        payload !== null &&
        'acknowledgement' in payload &&
        payload.acknowledgement === 'DURABLE_ASAAS'
    )
    if (result.status === 202 || !result.ok)
      throw new Error('WEBHOOK_RETRY_PENDING')
  }
  return {
    acceptTenantWebhook,
    acceptQueuedAsaasWebhook,
    runWebhookInboxEffect,
  }
}
