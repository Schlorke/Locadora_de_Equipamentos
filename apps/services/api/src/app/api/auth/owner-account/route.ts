import { getServerSession } from '../../../../host/session'
import { ownerAccountHandlers } from '../../../../host/credential-accounts'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: Request) {
  const session = await getServerSession()
  if (!session?.user?.id)
    return Response.json(
      { error: 'Authentication required' },
      {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  return ownerAccountHandlers.read(request, session.user.id)
}
