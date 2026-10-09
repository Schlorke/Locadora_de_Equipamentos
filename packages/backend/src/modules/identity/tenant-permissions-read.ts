import type { Prisma } from '@prisma/client'

/** Administrative permission rows inside the caller's existing tenant transaction. */
export function listTenantPermissions(
  transaction: Pick<Prisma.TransactionClient, 'permission'>,
  context: { tenantId: string }
) {
  return transaction.permission.findMany({
    where: { tenantId: context.tenantId },
    orderBy: [{ role: 'asc' }, { module: 'asc' }, { action: 'asc' }],
  })
}
