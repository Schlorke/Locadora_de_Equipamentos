import { withTenantTransaction as run } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

/** Bind the shared RLS runner to this HTTP process, without a second pool. */
export function withTenantTransaction<T>(
  context: Parameters<typeof run>[1],
  operation: Parameters<typeof run<T>>[2],
  options?: Parameters<typeof run<T>>[3]
) {
  return run(getDatabaseRuntime().prisma, context, operation, options)
}
