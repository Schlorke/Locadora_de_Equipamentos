import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { handleConfiguredSitePublication } from '@gb-locacoes/backend/runtime'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Host',
}
export async function POST(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok)
      return new Response(access.response.body, {
        status: access.response.status,
        headers: {
          ...privateHeaders,
          'Content-Type':
            access.response.headers.get('Content-Type') ?? 'application/json',
          Vary: access.response.headers.get('Vary')
            ? `${access.response.headers.get('Vary')}, Cookie, Host`
            : 'Cookie, Host',
          ...(access.response.headers.has('Retry-After')
            ? { 'Retry-After': access.response.headers.get('Retry-After')! }
            : {}),
        },
      })
    if (access.principal.role !== 'ADMIN')
      return Response.json(
        {
          error: 'Esta operação é exclusiva do dono da locadora.',
          code: 'OWNER_REQUIRED',
        },
        { status: 403, headers: privateHeaders }
      )
    return await handleConfiguredSitePublication(request, access.principal)
  } catch {
    return Response.json(
      { error: 'Não foi possível publicar o site.' },
      { status: 503, headers: privateHeaders }
    )
  }
}
