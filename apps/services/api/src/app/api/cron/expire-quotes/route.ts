import { createCheckAndExpireQuotesJob } from '@gb-locacoes/backend/http'
import { runTenantCron } from '../../../../host/tenant-cron'
import { checkAndExpireQuotes } from '../../../../host/quotations'
async function runJob(context: { tenantId: string }) {
  return createCheckAndExpireQuotesJob({ checkAndExpireQuotes }).runJob(context)
}

export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'expire-quotes' })
}
