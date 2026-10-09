import { WhatsAppEvent } from '@gb-locacoes/contracts/whatsapp'
import {
  parseWebhookMessagePayload,
  parseWebhookStatusPayload,
  toE164,
} from './whatsapp-client'
import type { AuthenticatedTenantWebhook } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
export function createWhatsAppWebhookConsumer({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function consumeWebhook(authenticated: AuthenticatedTenantWebhook) {
    const parsed = WhatsAppEvent.safeParse(authenticated.body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { context, integration } = authenticated
    if (
      !integration.externalAccountId ||
      parsed.data.entry.some((entry) =>
        entry.changes.some(
          (change) =>
            change.value.metadata.phone_number_id !==
            integration.externalAccountId
        )
      )
    ) {
      return Response.json(
        { error: 'Webhook account mismatch' },
        { status: 403 }
      )
    }
    const messages = parseWebhookMessagePayload(parsed.data)
    const statuses = parseWebhookStatusPayload(parsed.data)

    try {
      await withTenantTransaction(context, async (prisma) => {
        for (const msg of messages) {
          const phoneE164 = toE164(msg.from)
          const conversation = await prisma.whatsAppConversation.upsert({
            where: {
              tenantId_phone: { tenantId: context.tenantId, phone: phoneE164 },
            },
            create: {
              tenantId: context.tenantId,
              phone: phoneE164,
              displayName: msg.contactName ?? undefined,
              lastMessageAt: msg.timestamp,
            },
            update: {
              displayName: msg.contactName ?? undefined,
              lastMessageAt: msg.timestamp,
            },
          })

          await prisma.whatsAppMessage.upsert({
            where: {
              tenantId_providerMessageId: {
                tenantId: context.tenantId,
                providerMessageId: msg.providerMessageId,
              },
            },
            create: {
              tenantId: context.tenantId,
              conversationId: conversation.id,
              providerMessageId: msg.providerMessageId,
              direction: 'INBOUND',
              type: msg.type,
              body: msg.body,
              timestamp: msg.timestamp,
            },
            update: {},
          })
        }

        for (const st of statuses) {
          await prisma.whatsAppMessage.updateMany({
            where: {
              tenantId: context.tenantId,
              providerMessageId: st.providerMessageId,
            },
            data: { status: st.status },
          })
        }
      })
    } catch (e) {
      console.error('[webhooks/whatsapp] Persist error:', e)
      return Response.json({ error: 'Persist failed' }, { status: 500 })
    }

    return Response.json({ ok: true }, { status: 200 })
  }

  return { consumeWebhook }
}
