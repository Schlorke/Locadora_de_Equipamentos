import { createBoletoVerificationJob } from '@gb-locacoes/backend/billing'
import { scheduledJobResponse } from '@gb-locacoes/backend/http'
import { runTenantCron, type CronBudget } from '../../../../host/tenant-cron'
import { withTenantTransaction } from '../../../../host/tenant-transaction'
import { verifyTenantBoleto } from '../../../../host/payment-webhooks'
import { processPayment } from '../../../../host/payment-webhooks'

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
