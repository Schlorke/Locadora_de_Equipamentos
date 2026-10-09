import { createBoletoOverdueAlerts } from '@gb-locacoes/backend/billing'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron } from '@/lib/security/tenant-cron'
import { withTenantTransaction } from '@/lib/tenant'
import { logger } from '@/lib/logger'

async function runJob(context: { tenantId: string }) {
  return scheduledJobResponse(
    await createBoletoOverdueAlerts({ withTenantTransaction, logger }).runJob(
      context
    )
  )
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'boleto-overdue-alerts' })
}
