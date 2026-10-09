import { requireCronAuthorization } from '../../../../host/tenant-cron'
import { dispatchScheduledOutbox } from '../../../../host/outbox'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function GET(request: Request) {
  const denied = requireCronAuthorization(request)
  if (denied) return denied
  return Response.json(await dispatchScheduledOutbox())
}
