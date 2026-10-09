import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { createWhatsAppReader } from '../modules/communications/whatsapp-read'

type ConversationParams = { params: Promise<{ conversationId: string }> }

export function createWhatsAppReadHandlers({
  reader,
}: {
  reader: ReturnType<typeof createWhatsAppReader>
}) {
  async function listConversations(context: TenantContext, request: Request) {
    const { searchParams } = new URL(request.url)
    const limit = Math.max(
      1,
      Math.min(Number(searchParams.get('limit')) || 50, 100)
    )
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
    const search = searchParams.get('search')?.trim()
    try {
      return Response.json(
        await reader.listConversations(context, { limit, offset, search })
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar conversas'
      return Response.json({ error: msg }, { status: 500 })
    }
  }

  async function readConversation(
    context: TenantContext,
    { params }: ConversationParams
  ) {
    const { conversationId } = await params
    if (!conversationId)
      return Response.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      )
    try {
      const conversation = await reader.readConversation(
        context,
        conversationId
      )
      if (!conversation)
        return Response.json(
          { error: 'Conversa não encontrada' },
          { status: 404 }
        )
      return Response.json(conversation)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar conversa'
      return Response.json({ error: msg }, { status: 500 })
    }
  }

  async function readMessages(
    context: TenantContext,
    request: Request,
    { params }: ConversationParams
  ) {
    const { conversationId } = await params
    if (!conversationId)
      return Response.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      )
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const beforeParam = searchParams.get('before')
    try {
      const messages = await reader.readMessages(context, conversationId, {
        limit,
        beforeParam,
      })
      if (!messages)
        return Response.json(
          { error: 'Conversa não encontrada' },
          { status: 404 }
        )
      return Response.json(messages)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar mensagens'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { listConversations, readConversation, readMessages }
}
