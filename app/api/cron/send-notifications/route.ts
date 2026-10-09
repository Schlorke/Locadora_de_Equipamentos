import { createNotificationJob } from '@gb-locacoes/backend/communications'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron } from '@/lib/security/tenant-cron'
import { withTenantTransaction } from '@/lib/tenant'

async function runJob(context: { tenantId: string }) {
  return scheduledJobResponse(
    await createNotificationJob({ withTenantTransaction }).runJob(context)
  )
}
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'send-notifications' })
}
