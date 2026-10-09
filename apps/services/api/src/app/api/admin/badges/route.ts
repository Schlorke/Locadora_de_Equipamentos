import { NextRequest, NextResponse } from 'next/server'
import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { readAdminBadges } from '../../../../host/communications'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
const roles = ['ADMIN', 'OPERATOR']
export async function GET(request: NextRequest) {
  const access = await resolveTenantPrincipal(request)
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
  // Origem irmã explícita continua recusada também neste GET (onda 45).
  const crossOrigin = rejectExplicitCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  try {
    return NextResponse.json(
      await readAdminBadges(access.principal, access.principal.userId)
    )
  } catch (error) {
    console.error('[GET /api/admin/badges] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao obter contagens' },
      { status: 500 }
    )
  }
}
