import { requireCronAuthorization } from '@/lib/security/external-request-auth'
import { runConfiguredPlatformJobs } from '@gb-locacoes/backend/runtime'

export const runtime = 'nodejs'
export const maxDuration = 300
export async function GET(request: Request) {
  const denied = requireCronAuthorization(request)
  if (denied) return denied
  const result = await runConfiguredPlatformJobs()
  return Response.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
