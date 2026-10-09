import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import {
  calculateFleetUtilizationRate,
  calculateEquipmentROI,
  calculateAverageRevenuePerEquipment,
  calculateAllKPIs,
} from './kpi-calculations'
import { calculateAllFinancialMetrics } from './financial-metrics'
import { buildFinancialPaymentsWhere } from './financial-scope'

export function createDashboardRead({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readDashboard(context: TenantContext) {
      return withTenantTransaction(context, async (prisma) => {
        // Buscar estatísticas gerais
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthlyFinancialWhere = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
          status: 'PAID',
          startDate: startOfMonth,
          dateField: 'paidAt',
        })

        const [
          totalEquipments,
          totalCategories,
          totalQuotes,
          pendingQuotes,
          approvedQuotes,
          rejectedQuotes,
          completedQuotes,
          totalRevenue,
          monthlyRevenue,
          availableEquipments,
          utilizationRate,
          equipmentROI,
          averageRevenuePerEquipment,
          financialData,
        ] = await Promise.all([
          prisma.equipment.count({ where: { tenantId: context.tenantId } }),
          prisma.category.count({ where: { tenantId: context.tenantId } }),
          prisma.quote.count({ where: { tenantId: context.tenantId } }),
          prisma.quote.count({
            where: { tenantId: context.tenantId, status: 'PENDING' },
          }),
          prisma.quote.count({
            where: { tenantId: context.tenantId, status: 'APPROVED' },
          }),
          prisma.quote.count({
            where: { tenantId: context.tenantId, status: 'REJECTED' },
          }),
          prisma.quote.count({
            where: { tenantId: context.tenantId, status: 'COMPLETED' },
          }),
          prisma.quote.aggregate({
            where: { tenantId: context.tenantId, status: 'COMPLETED' },
            _sum: { total: true },
          }),
          prisma.payment.aggregate({
            where: monthlyFinancialWhere,
            _sum: { amount: true },
          }),
          prisma.equipment.count({
            where: { tenantId: context.tenantId, available: true },
          }),
          calculateFleetUtilizationRate(context, prisma),
          calculateEquipmentROI(context, prisma),
          calculateAverageRevenuePerEquipment(
            context,
            prisma,
            startOfMonth,
            now
          ),
          calculateAllFinancialMetrics(context, prisma, startOfMonth, now),
        ])

        const stats = {
          totalEquipments,
          availableEquipments,
          totalCategories,
          totalQuotes,
          pendingQuotes,
          approvedQuotes,
          rejectedQuotes,
          completedQuotes,
          totalRevenue: totalRevenue._sum.total || 0,
          monthlyRevenue: monthlyRevenue._sum.amount
            ? Number(monthlyRevenue._sum.amount)
            : 0,
          utilizationRate: utilizationRate || 0,
          equipmentROI: equipmentROI.slice(0, 10), // Top 10 por ROI
          averageRevenuePerEquipment: averageRevenuePerEquipment || 0,
          financialMetrics: financialData,
        }

        return stats
      })
    },
    readKPIs(context: TenantContext, startDate?: Date, endDate?: Date) {
      return withTenantTransaction(context, (tx) =>
        calculateAllKPIs(context, tx, startDate, endDate)
      )
    },
  }
}
