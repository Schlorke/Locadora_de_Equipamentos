import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { OperationsTransaction } from './types'
export function createAuditReadService({
  withTenantTransaction,
}: {
  withTenantTransaction: OperationsTransaction
}) {
  async function getAuditLogs(
    context: TenantContext,
    {
      userId,
      entity,
      entityId,
      action,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    }: {
      userId?: string
      entity?: string
      entityId?: string
      action?: string
      startDate?: Date
      endDate?: Date
      limit?: number
      offset?: number
    }
  ) {
    const where: {
      tenantId: string
      userId?: string
      entity?: string
      entityId?: string
      action?: string
      createdAt?: { gte?: Date; lte?: Date }
    } = { tenantId: context.tenantId }

    if (userId) where.userId = userId
    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId
    if (action) where.action = action
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [logs, total] = await withTenantTransaction(context, (tx) =>
      Promise.all([
        tx.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        tx.auditLog.count({ where }),
      ])
    )

    return { logs, total }
  }
  return { getAuditLogs }
}
export type AuditReadService = ReturnType<typeof createAuditReadService>
