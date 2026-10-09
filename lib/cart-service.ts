import { createCustomerCartService } from '@gb-locacoes/backend/customers'
import { prisma } from '@/lib/prisma'

export { CustomerError } from '@gb-locacoes/backend/customers'

export const { readCustomerCart, writeCustomerCart } =
  createCustomerCartService(prisma)
