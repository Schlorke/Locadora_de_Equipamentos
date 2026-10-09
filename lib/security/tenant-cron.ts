import { createTenantCron } from '@gb-locacoes/backend/http'
import { prisma } from '@/lib/prisma'
import { withTenantTransaction } from '@/lib/tenant'
export type { CronBudget } from '@gb-locacoes/backend/http'
const runner = createTenantCron({
  getDatabase: () => prisma,
  withTenantTransaction,
})
export function runTenantCron(
  request: Request,
  job: Parameters<typeof runner.runTenantCron>[1],
  options: Parameters<typeof runner.runTenantCron>[2]
): Promise<Response> {
  return runner.runTenantCron(request, job, options)
}
