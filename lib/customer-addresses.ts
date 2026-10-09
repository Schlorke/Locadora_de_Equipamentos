import { createAddressService } from '@gb-locacoes/backend/customers'
import { prisma } from '@/lib/prisma'

export { AddressNotFound } from '@gb-locacoes/backend/customers'

export const { listAddresses, createAddress, updateAddress, deleteAddress } =
  createAddressService(prisma)
