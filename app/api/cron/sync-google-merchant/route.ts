import { requireCronAuthorization } from '@/lib/security/external-request-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const denied = requireCronAuthorization(request)
  if (denied) return denied
  return Response.json(
    {
      error:
        'Google Merchant integration is quarantined until tenant-specific credentials are configured',
    },
    { status: 503 }
  )
}
