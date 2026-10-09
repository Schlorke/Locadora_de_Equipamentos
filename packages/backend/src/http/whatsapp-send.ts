import { WhatsAppTextRequest } from '@gb-locacoes/contracts/whatsapp'
import { SubscriptionCommandError } from '../modules/entitlements/command-admission'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { createWhatsAppClient } from '../modules/communications/whatsapp-client'
import type { TenantTransactionRunner } from '../modules/rentals/index'
type Sender = ReturnType<typeof createWhatsAppClient>['sendTextMessage']
function subscriptionResponse(error: SubscriptionCommandError) {
  return Response.json(error.body, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
  })
}
export function createWhatsAppSendHandlers({
  sendTextMessage,
  withTenantTransaction,
}: {
  sendTextMessage: Sender
  withTenantTransaction: TenantTransactionRunner
}) {
  async function sendTextRequest(context: TenantContext, request: Request) {
    const parsed = WhatsAppTextRequest.safeParse(await request.json())
    if (!parsed.success)
      return Response.json({ error: 'Mensagem inválida' }, { status: 400 })
    if (parsed.data.templateId || parsed.data.variables)
      return Response.json(
        {
          error: 'Templates requerem configuração específica da integração',
          code: 'WHATSAPP_TEMPLATE_UNAVAILABLE',
        },
        { status: 503 }
      )
    try {
      const message = await sendTextMessage(
        context,
        parsed.data.to,
        parsed.data.message
      )
      return Response.json({
        success: true,
        messageId: message.providerMessageId,
      })
    } catch (error) {
      if (error instanceof SubscriptionCommandError)
        return subscriptionResponse(error)
      throw error
    }
  }
  async function sendConversationMessage(
    context: TenantContext,
    request: Request,
    { params }: { params: Promise<{ conversationId: string }> }
  ) {
    const { conversationId } = await params
    if (!conversationId) {
      return Response.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      )
    }

    let body: { text?: string }
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return Response.json(
        { error: 'Campo text é obrigatório' },
        { status: 400 }
      )
    }

    try {
      const conversation = await withTenantTransaction(context, (prisma) =>
        prisma.whatsAppConversation.findFirst({
          where: { id: conversationId, tenantId: context.tenantId },
        })
      )
      if (!conversation) {
        return Response.json(
          { error: 'Conversa não encontrada' },
          { status: 404 }
        )
      }

      const result = await sendTextMessage(context, conversation.phone, text)

      const message = await withTenantTransaction(context, (prisma) =>
        prisma.whatsAppMessage.findFirst({
          where: { id: result.messageId, tenantId: context.tenantId },
        })
      )

      return Response.json({
        id: result.messageId,
        conversationId: result.conversationId,
        providerMessageId: result.providerMessageId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        body: text,
        timestamp:
          message?.timestamp?.toISOString() ?? new Date().toISOString(),
        status: 'sent',
      })
    } catch (e) {
      if (e instanceof SubscriptionCommandError) return subscriptionResponse(e)
      const msg = e instanceof Error ? e.message : 'Erro ao enviar mensagem'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { sendTextRequest, sendConversationMessage }
}
