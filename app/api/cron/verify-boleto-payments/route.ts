import { createBoletoVerificationJob } from '@gb-locacoes/backend/billing'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron, type CronBudget } from '@/lib/security/tenant-cron'
import { withTenantTransaction } from '@/lib/tenant'
import { verifyTenantBoleto } from '@/lib/security/tenant-boleto-verification'
import { processPayment } from '@/lib/payment-processor'

async function runJob(context: { tenantId: string }, budget: CronBudget) {
  return scheduledJobResponse(
    await createBoletoVerificationJob({
      withTenantTransaction,
      verifyTenantBoleto,
      processPayment,
    }).runJob(context, budget)
  )
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300
export function GET(request: Request) {
  return runTenantCron(request, runJob, {
    job: 'verify-boleto-payments',
    checkpoint: 'verify-boleto-payments',
    budgetMs: 180000,
    minRemainingMs: 60000,
  })
}
