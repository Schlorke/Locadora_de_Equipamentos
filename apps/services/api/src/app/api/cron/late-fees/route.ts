import { createCalculateAndApplyLateFeesJob } from '@gb-locacoes/backend/http'
import { runTenantCron } from '../../../../host/tenant-cron'
import { calculateAndApplyLateFees } from '../../../../host/quotations'
async function runJob(context: { tenantId: string }) {
  return createCalculateAndApplyLateFeesJob({
    calculateAndApplyLateFees,
  }).runJob(context)
}

export function GET(request: Request) {
  return runTenantCron(request, runJob, { job: 'late-fees' })
}
