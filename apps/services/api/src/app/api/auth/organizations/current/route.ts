import { readCurrentOrganizationMembership } from '@gb-locacoes/backend/identity'
import {
  organizationCurrentResponse as reply,
  rejectExplicitCrossOrigin,
} from '@gb-locacoes/backend/http'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { resolveCurrentOrganizationTenant } from '../../../../../host/runtime'
import { getServerSession } from '../../../../../host/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const tenant = await resolveCurrentOrganizationTenant(request)
    if (!tenant.ok) return tenant.response
    const session = await getServerSession()
    if (!session?.user?.id)
      return reply({ error: 'Authentication required' }, 401)
    const userId = session.user.id
    // Only consumer: the client area on this tenant host (same origin). Explicit foreign Origin is refused after the
    // host and the session, before the membership (wave 133, finding 149).
    const crossOrigin = rejectExplicitCrossOrigin(request)
    if (crossOrigin) return crossOrigin
    const result = await readCurrentOrganizationMembership(
      getDatabaseRuntime().prisma,
      tenant.context.tenantId,
      userId
    )
    return reply(result.body, result.status)
  } catch (error) {
    console.error('Erro ao consultar vínculo da locadora do host:', error)
    return reply({ error: 'Organization selection unavailable' }, 503)
  }
}
