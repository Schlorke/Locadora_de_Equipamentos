import { handleIdentityRequest } from '../../../../../host/session'
import { identityMode } from '@gb-locacoes/backend/identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function handler(request: Request) {
  if (identityMode(process.env) === 'better-auth')
    return Response.json(
      { error: 'Use /api/auth after cutover' },
      { status: 410 }
    )
  return handleIdentityRequest(request)
}

export { handler as GET, handler as POST }
