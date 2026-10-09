import type { VehicleStatus, VehicleType } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { VehicleInput } from '@gb-locacoes/contracts/operations'
import type { OperationsTransaction } from './types'
import { admitOperation } from './admission'

export class VehicleError extends Error {
  readonly status = 400
}

export function createVehicleService({
  withRentalTransaction,
}: {
  withRentalTransaction: OperationsTransaction
}) {
  return {
    listVehicles(
      context: TenantContext,
      filters: { status?: string | null; type?: string | null }
    ) {
      return withRentalTransaction(context, (tx) =>
        tx.vehicle.findMany({
          where: {
            tenantId: context.tenantId,
            ...(filters.status
              ? { status: filters.status as VehicleStatus }
              : {}),
            ...(filters.type ? { type: filters.type as VehicleType } : {}),
          },
          orderBy: { plate: 'asc' },
        })
      )
    },
    createVehicle(context: TenantContext, input: () => Promise<VehicleInput>) {
      return withRentalTransaction(context, async (tx) => {
        const data = await input()
        await admitOperation(tx, context, 'logistics')
        const existing = await tx.vehicle.findFirst({
          where: { tenantId: context.tenantId, plate: data.plate },
        })
        if (existing) throw new VehicleError('Placa já cadastrada')
        return tx.vehicle.create({
          data: {
            tenantId: context.tenantId,
            plate: data.plate,
            brand: data.brand,
            model: data.model,
            year: data.year,
            type: data.type || 'TRUCK',
            status: data.status || 'AVAILABLE',
          },
        })
      })
    },
  }
}

export type VehicleService = ReturnType<typeof createVehicleService>
