import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { syncAdminAlerts } from '../../../../../host/communications'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
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
  if (access.principal.role !== 'ADMIN')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return NextResponse.json(await syncAdminAlerts(access.principal))
}
