'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { ChartCard } from '../../../widgets/graficos-financeiros'
import {
  TrendingUp,
  Target,
  BarChart3,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import type { DashboardStats, RevenueData, AgingData } from '../model/contratos'

const RevenueChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.RevenueChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
    ),
  }
)

const RevenueByCategoryChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.RevenueByCategoryChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
    ),
  }
)

const AgingChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.AgingChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
    ),
  }
)

const QuotesTrendChart = dynamic(
  () =>
    import('./Tendencia.web').then((mod) => ({
      default: mod.QuotesTrendChart,
    })),
  { ssr: false }
)

const StatusDistributionChart = dynamic(
  () =>
    import('./Distribuicao.web').then((mod) => ({
      default: mod.StatusDistributionChart,
    })),
  { ssr: false }
)

const EquipmentByCategoryChart = dynamic(
  () =>
    import('./Categoria.web').then((mod) => ({
      default: mod.EquipmentByCategoryChart,
    })),
  { ssr: false }
)

const DebtorsTable = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.DebtorsTable,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-gray-100 animate-pulse rounded-lg" />
    ),
  }
)

interface DashboardChartsSectionProps {
  stats: DashboardStats | null
  statusChartData: Array<{ name: string; value: number; color: string }>
  revenueData: RevenueData | null
  agingData: AgingData | null
  onExpand: (_id: string) => void
}

export function DashboardChartsSection({
  stats,
  statusChartData,
  revenueData,
  agingData,
  onExpand,
}: DashboardChartsSectionProps) {
  return (
    <>
      {/* Gráficos de Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mb-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.55, duration: 0.3, ease: 'easeOut' }}
          >
            <ChartCard
              id="tendencia-orcamentos"
              title={
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  Tendência de Orçamentos (7 dias)
                </div>
              }
              onExpand={() => onExpand('tendencia-orcamentos')}
            >
              <QuotesTrendChart data={stats?.quotesTrend ?? []} />
            </ChartCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.3, ease: 'easeOut' }}
          >
            <ChartCard
              id="distribuicao-status"
              title={
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  Distribuição de Status
                </div>
              }
              onExpand={() => onExpand('distribuicao-status')}
            >
              <StatusDistributionChart
                data={statusChartData}
                totalQuotes={stats?.totalQuotes ?? 0}
              />
            </ChartCard>
          </motion.div>
        </div>
      </motion.div>

      {/* Gráficos Financeiros */}
      {revenueData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.3, ease: 'easeOut' }}
            >
              <ChartCard
                id="evolucao-receita"
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    Evolução da Receita (Últimos 12 meses)
                  </div>
                }
                onExpand={() => onExpand('evolucao-receita')}
              >
                <RevenueChart data={revenueData.revenueHistory} />
              </ChartCard>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.75, duration: 0.3, ease: 'easeOut' }}
            >
              <ChartCard
                id="receita-categoria-dash"
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    Receita por Categoria
                  </div>
                }
                onExpand={() => onExpand('receita-categoria-dash')}
              >
                <RevenueByCategoryChart data={revenueData.revenueByCategory} />
              </ChartCard>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Saúde do Contas a Receber */}
      {agingData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.3, ease: 'easeOut' }}
            >
              <ChartCard
                id="aging-contas-dash"
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    Aging de Contas a Receber
                  </div>
                }
                onExpand={() => onExpand('aging-contas-dash')}
              >
                <AgingChart data={agingData.agingData} />
              </ChartCard>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.95, duration: 0.3, ease: 'easeOut' }}
            >
              <ChartCard
                id="maiores-devedores-dash"
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    Maiores Devedores
                  </div>
                }
                onExpand={() => onExpand('maiores-devedores-dash')}
              >
                <DebtorsTable data={agingData.topDebtors} />
              </ChartCard>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Distribuição por Categoria */}
      {stats?.equipmentByCategory && stats.equipmentByCategory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <ChartCard
            id="distribuicao-categoria"
            title={
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                Distribuição por Categoria
              </div>
            }
            onExpand={() => onExpand('distribuicao-categoria')}
          >
            <EquipmentByCategoryChart
              data={stats.equipmentByCategory}
              // token-check-allow: azul padrão da categoria no dashboard
              defaultColor="#3b82f6"
            />
          </ChartCard>
        </motion.div>
      )}
    </>
  )
}
