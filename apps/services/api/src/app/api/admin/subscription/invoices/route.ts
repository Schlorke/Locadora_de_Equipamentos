import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { readOwnerInvoices } from '../../../../../host/subscription-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Host',
}
export async function GET(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok)
      return new Response(access.response.body, {
        status: access.response.status,
        headers: {
          ...privateHeaders,
          'Content-Type':
            access.response.headers.get('Content-Type') ?? 'application/json',
          ...(access.response.headers.has('Retry-After')
            ? {
                'Retry-After':
                  access.response.headers.get('Retry-After') ?? '0',
              }
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
    return await readOwnerInvoices(access.principal)
  } catch {
    return Response.json(
      { error: 'Não foi possível consultar a assinatura.' },
      { status: 503, headers: privateHeaders }
    )
  }
}
