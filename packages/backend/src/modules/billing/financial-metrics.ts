import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { buildFinancialPaymentsWhere } from './financial-scope'

interface FinancialMetrics {
  mrr: number // Monthly Recurring Revenue
  fleetUtilization: number // Taxa de utilização da frota
  overdueAmount: number // Valor total em atraso
  averageTicket: number // Ticket médio por locação
  netProfit: number // Lucro líquido
}

interface FinancialTrends {
  mrr: number // % de variação
  fleetUtilization: number
  overdueAmount: number
  averageTicket: number
  netProfit: number
}

interface FinancialSparklines {
  mrr: number[]
  fleetUtilization: number[]
  overdueAmount: number[]
  averageTicket: number[]
  netProfit: number[]
}

/**
 * Calcula MRR (Monthly Recurring Revenue) - Receita Mensal Recorrente
 * Soma de todos os pagamentos recebidos no mês atual
 */
async function calculateMRR(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const where = buildFinancialPaymentsWhere({
    tenantId: context.tenantId,
    status: 'PAID',
    startDate,
    endDate,
    dateField: 'paidAt',
  })

  const payments = await prisma.payment.aggregate({
    where,
    _sum: {
      amount: true,
    },
  })

  return Number(payments._sum.amount || 0)
}

/**
 * Calcula MRR do mês anterior para comparação
 */
async function calculatePreviousMRR(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const previousMonthStart = new Date(startDate)
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)

  const previousMonthEnd = new Date(endDate)
  previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1)

  return calculateMRR(context, prisma, previousMonthStart, previousMonthEnd)
}

/**
 * Calcula valor total em atraso (pagamentos vencidos e não pagos)
 */
async function calculateOverdueAmount(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<number> {
  const now = new Date()

  const baseWhere = buildFinancialPaymentsWhere({ tenantId: context.tenantId })
  const overduePayments = await prisma.payment.aggregate({
    where: {
      AND: [
        baseWhere,
        { billingStatus: { in: ['AWAITING_PAYMENT', 'UNPAID'] } },
        { dueDate: { lt: now } },
      ],
    },
    _sum: {
      amount: true,
    },
  })

  return Number(overduePayments._sum.amount || 0)
}

/**
 * Calcula valor total em atraso do mês anterior para comparação
 */
async function calculatePreviousOverdueAmount(
  context: TenantContext,
  prisma: Prisma.TransactionClient
): Promise<number> {
  // Para comparação, vamos calcular o valor que estava em atraso há 30 dias
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const baseWhere = buildFinancialPaymentsWhere({ tenantId: context.tenantId })
  const overduePayments = await prisma.payment.aggregate({
    where: {
      AND: [
        baseWhere,
        { billingStatus: { in: ['AWAITING_PAYMENT', 'UNPAID'] } },
        { dueDate: { lt: thirtyDaysAgo } },
      ],
    },
    _sum: {
      amount: true,
    },
  })

  return Number(overduePayments._sum.amount || 0)
}

/**
 * Calcula ticket médio por locação
 * Média do valor total das locações completadas
 */
async function calculateAverageTicket(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const where = buildFinancialPaymentsWhere({
    tenantId: context.tenantId,
    status: 'PAID',
    startDate,
    endDate,
    dateField: 'paidAt',
  })

  const [paidTotals, paidCount] = await Promise.all([
    prisma.payment.aggregate({
      where,
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.count({ where }),
  ])

  if (paidCount === 0) return 0

  return Number(paidTotals._sum.amount || 0) / paidCount
}

/**
 * Calcula ticket médio do período anterior
 */
async function calculatePreviousAverageTicket(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const previousMonthStart = new Date(startDate)
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)

  const previousMonthEnd = new Date(endDate)
  previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1)

  return calculateAverageTicket(
    context,
    prisma,
    previousMonthStart,
    previousMonthEnd
  )
}

/**
 * Calcula lucro líquido (Receita - Custos)
 * Receita de pagamentos pagos menos custos de manutenção
 */
async function calculateNetProfit(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const paidWhere = buildFinancialPaymentsWhere({
    tenantId: context.tenantId,
    status: 'PAID',
    startDate,
    endDate,
    dateField: 'paidAt',
  })

  // Receita total
  const revenue = await prisma.payment.aggregate({
    where: paidWhere,
    _sum: {
      amount: true,
    },
  })

  // Custos de manutenção
  const maintenanceCosts = await prisma.maintenance.aggregate({
    where: {
      tenantId: context.tenantId,
      status: 'COMPLETED',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      cost: true,
      laborCost: true,
      partsCost: true,
    },
  })

  const totalRevenue = Number(revenue._sum.amount || 0)
  const totalMaintenanceCost =
    Number(maintenanceCosts._sum.cost || 0) +
    Number(maintenanceCosts._sum.laborCost || 0) +
    Number(maintenanceCosts._sum.partsCost || 0)

  return totalRevenue - totalMaintenanceCost
}

/**
 * Calcula lucro líquido do período anterior
 */
async function calculatePreviousNetProfit(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const previousMonthStart = new Date(startDate)
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)

  const previousMonthEnd = new Date(endDate)
  previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1)

  return calculateNetProfit(
    context,
    prisma,
    previousMonthStart,
    previousMonthEnd
  )
}

