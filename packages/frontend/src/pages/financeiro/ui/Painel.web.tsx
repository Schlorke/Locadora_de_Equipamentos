'use client'

import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { BarChart3, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { AgingChart } from '../../../widgets/graficos-financeiros'
import {
  ChartCard,
  ExpandedCardOverlay,
} from '../../../widgets/graficos-financeiros'
import { DebtorsTable } from '../../../widgets/graficos-financeiros'
import { RevenueChart } from '../../../widgets/graficos-financeiros'
import { RevenueByCategoryChart } from '../../../widgets/graficos-financeiros'
import type { AgingData, Debtor, RevenueData, CategoryRevenue } from '../model/tipos'

interface FinancialDashboardViewProps {
  agingData: AgingData[]
  topDebtors: Debtor[]
  revenueHistory: RevenueData[]
  revenueByCategory: CategoryRevenue[]
  expandedCardId: string | null
  setExpandedCardId: (_id: string | null) => void
}

export function FinancialDashboardView({
  agingData,
  topDebtors,
  revenueHistory,
  revenueByCategory,
  expandedCardId,
  setExpandedCardId,
}: FinancialDashboardViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-6"
    >
      <LayoutGroup>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            id="aging-contas"
            title={
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Aging - Contas a Receber
              </span>
            }
            onExpand={() => setExpandedCardId('aging-contas')}
          >
            <AgingChart data={agingData} />
          </ChartCard>
          <ChartCard
            id="maiores-devedores"
            title={
              <span className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Maiores Devedores
              </span>
            }
            onExpand={() => setExpandedCardId('maiores-devedores')}
          >
            <DebtorsTable data={topDebtors} />
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            id="receita-mensal"
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Receita Mensal
              </span>
            }
            onExpand={() => setExpandedCardId('receita-mensal')}
          >
            <RevenueChart data={revenueHistory} />
          </ChartCard>
          <ChartCard
            id="receita-categoria"
            title={
              <span className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                Receita por Categoria
              </span>
            }
            onExpand={() => setExpandedCardId('receita-categoria')}
          >
            <RevenueByCategoryChart data={revenueByCategory} />
          </ChartCard>
        </div>

        <AnimatePresence>
          {expandedCardId === 'receita-mensal' && (
            <ExpandedCardOverlay
              id="receita-mensal"
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Receita Mensal
                </span>
              }
              onClose={() => setExpandedCardId(null)}
            >
              <RevenueChart data={revenueHistory} expanded />
            </ExpandedCardOverlay>
          )}
          {expandedCardId === 'receita-categoria' && (
            <ExpandedCardOverlay
              id="receita-categoria"
              title={
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                  Receita por Categoria
                </span>
              }
              onClose={() => setExpandedCardId(null)}
            >
              <RevenueByCategoryChart data={revenueByCategory} expanded />
            </ExpandedCardOverlay>
          )}
          {expandedCardId === 'aging-contas' && (
            <ExpandedCardOverlay
              id="aging-contas"
              title={
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Aging - Contas a Receber
                </span>
              }
              onClose={() => setExpandedCardId(null)}
            >
              <AgingChart data={agingData} expanded />
            </ExpandedCardOverlay>
          )}
          {expandedCardId === 'maiores-devedores' && (
            <ExpandedCardOverlay
              id="maiores-devedores"
              title={
                <span className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Maiores Devedores
                </span>
              }
              onClose={() => setExpandedCardId(null)}
            >
              <DebtorsTable data={topDebtors} expanded />
            </ExpandedCardOverlay>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </motion.div>
  )
}
