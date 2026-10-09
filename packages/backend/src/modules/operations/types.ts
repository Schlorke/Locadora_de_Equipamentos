import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

export type OperationsTransaction = <T>(
  _context: TenantContext,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>