/**
 * Calcula utilização financeira da frota (Dollar Utilization)
 * Usa a função existente calculateFleetUtilizationRate
 */
async function calculateDollarUtilization(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const { calculateFleetUtilizationRate } = await import('./kpi-calculations')
  return calculateFleetUtilizationRate(context, prisma, startDate, endDate)
}

/**
 * Gera dados de sparkline para um período (últimos 7 dias)
 */
async function generateSparklineData(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  metric:
    | 'mrr'
    | 'fleetUtilization'
    | 'overdueAmount'
    | 'averageTicket'
    | 'netProfit',
  days: number = 7
): Promise<number[]> {
  const now = new Date()
  const data: number[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const startOfDay = new Date(date.setHours(0, 0, 0, 0))
    const endOfDay = new Date(date.setHours(23, 59, 59, 999))

    let value = 0

    switch (metric) {
      case 'mrr':
        value = await calculateMRR(context, prisma, startOfDay, endOfDay)
        break
      case 'overdueAmount': {
        // Para overdue, calculamos o valor em atraso naquele dia
        const overdueBaseWhere = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
        })
        const overdue = await prisma.payment.aggregate({
          where: {
            AND: [
              overdueBaseWhere,
              { billingStatus: { in: ['AWAITING_PAYMENT', 'UNPAID'] } },
              { dueDate: { lt: endOfDay } },
            ],
          },
          _sum: {
            amount: true,
          },
        })
        value = Number(overdue._sum.amount || 0)
        break
      }
      case 'averageTicket':
        value = await calculateAverageTicket(
          context,
          prisma,
          startOfDay,
          endOfDay
        )
        break
      case 'netProfit':
        value = await calculateNetProfit(context, prisma, startOfDay, endOfDay)
        break
      case 'fleetUtilization': {
        // Para utilização, usamos a taxa calculada
        const { calculateFleetUtilizationRate } =
          await import('./kpi-calculations')
        value = await calculateFleetUtilizationRate(
          context,
          prisma,
          startOfDay,
          endOfDay
        )
        break
      }
    }

    data.push(value)
  }

  return data
}

/**
 * Calcula todas as métricas financeiras com tendências e sparklines
 */
export async function calculateAllFinancialMetrics(
  context: TenantContext,
  prisma: Prisma.TransactionClient,
  startDate: Date,
  endDate: Date
): Promise<{
  metrics: FinancialMetrics
  trends: FinancialTrends
  sparklines: FinancialSparklines
}> {
  const [
    mrr,
    previousMRR,
    overdueAmount,
    previousOverdueAmount,
    averageTicket,
    previousAverageTicket,
    netProfit,
    previousNetProfit,
    fleetUtilization,
    previousFleetUtilization,
  ] = await Promise.all([
    calculateMRR(context, prisma, startDate, endDate),
    calculatePreviousMRR(context, prisma, startDate, endDate),
    calculateOverdueAmount(context, prisma),
    calculatePreviousOverdueAmount(context, prisma),
    calculateAverageTicket(context, prisma, startDate, endDate),
    calculatePreviousAverageTicket(context, prisma, startDate, endDate),
    calculateNetProfit(context, prisma, startDate, endDate),
    calculatePreviousNetProfit(context, prisma, startDate, endDate),
    calculateDollarUtilization(context, prisma, startDate, endDate),
    (async () => {
      const prevStart = new Date(startDate)
      prevStart.setMonth(prevStart.getMonth() - 1)
      const prevEnd = new Date(endDate)
      prevEnd.setMonth(prevEnd.getMonth() - 1)
      return calculateDollarUtilization(context, prisma, prevStart, prevEnd)
    })(),
  ])

  // Calcular tendências (% de variação)
  const trends: FinancialTrends = {
    mrr: previousMRR > 0 ? ((mrr - previousMRR) / previousMRR) * 100 : 0,
    overdueAmount:
      previousOverdueAmount > 0
        ? ((overdueAmount - previousOverdueAmount) / previousOverdueAmount) *
          100
        : 0,
    averageTicket:
      previousAverageTicket > 0
        ? ((averageTicket - previousAverageTicket) / previousAverageTicket) *
          100
        : 0,
    netProfit:
      previousNetProfit !== 0
        ? ((netProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 100
        : 0,
    fleetUtilization:
      previousFleetUtilization > 0
        ? ((fleetUtilization - previousFleetUtilization) /
            previousFleetUtilization) *
          100
        : 0,
  }

  // Gerar sparklines (últimos 7 dias)
  const [
    mrrSparkline,
    fleetSparkline,
    overdueSparkline,
    ticketSparkline,
    profitSparkline,
  ] = await Promise.all([
    generateSparklineData(context, prisma, 'mrr', 7),
    generateSparklineData(context, prisma, 'fleetUtilization', 7),
    generateSparklineData(context, prisma, 'overdueAmount', 7),
    generateSparklineData(context, prisma, 'averageTicket', 7),
    generateSparklineData(context, prisma, 'netProfit', 7),
  ])

  return {
    metrics: {
      mrr,
      fleetUtilization,
      overdueAmount,
      averageTicket,
      netProfit,
    },
    trends,
    sparklines: {
      mrr: mrrSparkline,
      fleetUtilization: fleetSparkline,
      overdueAmount: overdueSparkline,
      averageTicket: ticketSparkline,
      netProfit: profitSparkline,
    },
  }
}
