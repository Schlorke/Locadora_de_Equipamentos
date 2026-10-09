import { NextRequest, NextResponse } from 'next/server'
import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { readConversation } from '../../../../../../host/whatsapp-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const roles = ['ADMIN', 'OPERATOR']
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const access = await resolveTenantPrincipal(_request)
  if (!access.ok)
    return new NextResponse(access.response.body, {
      status: access.response.status,
      headers: {
        'Content-Type': 'application/json',
        ...(access.response.headers.get('Cache-Control') === 'private, no-store'
          ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' }
          : {}),
      },
    })
  if (!roles.includes(access.principal.role))
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  // Origem irmã explícita continua recusada também nas leituras (onda 49).
  const crossOrigin = rejectExplicitCrossOrigin(_request)
  if (crossOrigin) return crossOrigin
  return readConversation(access.principal, context)
}
