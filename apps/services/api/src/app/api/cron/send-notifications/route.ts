import { createNotificationJob } from '@gb-locacoes/backend/communications'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron } from '../../../../host/tenant-cron'
import { withTenantTransaction } from '../../../../host/tenant-transaction'

async function runJob(context: { tenantId: string }) {
  return scheduledJobResponse(
    await createNotificationJob({ withTenantTransaction }).runJob(context)
  )
}
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'send-notifications' })
}
