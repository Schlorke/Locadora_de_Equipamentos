import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

interface KPIMetrics {
  fleetUtilizationRate: number // Taxa de utilização da frota (%)
  averageRevenuePerEquipment: number // Receita média por equipamento
  equipmentROI: Array<{
    equipmentId: string
    equipmentName: string
    purchasePrice: number
    totalRevenue: number
    totalMaintenanceCost: number
    roi: number // ROI em %
  }>
  averageRentalDuration: number // Tempo médio de locação (dias)
  defaultRate: number // Taxa de inadimplência (%)
  maintenanceCostPerEquipment: Array<{
    equipmentId: string
    equipmentName: string
    totalCost: number
    maintenanceCount: number
  }>
}

/**
 * Calcula taxa de utilização da frota
 * % de unidades alugadas vs total disponível
 */
export async function calculateFleetUtilizationRate(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const periodStart = startDate || new Date()
  const periodEnd = endDate || new Date()

  // Total de equipamentos disponíveis
  const totalEquipments = await prisma.equipment.aggregate({
    where: { tenantId: context.tenantId },
    _sum: {
      maxStock: true,
    },
  })

  const totalStock = totalEquipments._sum.maxStock ?? 0

  // Equipamentos alugados no período
  const activeRentals = await prisma.rental_items.findMany({
    where: {
      tenantId: context.tenantId,
      rentals: {
        status: {
          in: ['ACTIVE', 'OVERDUE', 'PENDING_RETURN'],
        },
        OR: [
          {
            AND: [
              { startdate: { lte: periodEnd } },
              { enddate: { gte: periodStart } },
            ],
          },
        ],
      },
    },
  })

  const totalRented = activeRentals.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  if (totalStock === 0) return 0
  return (totalRented / totalStock) * 100
}

/**
 * Calcula receita média por equipamento
 */
export async function calculateAverageRevenuePerEquipment(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const periodStart = startDate || new Date(new Date().getFullYear(), 0, 1)
  const periodEnd = endDate || new Date()

  const payments = await prisma.payment.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'PAID',
      paidAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      type: 'RENTAL',
    },
    include: {
      rental: {
        include: {
          rental_items: true,
        },
      },
    },
  })

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  )

  const totalEquipments = await prisma.equipment.count({
    where: { tenantId: context.tenantId },
  })

  if (totalEquipments === 0) return 0
  return totalRevenue / totalEquipments
}

/**
 * Calcula ROI por equipamento
 */
export async function calculateEquipmentROI(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<KPIMetrics['equipmentROI']> {
  const equipments = await prisma.equipment.findMany({
    where: { tenantId: context.tenantId },
    include: {
      rental_items: {
        include: {
          rentals: {
            include: {
              payments: {
                where: {
                  tenantId: context.tenantId,
                  status: 'PAID',
                  type: 'RENTAL',
                },
              },
            },
          },
        },
      },
      maintenances: {
        where: { tenantId: context.tenantId, status: 'COMPLETED' },
      },
    },
  })

  return equipments.map((equipment) => {
    const purchasePrice = Number(equipment.purchasePrice || 0)

    // Receita total do equipamento
    const totalRevenue = equipment.rental_items.reduce((sum, item) => {
      const rentalPayments = item.rentals.payments || []
      const rentalRevenue = rentalPayments.reduce(
        (paymentSum, payment) => paymentSum + Number(payment.amount),
        0
      )
      return sum + rentalRevenue
    }, 0)

    // Custo total de manutenção
    const totalMaintenanceCost = equipment.maintenances.reduce(
      (sum, maintenance) => sum + Number(maintenance.cost || 0),
      0
    )

    // ROI = ((Receita - Custo Manutenção) / Custo Compra) * 100
    const roi =
      purchasePrice > 0
        ? ((totalRevenue - totalMaintenanceCost) / purchasePrice) * 100
        : 0

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      purchasePrice,
      totalRevenue,
      totalMaintenanceCost,
      roi,
    }
  })
}

/**
 * Calcula tempo médio de locação
 */
async function calculateAverageRentalDuration(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<number> {
  const completedRentals = await prisma.rentals.findMany({
    where: { tenantId: context.tenantId, status: 'COMPLETED' },
    select: {
      startdate: true,
      enddate: true,
    },
  })

  if (completedRentals.length === 0) return 0

  const totalDays = completedRentals.reduce((sum, rental) => {
    const start = new Date(rental.startdate)
    const end = new Date(rental.enddate)
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    )
    return sum + days
  }, 0)

  return totalDays / completedRentals.length
}

/**
 * Calcula taxa de inadimplência
 */
async function calculateDefaultRate(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<number> {
  const totalPayments = await prisma.payment.count({
    where: { tenantId: context.tenantId, type: 'RENTAL' },
  })

  const overduePayments = await prisma.payment.count({
    where: { tenantId: context.tenantId, status: 'OVERDUE', type: 'RENTAL' },
  })

  if (totalPayments === 0) return 0
  return (overduePayments / totalPayments) * 100
}

/**
 * Calcula custo de manutenção por equipamento
 */
async function calculateMaintenanceCostPerEquipment(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<KPIMetrics['maintenanceCostPerEquipment']> {
  const equipments = await prisma.equipment.findMany({
    where: { tenantId: context.tenantId },
    include: {
      maintenances: {
        where: { tenantId: context.tenantId, status: 'COMPLETED' },
      },
    },
  })

  return equipments.map((equipment) => {
    const totalCost = equipment.maintenances.reduce(
      (sum, maintenance) => sum + Number(maintenance.cost || 0),
      0
    )

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      totalCost,
      maintenanceCount: equipment.maintenances.length,
    }
  })
}

/**
 * Calcula todas as métricas KPI
 */
export async function calculateAllKPIs(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate?: Date,
  endDate?: Date
): Promise<KPIMetrics> {
  const [
    fleetUtilizationRate,
    averageRevenuePerEquipment,
    equipmentROI,
    averageRentalDuration,
    defaultRate,
    maintenanceCostPerEquipment,
  ] = await Promise.all([
    calculateFleetUtilizationRate(context, prisma, startDate, endDate),
    calculateAverageRevenuePerEquipment(context, prisma, startDate, endDate),
    calculateEquipmentROI(context, prisma),
    calculateAverageRentalDuration(context, prisma),
    calculateDefaultRate(context, prisma),
    calculateMaintenanceCostPerEquipment(context, prisma),
  ])

  return {
    fleetUtilizationRate,
    averageRevenuePerEquipment,
    equipmentROI,
    averageRentalDuration,
    defaultRate,
    maintenanceCostPerEquipment,
  }
}
