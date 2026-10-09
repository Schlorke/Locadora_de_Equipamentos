import { createAutoConvertApprovedQuotesJob } from '@gb-locacoes/backend/http'
import { runTenantCron } from '@/lib/security/tenant-cron'
import { autoConvertApprovedQuotes } from '@/lib/quote-payment-conversion'
async function runJob(context: { tenantId: string }) {
  return createAutoConvertApprovedQuotesJob({
    autoConvertApprovedQuotes,
  }).runJob(context)
}
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'auto-convert-quotes' })
}
