import { getServerSession } from '@/lib/application-session'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { handleConfiguredOnboarding } from '@gb-locacoes/backend/runtime'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin)
    return new Response(crossOrigin.body, {
      status: crossOrigin.status,
      headers: {
        'Content-Type':
          crossOrigin.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'private, no-store',
        Vary: crossOrigin.headers.get('Vary')
          ? `${crossOrigin.headers.get('Vary')}, Cookie, Host`
          : 'Cookie, Host',
      },
    })
  const session = await getServerSession()
  if (!session?.user?.id)
    return Response.json(
      { error: 'Authentication required' },
      {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  return handleConfiguredOnboarding(request, session.user.id, 'create')
}
