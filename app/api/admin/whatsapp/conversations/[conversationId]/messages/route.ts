import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'
import { readMessages } from '@/lib/whatsapp-read'
import { sendConversationMessage } from '@/lib/whatsapp-write'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/whatsapp/conversations/[conversationId]/messages
 * Query: limit, before (cursor ISO timestamp).
 * Retorna mensagens da conversa ordenadas por timestamp desc (mais recentes primeiro).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) {
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  }
  // Origem irmã explícita continua recusada também nas leituras (onda 49).
  const crossOrigin = rejectExplicitCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  return readMessages(auth.principal, request, context)
}

/**
 * POST /api/admin/whatsapp/conversations/[conversationId]/messages
 * Body: { text: string }.
 * Envia mensagem via Meta API e persiste no Prisma.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success)
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  return sendConversationMessage(auth.principal, request, context)
}
