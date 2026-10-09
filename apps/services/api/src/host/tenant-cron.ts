import {
  createTenantCron,
  requireCronAuthorization as sharedCronAuthorization,
} from '@gb-locacoes/backend/http'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { withTenantTransaction } from './tenant-transaction'
export type { CronBudget } from '@gb-locacoes/backend/http'
const runner = createTenantCron({
  getDatabase: () => getDatabaseRuntime().prisma,
  withTenantTransaction,
})
export function runTenantCron(
  request: Request,
  job: Parameters<typeof runner.runTenantCron>[1],
  options: Parameters<typeof runner.runTenantCron>[2]
): Promise<Response> {
  return runner.runTenantCron(request, job, options)
}
export function requireCronAuthorization(request: Request): Response | null {
  return sharedCronAuthorization(request)
}
