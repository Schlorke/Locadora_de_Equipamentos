import { createCheckAndExpireQuotesJob } from '@gb-locacoes/backend/http'
import { runTenantCron } from '@/lib/security/tenant-cron'
import { checkAndExpireQuotes } from '@/lib/quote-validity'
async function runJob(context: { tenantId: string }) {
  return createCheckAndExpireQuotesJob({ checkAndExpireQuotes }).runJob(context)
}

export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'expire-quotes' })
}
