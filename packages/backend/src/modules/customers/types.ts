import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

/**
 * Transação por locadora da API pública de identity (`withTenantTransaction`
 * com `app.tenant_id` local), já ligada ao Prisma pela composição.
 */
export type TenantTransactionRunner = <T>(
  _context: TenantContext,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>
