import { getServerSession } from '@/lib/application-session'
import { prisma } from '@/lib/prisma'
import { listActiveOrganizationMemberships } from '@gb-locacoes/backend/identity'
import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: Request) {
  const session = await getServerSession()
  if (!session?.user?.id)
    return Response.json(
      { error: 'Authentication required' },
      { status: 401, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
    )
  // Account read without a cross-origin consumer (panel selector on `app`, native app): explicit foreign Origin is
  // refused after the session and before the memberships (wave 133, finding 149).
  const crossOrigin = rejectExplicitCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  const memberships = await listActiveOrganizationMemberships(
    prisma,
    session.user.id
  )
  return Response.json(
    {
      memberships,
    },
    { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
  )
}
