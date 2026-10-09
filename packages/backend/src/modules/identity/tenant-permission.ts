import type { PrismaClient } from '@prisma/client'
import { withTenantTransaction } from './tenant-principal'
import type { TenantPrincipalResolution } from './tenant-request-principal'

/** Tenant permissions are revalidated after the current membership, without a process cache. */
export function createTenantPermissionResolver(dependencies: {
  resolveTenantPrincipal(_request: Request): Promise<TenantPrincipalResolution>
  getDatabase(): PrismaClient
}) {
  return async function requireTenantPermission(
    request: Request,
    module: string,
    action: string
  ): Promise<TenantPrincipalResolution> {
    const access = await dependencies.resolveTenantPrincipal(request)
    if (!access.ok) return access
    if (access.principal.role === 'CLIENT')
      return {
        ok: false,
        response: Response.json(
          { error: 'Acesso administrativo não permitido' },
          { status: 403 }
        ),
      }
    if (access.principal.role === 'ADMIN') return access
    const allowed = await withTenantTransaction(
      dependencies.getDatabase(),
      access.principal,
      (tx) =>
        tx.permission.findFirst({
          where: {
            tenantId: access.principal.tenantId,
            role: access.principal.role,
            module,
            action,
          },
          select: { id: true },
        })
    )
    if (!allowed)
      return {
        ok: false,
        response: Response.json(
          { error: 'Permissão insuficiente nesta locadora' },
          { status: 403 }
        ),
      }
    return access
  }
}
