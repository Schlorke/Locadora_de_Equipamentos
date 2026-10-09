import { createAuditReadService } from '@gb-locacoes/backend/operations'
import { withTenantTransaction } from '@/lib/tenant'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { Prisma } from '@prisma/client'

export interface AuditLogData {
  userId?: string
  action: string
  entity: string
  entityId: string
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  ipAddress?: string
  userAgent?: string
}

/**
 * Registra uma ação no log de auditoria
 */
export async function logAuditAction(
  context: TenantContext,
  data: AuditLogData
): Promise<void> {
  try {
    await withTenantTransaction(context, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          changes: data.changes as Prisma.InputJsonValue | undefined,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      })
    )
  } catch (error) {
    // Não falhar a operação principal se o log falhar
    console.error('Error logging audit action:', error)
  }
}

/**
 * Busca logs de auditoria
 */
export const { getAuditLogs } = createAuditReadService({
  withTenantTransaction,
})
