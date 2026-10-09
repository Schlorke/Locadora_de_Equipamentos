import { merchantUnavailableResponse } from '@gb-locacoes/backend/http'
import { resolveTenantPrincipal } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  if (access.principal.role !== 'ADMIN')
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return merchantUnavailableResponse()
}

export async function DELETE(request: Request) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  if (access.principal.role !== 'ADMIN')
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return merchantUnavailableResponse()
}
