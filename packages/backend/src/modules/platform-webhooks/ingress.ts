import { createHash } from 'node:crypto'
import {
  parseAsaasEvent,
  isKnownAsaasEvent,
  asaasReceiptPayload,
} from '../billing/index'
import type { VerifiedIntegration } from '../identity/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { platformAsaasDestination, platformAsaasTopic } from './routing'

export type PlatformAsaasReceipt = {
  source: 'ASAAS_ROOT' | 'ASAAS_ACCOUNT'
  body: unknown
  payloadHash: string
  integration?: VerifiedIntegration
}
/** Persists routing, immutable identity, alert and dispatch atomically, under the platform role. */
export function createPlatformAsaasIngress({
  transaction,
  environment,
}: {
  transaction: PlatformTransaction
  environment: string
}) {
  return async (input: PlatformAsaasReceipt) => {
    if (!/^[a-f0-9]{64}$/.test(input.payloadHash))
      throw new Error('INVALID_WEBHOOK_HASH')
    if (input.source !== 'ASAAS_ROOT' && input.source !== 'ASAAS_ACCOUNT')
      throw new Error('INVALID_WEBHOOK_SOURCE')
    if (!['sandbox', 'production'].includes(environment))
      throw new Error('INVALID_WEBHOOK_ENVIRONMENT')
    const parsed = parseAsaasEvent(input.body)
    const payload = asaasReceiptPayload(input.body)
    const id =
      typeof payload.id === 'string' && payload.id.length <= 128 && payload.id
        ? payload.id
        : null
    const key = id ? 'id:' + id : 'sha256:' + input.payloadHash
    // The same event id on two subaccounts must never share a receipt or routing destination.
    const eventId =
      input.source === 'ASAAS_ACCOUNT' && input.integration
        ? 'account:' +
          createHash('sha256').update(input.integration.id).digest('hex') +
          ':' +
          key
        : key
    const eventType = parsed.ok ? parsed.event.type : 'INVALID_EVENT'
    const ignored =
      !parsed.ok ||
      !isKnownAsaasEvent(eventType) ||
      parsed.event.category === 'OTHER'
    return transaction(async (tx) => {
      const target = await platformAsaasDestination(tx, input, environment)
      const status = ignored ? 'IGNORED' : target ? 'RECEIVED' : 'UNROUTED'
      const inserted = await tx.platformWebhookInbox.createMany({
        data: {
          source: input.source,
          sourceEnvironment: input.source === 'ASAAS_ROOT' ? environment : null,
          eventId,
          eventType,
          payloadHash: input.payloadHash,
          payload,
          routeKey:
            input.source === 'ASAAS_ACCOUNT'
              ? input.integration!.id
              : (target?.routeKey ?? null),
          tenantId: target?.tenantId ?? null,
          status,
          processedAt: ignored ? new Date() : null,
        },
        skipDuplicates: true,
      })
      const inbox = await tx.platformWebhookInbox.findUniqueOrThrow({
        where: { source_eventId: { source: input.source, eventId } },
      })
      if (
        inbox.payloadHash !== input.payloadHash ||
        (input.source === 'ASAAS_ROOT' &&
          inbox.sourceEnvironment !== null &&
          inbox.sourceEnvironment !== environment) ||
        (input.source === 'ASAAS_ACCOUNT' &&
          (inbox.routeKey !== input.integration?.id ||
            inbox.tenantId !== input.integration.tenantId))
      ) {
        const changed = await tx.platformWebhookInbox.updateMany({
          where: { id: inbox.id, status: { not: 'CONFLICT' } },
          data: {
            status: 'CONFLICT',
            lastError: 'EVENT_IDENTITY_CONFLICT',
            processingToken: null,
            lockedUntil: null,
          },
        })
        if (changed.count)
          await tx.platformAuditLog.create({
            data: {
              actorKind: 'SYSTEM',
              action: 'webhook.identity.conflict',
              tenantId: inbox.tenantId,
              targetType: 'PlatformWebhookInbox',
              targetId: inbox.id,
              reasonCategory: 'EVENT_IDENTITY_CONFLICT',
            },
          })
        return { accepted: true, conflict: true }
      }
      if (inbox.status === 'RECEIVED')
        await enqueuePlatformOutbox(tx, {
          tenantId: inbox.tenantId,
          topic: platformAsaasTopic(input),
          aggregateId: inbox.id,
          payload: { inboxId: inbox.id },
          dedupeKey: 'platform-webhook:' + inbox.id,
        })
      if (inserted.count && status === 'UNROUTED')
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            action: 'webhook.unrouted',
            targetType: 'PlatformWebhookInbox',
            targetId: inbox.id,
            reasonCategory: 'DESTINATION_NOT_FOUND',
          },
        })
      return { accepted: true, duplicate: inserted.count === 0 }
    })
  }
}
