import { createTenantPermissionResolver } from '@gb-locacoes/backend/identity'
import type { TenantPrincipalResolution } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { resolveTenantPrincipal } from './private-identity'

const tenantPermission = createTenantPermissionResolver({
  resolveTenantPrincipal,
  getDatabase: () => getDatabaseRuntime().prisma,
})

export async function requireTenantPermission(
  request: Request,
  module: string,
  action: string
): Promise<TenantPrincipalResolution> {
  return tenantPermission(request, module, action)
}
