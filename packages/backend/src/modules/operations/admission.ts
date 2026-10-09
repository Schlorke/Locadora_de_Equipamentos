import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { DeliveryPatch } from '@gb-locacoes/contracts/operations'
import { admitRentalCommand } from '../entitlements/command-admission'

export async function admitOperation(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  feature: 'logistics' | 'maintenance',
  delivery?: DeliveryPatch
) {
  await admitRentalCommand(tx, context, { feature, delivery })
}
