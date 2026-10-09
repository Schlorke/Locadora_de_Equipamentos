import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { readOnboardingStatus } from '../../../../host/onboarding-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: Request) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok)
    return new Response(access.response.body, {
      status: access.response.status,
      headers: {
        'Content-Type':
          access.response.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'private, no-store',
        Vary: access.response.headers.get('Vary')
          ? `${access.response.headers.get('Vary')}, Cookie, Host`
          : 'Cookie, Host',
      },
    })
  if (access.principal.role !== 'ADMIN')
    return Response.json(
      { error: 'Owner required', code: 'OWNER_REQUIRED' },
      {
        status: 403,
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  return readOnboardingStatus(request, access.principal)
}
