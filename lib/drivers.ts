import { createDriverService } from '@gb-locacoes/backend/operations'
import { prisma } from '@/lib/prisma'

export const { listDrivers, createDriver } = createDriverService(prisma)
