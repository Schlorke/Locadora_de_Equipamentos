import {
  resolveTenantPrincipal,
  withTenantTransaction,
  type TenantPrincipal,
} from '@/lib/tenant'
import { clientIpFromHeaders } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'VIEW'
  | 'EXPORT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SEND'

export type AuditEntity =
  | 'EQUIPMENT'
  | 'QUOTE'
  | 'RENTAL'
  | 'PAYMENT'
  | 'MAINTENANCE'
  | 'DELIVERY'
  | 'CONTRACT'
  | 'USER'
  | 'SETTINGS'
  | 'PERMISSION'
  | 'EMAIL'

/**
 * Cria um log de auditoria automaticamente
 */
export async function createAuditLog(
  context: TenantPrincipal,
  {
    action,
    entity,
    entityId,
    changes,
    ipAddress,
    userAgent,
    request,
  }: {
    action: AuditAction
    entity: AuditEntity
    entityId?: string
    changes?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
    request?: NextRequest
  }
): Promise<void> {
  try {
    // Obter IP e User-Agent do request se disponível. O IP segue a mesma
    // regra de confiança do rate limit: nunca o X-Forwarded-For cru.
    if (request) {
      ipAddress = clientIpFromHeaders(request.headers) ?? 'unknown'
      userAgent = request.headers.get('user-agent') || undefined
    }

    await withTenantTransaction(context, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action,
          entity,
          entityId: entityId ?? '',
          changes: changes ? (changes as Prisma.InputJsonValue) : undefined,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      })
    )
  } catch {
    // Não falhar a operação principal se o log falhar
    console.error('Audit log write failed')
  }
}

/**
 * Middleware helper para criar logs automaticamente
 */
export function withAuditLog(
  action: AuditAction,
  entity: AuditEntity,
  getEntityId?: (_request: NextRequest) => Promise<string | undefined>
) {
  return async (_request: NextRequest, handler: () => Promise<Response>) => {
    const access = await resolveTenantPrincipal(_request)
    if (!access.ok) return access.response
    const response = await handler()

    // Criar log apenas se a operação foi bem-sucedida
    if (response.status >= 200 && response.status < 300) {
      const entityId = getEntityId ? await getEntityId(_request) : undefined
      await createAuditLog(access.principal, {
        action,
        entity,
        entityId,
        request: _request,
      })
    }

    return response
  }
}
