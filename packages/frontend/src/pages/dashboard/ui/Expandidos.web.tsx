'use client'

import dynamic from 'next/dynamic'
import { AnimatePresence } from 'framer-motion'
import { ExpandedCardOverlay } from '../../../widgets/graficos-financeiros'
import {
  TrendingUp,
  Target,
  BarChart3,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import type { DashboardStats, RevenueData, AgingData } from '../model/contratos'

const RevenueChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.RevenueChart,
    })),
  { ssr: false }
)

const RevenueByCategoryChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.RevenueByCategoryChart,
    })),
  { ssr: false }
)

const AgingChart = dynamic(
  () =>
    import('../../../widgets/graficos-financeiros').then((mod) => ({
      default: mod.AgingChart,
    })),
  { ssr: false }
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
  { ssr: false }
)

interface DashboardExpandedOverlaysProps {
  expandedCardId: string | null
  setExpandedCardId: (_id: string | null) => void
  stats: DashboardStats | null
  statusChartData: Array<{ name: string; value: number; color: string }>
  revenueData: RevenueData | null
  agingData: AgingData | null
}

export function DashboardExpandedOverlays({
  expandedCardId,
  setExpandedCardId,
  stats,
  statusChartData,
  revenueData,
  agingData,
}: DashboardExpandedOverlaysProps) {
  return (
    <AnimatePresence>
      {expandedCardId === 'tendencia-orcamentos' && (
        <ExpandedCardOverlay
          id="tendencia-orcamentos"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              Tendência de Orçamentos (7 dias)
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <QuotesTrendChart data={stats?.quotesTrend ?? []} expanded />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'distribuicao-status' && (
        <ExpandedCardOverlay
          id="distribuicao-status"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              Distribuição de Status
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <StatusDistributionChart
            data={statusChartData}
            totalQuotes={stats?.totalQuotes ?? 0}
            expanded
          />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'evolucao-receita' && revenueData && (
        <ExpandedCardOverlay
          id="evolucao-receita"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              Evolução da Receita (Últimos 12 meses)
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <RevenueChart data={revenueData.revenueHistory} expanded />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'receita-categoria-dash' && revenueData && (
        <ExpandedCardOverlay
          id="receita-categoria-dash"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              Receita por Categoria
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <RevenueByCategoryChart
            data={revenueData.revenueByCategory}
            expanded
          />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'aging-contas-dash' && agingData && (
        <ExpandedCardOverlay
          id="aging-contas-dash"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              Aging de Contas a Receber
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <AgingChart data={agingData.agingData} expanded />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'maiores-devedores-dash' && agingData && (
        <ExpandedCardOverlay
          id="maiores-devedores-dash"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              Maiores Devedores
            </div>
          }
          onClose={() => setExpandedCardId(null)}
        >
          <DebtorsTable data={agingData.topDebtors} expanded />
        </ExpandedCardOverlay>
      )}
      {expandedCardId === 'distribuicao-categoria' &&
        stats?.equipmentByCategory && (
          <ExpandedCardOverlay
            id="distribuicao-categoria"
            title={
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                Distribuição por Categoria
              </div>
            }
            onClose={() => setExpandedCardId(null)}
          >
            <EquipmentByCategoryChart
              data={stats.equipmentByCategory}
              // token-check-allow: azul padrão da categoria expandida
              defaultColor="#3b82f6"
              expanded
            />
          </ExpandedCardOverlay>
        )}
    </AnimatePresence>
  )
}
