import { createBoletoOverdueAlerts } from '@gb-locacoes/backend/billing'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron } from '../../../../host/tenant-cron'
import { withTenantTransaction } from '../../../../host/tenant-transaction'
import { createApplicationLogger } from '@gb-locacoes/backend/runtime'

async function runJob(context: { tenantId: string }) {
  return scheduledJobResponse(
    await createBoletoOverdueAlerts({
      withTenantTransaction,
      logger: createApplicationLogger(process.env),
    }).runJob(context)
  )
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'boleto-overdue-alerts' })
}
