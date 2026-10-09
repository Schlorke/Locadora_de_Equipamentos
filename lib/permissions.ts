import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { withTenantTransaction } from '@/lib/tenant'
import { Role } from '@prisma/client'

export type Module =
  | 'EQUIPMENTS'
  | 'QUOTES'
  | 'RENTALS'
  | 'FINANCIAL'
  | 'MAINTENANCE'
  | 'LOGISTICS'
  | 'CONTRACTS'
  | 'SETTINGS'
  | 'USERS'

export type Action = 'READ' | 'WRITE' | 'DELETE' | 'APPROVE' | 'MANAGE'

/**
 * Verifica se um usuário tem permissão para uma ação específica
 */
export async function hasPermission(
  context: TenantContext,
  role: Role,
  module: Module,
  action: Action
): Promise<boolean> {
  if (!context?.tenantId?.trim()) throw new Error('Tenant context required')
  // Admin tem todas as permissões
  if (role === 'ADMIN') {
    return true
  }

  // Verificar permissão específica
  const permission = await withTenantTransaction(context, (prisma) =>
    prisma.permission.findFirst({
      where: {
        tenantId: context.tenantId,
        role,
        module,
        action,
      },
    })
  )

  return !!permission
}
