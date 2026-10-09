'use client'

import {
  DollarSign,
  Activity,
  AlertCircle,
  Wallet,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { FinancialKPICard } from '../../../widgets/graficos-financeiros'

interface FinancialMetrics {
  mrr: number
  fleetUtilization: number
  overdueAmount: number
  averageTicket: number
  netProfit: number
}

interface FinancialData {
  metrics: FinancialMetrics
  trends: FinancialMetrics
  sparklines: {
    mrr: number[]
    fleetUtilization: number[]
    overdueAmount: number[]
    averageTicket: number[]
    netProfit: number[]
  }
}

interface DashboardFinancialKPIsProps {
  financialMetrics: FinancialData
}

export function DashboardFinancialKPIs({
  financialMetrics,
}: DashboardFinancialKPIsProps) {
  const { metrics, trends, sparklines } = financialMetrics

  const kpiCards = [
    {
      title: 'Receita Mensal (MRR)',
      value: `R$ ${metrics.mrr.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      trend: trends.mrr,
      sparklineData: sparklines.mrr,
      icon: <DollarSign className="h-4 w-4" />,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      valueColor: undefined,
    },
    {
      title: 'Utilização da Frota',
      value: `${metrics.fleetUtilization.toFixed(1)}%`,
      trend: trends.fleetUtilization,
      sparklineData: sparklines.fleetUtilization,
      icon: <Activity className="h-4 w-4" />,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      valueColor: undefined,
    },
    {
      title: 'Valor em Atraso',
      value: `R$ ${metrics.overdueAmount.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      trend: trends.overdueAmount,
      sparklineData: sparklines.overdueAmount,
      icon: <AlertCircle className="h-4 w-4" />,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-600',
    },
    {
      title: 'Ticket Médio',
      value: `R$ ${metrics.averageTicket.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      trend: trends.averageTicket,
      sparklineData: sparklines.averageTicket,
      icon: <Wallet className="h-4 w-4" />,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      valueColor: undefined,
    },
    {
      title: 'Lucro Líquido',
      value: `R$ ${metrics.netProfit.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      trend: trends.netProfit,
      sparklineData: sparklines.netProfit,
      icon: <TrendingUp className="h-4 w-4" />,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valueColor: metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
      {kpiCards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 0.3 + index * 0.05,
            duration: 0.3,
            ease: 'easeOut',
          }}
        >
          <FinancialKPICard
            title={card.title}
            value={card.value}
            trend={card.trend}
            trendLabel="vs. mês anterior"
            sparklineData={card.sparklineData}
            icon={card.icon}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
            valueColor={card.valueColor}
          />
        </motion.div>
      ))}
    </div>
  )
}
