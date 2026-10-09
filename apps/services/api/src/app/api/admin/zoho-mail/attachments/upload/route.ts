import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { uploadAttachments } from '../../../../../../host/communications'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const roles = ['ADMIN', 'OPERATOR']
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
  if (!roles.includes(access.principal.role))
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return uploadAttachments(access.principal, access.principal.userId, request)
}
