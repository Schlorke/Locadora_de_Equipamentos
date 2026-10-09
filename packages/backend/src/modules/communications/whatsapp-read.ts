import type { WhatsAppConversation } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'

function conversationDto(
  conversation: WhatsAppConversation & { _count: { messages: number } }
) {
  return {
    id: conversation.id,
    phone: conversation.phone,
    displayName: conversation.displayName,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count.messages,
  }
}

export function createWhatsAppReader({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function listConversations(
    context: TenantContext,
    {
      limit,
      offset,
      search,
    }: { limit: number; offset: number; search?: string }
  ) {
    const filter = search
      ? {
          OR: [
            { phone: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined
    const where = { tenantId: context.tenantId, ...filter }
    const [conversations, total] = await withTenantTransaction(
      context,
      (prisma) =>
        Promise.all([
          prisma.whatsAppConversation.findMany({
            where,
            orderBy: { lastMessageAt: 'desc' },
            take: limit,
            skip: offset,
            include: { _count: { select: { messages: true } } },
          }),
          prisma.whatsAppConversation.count({ where }),
        ])
    )
    return { conversations: conversations.map(conversationDto), total }
  }

  async function readConversation(
    context: TenantContext,
    conversationId: string
  ) {
    const conversation = await withTenantTransaction(context, (prisma) =>
      prisma.whatsAppConversation.findFirst({
        where: { id: conversationId, tenantId: context.tenantId },
        include: { _count: { select: { messages: true } } },
      })
    )
    return conversation ? conversationDto(conversation) : null
  }

  async function readMessages(
    context: TenantContext,
    conversationId: string,
    { limit, beforeParam }: { limit: number; beforeParam: string | null }
  ) {
    const conversation = await withTenantTransaction(context, (prisma) =>
      prisma.whatsAppConversation.findFirst({
        where: { id: conversationId, tenantId: context.tenantId },
      })
    )
    if (!conversation) return null

    const before = beforeParam ? new Date(beforeParam) : undefined
    const validBefore =
      before && Number.isFinite(before.getTime()) ? before : undefined
    const messages = await withTenantTransaction(context, (prisma) =>
      prisma.whatsAppMessage.findMany({
        where: {
          conversationId,
          tenantId: context.tenantId,
          ...(validBefore && { timestamp: { lt: validBefore } }),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })
    )
    const items = messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      providerMessageId: m.providerMessageId,
      direction: m.direction,
      type: m.type,
      body: m.body,
      mediaUrl: m.mediaUrl,
      timestamp: m.timestamp.toISOString(),
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }))
    return { messages: items.reverse() }
  }

  return { listConversations, readConversation, readMessages }
}
