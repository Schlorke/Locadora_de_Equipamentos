import {
  createTenantPrincipalResolver,
  type MutationRequest,
  type TenantPrincipalResolution,
} from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { getServerSession } from './session'
import { resolvePublicTenant } from './runtime'

const privatePrincipal = createTenantPrincipalResolver({
  getSession: getServerSession,
  getDatabase: () => getDatabaseRuntime().prisma,
  resolvePublicTenant,
})

export async function resolveTenantPrincipal(
  request: MutationRequest
): Promise<TenantPrincipalResolution> {
  return privatePrincipal(request)
}
