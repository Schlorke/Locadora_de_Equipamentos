import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  AddressInput,
  AddressPatch,
} from '@gb-locacoes/contracts/addresses'
import { withTenantTransaction, type TenantPrincipal } from '../identity/index'

export class AddressNotFound extends Error {}

const scope = (principal: TenantPrincipal) => ({
  tenantId: principal.tenantId,
  userId: principal.userId,
})

export function createAddressService(prisma: PrismaClient) {
  function locked<T>(
    principal: TenantPrincipal,
    operation: (_tx: Prisma.TransactionClient) => Promise<T>
  ) {
    return withTenantTransaction(prisma, principal, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${principal.tenantId + ':addresses:' + principal.userId}, 0))`
      return operation(tx)
    })
  }

  return {
    listAddresses(principal: TenantPrincipal) {
      return withTenantTransaction(prisma, principal, (tx) =>
        tx.address.findMany({
          where: scope(principal),
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        })
      )
    },
    createAddress(principal: TenantPrincipal, input: AddressInput) {
      return locked(principal, async (tx) => {
        const where = scope(principal)
        const first = (await tx.address.count({ where })) === 0
        const isPrimary = first || input.isPrimary === true
        if (isPrimary)
          await tx.address.updateMany({
            where: { ...where, isPrimary: true },
            data: { isPrimary: false },
          })
        return tx.address.create({ data: { ...input, ...where, isPrimary } })
      })
    },
    updateAddress(principal: TenantPrincipal, id: string, input: AddressPatch) {
      return locked(principal, async (tx) => {
        const where = scope(principal)
        if (!(await tx.address.findFirst({ where: { ...where, id } })))
          throw new AddressNotFound()
        if (input.isPrimary === true)
          await tx.address.updateMany({
            where: { ...where, id: { not: id }, isPrimary: true },
            data: { isPrimary: false },
          })
        await tx.address.updateMany({ where: { ...where, id }, data: input })
        return tx.address.findFirstOrThrow({ where: { ...where, id } })
      })
    },
    deleteAddress(principal: TenantPrincipal, id: string) {
      return locked(principal, async (tx) => {
        const where = scope(principal)
        const address = await tx.address.findFirst({ where: { ...where, id } })
        if (!address) throw new AddressNotFound()
        await tx.address.deleteMany({ where: { ...where, id } })
        if (address.isPrimary) {
          const next = await tx.address.findFirst({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          })
          if (next)
            await tx.address.updateMany({
              where: { ...where, id: next.id },
              data: { isPrimary: true },
            })
        }
      })
    },
  }
}

export type AddressService = ReturnType<typeof createAddressService>
