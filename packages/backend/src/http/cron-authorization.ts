import { secretsMatch } from '../modules/identity/index'
export function requireCronAuthorization(request: Request): Response | null {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) {
    return Response.json(
      { error: 'Service authentication unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
  if (!secretsMatch(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return Response.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      }
    )
  }
  return null
}
