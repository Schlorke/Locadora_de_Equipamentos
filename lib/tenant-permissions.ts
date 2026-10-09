import { createTenantPermissionResolver } from '@gb-locacoes/backend/identity'
import type { TenantPrincipalResolution } from '@gb-locacoes/backend/identity'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const tenantPermission = createTenantPermissionResolver({
  resolveTenantPrincipal,
  getDatabase: () => prisma,
})

export async function requireTenantPermission(
  request: Request,
  module: string,
  action: string
): Promise<TenantPrincipalResolution> {
  return tenantPermission(request, module, action)
}
