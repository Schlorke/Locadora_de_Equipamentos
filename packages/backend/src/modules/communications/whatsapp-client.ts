import { integrationCredentialReference } from '../../runtime/index'
import { createSubscriptionCommandAccess } from '../entitlements/command-admission'
import type { WhatsAppMessageType } from '@prisma/client'
import type { TenantTransactionRunner } from '../rentals/index'
import type { createIntegrationCredentialResolver } from '../../runtime/index'
const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0'
/** Normaliza número para formato Meta (apenas dígitos, sem +). */
export function normalizePhoneForApi(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0+/, '')
}

/** E.164: garante 55 para Brasil se não tiver código de país. Evita duplicar 55. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.startsWith('55')) return `+${digits}`
  if (digits.length >= 10) return `+55${digits}`
  return `+${digits}`
}

export interface SendTextMessageResult {
  providerMessageId: string
  conversationId: string
  messageId: string
}

/**
 * Envia mensagem de texto via Meta WhatsApp Cloud API e persiste no Prisma
 * (conversa + mensagem OUTBOUND) para histórico no painel admin.
 */

export function createWhatsAppClient({
  withTenantTransaction,
  resolveIntegrationCredential,
  fetch = (...args) => globalThis.fetch(...args),
}: {
  withTenantTransaction: TenantTransactionRunner
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
  fetch?: typeof globalThis.fetch
}) {
  async function whatsappIntegration(context: { tenantId: string }) {
    const integrations = await withTenantTransaction(context, (tx) =>
      tx.tenantIntegration.findMany({
        where: {
          tenantId: context.tenantId,
          provider: 'WHATSAPP',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        },
      })
    )
    const integration = integrations.length === 1 ? integrations[0] : null
    if (
      !integration?.externalAccountId ||
      !/^[0-9]+$/.test(integration.externalAccountId)
    )
      throw new Error('WHATSAPP_INTEGRATION_UNAVAILABLE')
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(integration)
    )
    if (!credential?.apiKey) throw new Error('WHATSAPP_CREDENTIAL_UNAVAILABLE')
    return {
      phoneNumberId: integration.externalAccountId,
      token: credential.apiKey,
    }
  }

  async function sendTextMessage(
    context: { tenantId: string },
    to: string,
    text: string
  ): Promise<SendTextMessageResult> {
    if (!text.trim() || text.length > 4096)
      throw new Error('INVALID_WHATSAPP_MESSAGE')
    const { phoneNumberId, token } = await whatsappIntegration(context)
    const toNumber = normalizePhoneForApi(to)
    if (!/^[0-9]{8,15}$/.test(toNumber))
      throw new Error('INVALID_WHATSAPP_RECIPIENT')
    const message = await withTenantTransaction(context, async (tx) => {
      await createSubscriptionCommandAccess()(tx, context, {
        feature: 'whatsapp',
      })
      const phone = toE164(to)
      const conversation = await tx.whatsAppConversation.upsert({
        where: { tenantId_phone: { tenantId: context.tenantId, phone } },
        create: {
          tenantId: context.tenantId,
          phone,
          lastMessageAt: new Date(),
        },
        update: { lastMessageAt: new Date() },
      })
      return tx.whatsAppMessage.create({
        data: {
          tenantId: context.tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          type: 'TEXT',
          body: text,
          timestamp: new Date(),
          status: 'processing',
        },
      })
    })
    try {
      const response = await fetch(
        `${META_GRAPH_BASE}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toNumber,
            type: 'text',
            text: { body: text },
          }),
        }
      )
      if (!response.ok) throw new Error('WHATSAPP_DELIVERY_UNCONFIRMED')
      const data = (await response.json()) as {
        messages?: Array<{ id?: string }>
      }
      const providerMessageId = data.messages?.[0]?.id
      if (!providerMessageId) throw new Error('WHATSAPP_DELIVERY_UNCONFIRMED')
      await withTenantTransaction(context, (tx) =>
        tx.whatsAppMessage.updateMany({
          where: {
            id: message.id,
            tenantId: context.tenantId,
            status: 'processing',
          },
          data: { providerMessageId, status: 'sent' },
        })
      )
      return {
        providerMessageId,
        conversationId: message.conversationId,
        messageId: message.id,
      }
    } catch {
      await withTenantTransaction(context, (tx) =>
        tx.whatsAppMessage.updateMany({
          where: {
            id: message.id,
            tenantId: context.tenantId,
            status: 'processing',
          },
          data: { status: 'unknown' },
        })
      )
      throw new Error('WHATSAPP_DELIVERY_UNCONFIRMED')
    }
  }

  return { sendTextMessage }
}
// --- Webhook parse helpers (payload Meta) ---

export interface ParsedWebhookMessage {
  from: string
  providerMessageId: string
  timestamp: Date
  type: WhatsAppMessageType
  body: string
  contactName?: string
}

function mapMetaTypeToEnum(type: string): WhatsAppMessageType {
  const t = type?.toLowerCase()
  if (t === 'text') return 'TEXT'
  if (t === 'image') return 'IMAGE'
  if (t === 'audio') return 'AUDIO'
  if (t === 'video') return 'VIDEO'
  if (t === 'document') return 'DOCUMENT'
  if (t === 'sticker') return 'STICKER'
  return 'UNKNOWN'
}

function extractTextBody(msg: Record<string, unknown>): string {
  const text = msg.text
  if (
    text &&
    typeof text === 'object' &&
    typeof (text as Record<string, unknown>).body === 'string'
  ) {
    return (text as Record<string, unknown>).body as string
  }
  if (typeof msg.body === 'string') return msg.body
  return JSON.stringify(msg)
}

/**
 * Extrai mensagens recebidas do payload do webhook Meta (POST).
 * Retorna array de mensagens normalizadas; statuses e errors são ignorados aqui.
 */
export function parseWebhookMessagePayload(
  body: unknown
): ParsedWebhookMessage[] {
  const out: ParsedWebhookMessage[] = []
  if (!body || typeof body !== 'object') return out

  const root = body as Record<string, unknown>
  const entries = root.entry as unknown[]
  if (!Array.isArray(entries)) return out

  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>).changes as unknown[]
    if (!Array.isArray(changes)) continue
    for (const ch of changes) {
      const value = (ch as Record<string, unknown>).value as
        Record<string, unknown> | undefined
      if (!value || typeof value !== 'object') continue

      const messages = value.messages as unknown[]
      const contacts = (value.contacts as unknown[]) ?? []
      const contactMap = new Map<string, string>()
      for (const c of contacts) {
        if (c && typeof c === 'object') {
          const waId = (c as Record<string, unknown>).wa_id as
            string | undefined
          const profile = (c as Record<string, unknown>).profile as
            Record<string, unknown> | undefined
          const name = profile?.name as string | undefined
          if (waId && name) contactMap.set(waId, name)
        }
      }

      if (!Array.isArray(messages)) continue
      for (const m of messages) {
        if (!m || typeof m !== 'object') continue
        const msg = m as Record<string, unknown>
        const from = String(msg.from ?? '')
        const id = String(msg.id ?? '')
        const ts = msg.timestamp
        const unix = typeof ts === 'number' ? ts : parseInt(String(ts), 10)
        const timestamp = Number.isFinite(unix)
          ? new Date(unix * 1000)
          : new Date()
        const type = mapMetaTypeToEnum(String(msg.type ?? 'text'))
        const bodyText = extractTextBody(msg)
        const contactName = from ? contactMap.get(from) : undefined

        if (id && from) {
          out.push({
            from,
            providerMessageId: id,
            timestamp,
            type,
            body: bodyText,
            contactName,
          })
        }
      }
    }
  }
  return out
}

export interface ParsedWebhookStatus {
  providerMessageId: string
  status: string
}

/**
 * Extrai atualizações de status (sent, delivered, read) do payload do webhook.
 */
export function parseWebhookStatusPayload(
  body: unknown
): ParsedWebhookStatus[] {
  const out: ParsedWebhookStatus[] = []
  if (!body || typeof body !== 'object') return out

  const root = body as Record<string, unknown>
  const entries = root.entry as unknown[]
  if (!Array.isArray(entries)) return out

  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>).changes as unknown[]
    if (!Array.isArray(changes)) continue
    for (const ch of changes) {
      const value = (ch as Record<string, unknown>).value as
        Record<string, unknown> | undefined
      if (!value || typeof value !== 'object') continue

      const statuses = value.statuses as unknown[]
      if (!Array.isArray(statuses)) continue
      for (const s of statuses) {
        if (!s || typeof s !== 'object') continue
        const st = s as Record<string, unknown>
        const id = String(st.id ?? '')
        const status = String(st.status ?? '')
        if (id && status) out.push({ providerMessageId: id, status })
      }
    }
  }
  return out
}
