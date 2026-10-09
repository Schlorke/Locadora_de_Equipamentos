import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { PermissionReplacementInput } from '@gb-locacoes/contracts/permissions'

export async function replaceTenantPermissions(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  permissions: PermissionReplacementInput
) {
  const role = permissions[0]!.role
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':permissions:' + role}, 0))`
  await tx.permission.deleteMany({
    where: { tenantId: context.tenantId, role },
  })
  await tx.permission.createMany({
    data: permissions.map((item) => ({
      ...item,
      tenantId: context.tenantId,
    })),
    skipDuplicates: true,
  })
  return tx.permission.findMany({
    where: { tenantId: context.tenantId, role },
  })
}
