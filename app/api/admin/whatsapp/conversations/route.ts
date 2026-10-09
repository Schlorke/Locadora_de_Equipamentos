import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'
import { listConversations } from '@/lib/whatsapp-read'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/whatsapp/conversations
 * Query: limit, offset, search (phone ou displayName).
 * Retorna conversas ordenadas por lastMessageAt desc.
 */
export async function GET(request: NextRequest) {
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
  return listConversations(auth.principal, request)
}
