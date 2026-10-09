import type { DriverStatus, PrismaClient } from '@prisma/client'
import { withTenantTransaction, type TenantPrincipal } from '../identity/index'
import { admitOperation } from './admission'

export type DriverInput = {
  name: string
  phone: string
  cnh?: string
  cnhCategory?: string
  status?: DriverStatus
}

export function createDriverService(prisma: PrismaClient) {
  return {
    listDrivers(principal: TenantPrincipal, status?: DriverStatus) {
      return withTenantTransaction(prisma, principal, (tx) =>
        tx.driver.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(status ? { status } : {}),
          },
          orderBy: { name: 'asc' },
        })
      )
    },
    createDriver(principal: TenantPrincipal, input: DriverInput) {
      return withTenantTransaction(prisma, principal, async (tx) => {
        await admitOperation(tx, principal, 'logistics')
        return tx.driver.create({
          data: {
            tenantId: principal.tenantId,
            name: input.name,
            phone: input.phone,
            cnh: input.cnh,
            cnhCategory: input.cnhCategory,
            status: input.status || 'ACTIVE',
          },
        })
      })
    },
  }
}

export type DriverService = ReturnType<typeof createDriverService>
