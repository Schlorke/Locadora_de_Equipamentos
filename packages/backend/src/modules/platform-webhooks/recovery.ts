import { parseAsaasEvent, isKnownAsaasEvent } from '../billing/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { platformAsaasDestination, platformAsaasTopic } from './routing'

/** Only receipts authenticated at root ingress can be recovered; hashes/payload/identity never change. */
export function createPlatformAsaasRecovery(
  transaction: PlatformTransaction,
  environment: 'sandbox' | 'production'
) {
  return () =>
    transaction(async (tx) => {
      // Coarse binding prefilter prevents old unresolved receipts starving newer routable ones.
      // Destination validation remains shared with ingress, not a second routing policy in SQL.
      const receipts = await tx.$queryRaw<{ id: string }[]>`
      SELECT i.id FROM platform_webhook_inbox i WHERE i.source='ASAAS_ROOT' AND i.status='UNROUTED'
      AND i."sourceEnvironment"=${environment}
      AND (left(i."eventType",8)='PAYMENT_' OR left(i."eventType",13)='SUBSCRIPTION_')
      AND EXISTS (SELECT 1 FROM subscriptions s WHERE s."billingMode"='ASAAS' AND s."providerEnvironment"=${environment}
        AND (s."providerSubscriptionId"=COALESCE(i.payload->'payment'->>'subscription',i.payload->'subscription'->>'id')
          OR ('sub:'||s.id)=COALESCE(i.payload->'payment'->>'externalReference',i.payload->'subscription'->>'externalReference')
          OR EXISTS (SELECT 1 FROM platform_invoices f WHERE f."subscriptionId"=s.id
            AND ('inv:'||f.id)=COALESCE(i.payload->'payment'->>'externalReference',i.payload->'subscription'->>'externalReference'))))
      ORDER BY i."receivedAt",i.id LIMIT 20 FOR UPDATE OF i SKIP LOCKED`
      let recovered = 0
      for (const { id } of receipts) {
        const receipt = await tx.platformWebhookInbox.findUniqueOrThrow({
          where: { id },
        })
        const parsed = parseAsaasEvent(receipt.payload)
        if (
          !parsed.ok ||
          !isKnownAsaasEvent(parsed.event.type) ||
          !['PAYMENT', 'SUBSCRIPTION'].includes(parsed.event.category)
        )
          continue
        const input = {
          source: 'ASAAS_ROOT' as const,
          body: receipt.payload,
          payloadHash: receipt.payloadHash,
        }
        const target = await platformAsaasDestination(tx, input, environment)
        if (!target) continue
        const changed = await tx.platformWebhookInbox.updateMany({
          where: { id, source: 'ASAAS_ROOT', status: 'UNROUTED' },
          data: {
            status: 'RECEIVED',
            tenantId: target.tenantId,
            routeKey: target.routeKey,
            lastError: null,
          },
        })
        if (!changed.count) continue
        await enqueuePlatformOutbox(tx, {
          tenantId: target.tenantId,
          topic: platformAsaasTopic(input),
          aggregateId: id,
          payload: { inboxId: id },
          dedupeKey: 'platform-webhook:' + id,
        })
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'SYSTEM',
            tenantId: target.tenantId,
            action: 'webhook.route.recovered',
            targetType: 'PlatformWebhookInbox',
            targetId: id,
            reasonCategory: 'DESTINATION_NOW_AVAILABLE',
          },
        })
        recovered++
      }
      return recovered
    })
}
