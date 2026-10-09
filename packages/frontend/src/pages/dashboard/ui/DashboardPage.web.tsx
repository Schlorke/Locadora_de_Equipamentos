'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'

import dynamic from 'next/dynamic'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { AlertTriangle, Activity } from 'lucide-react'
import { motion, LayoutGroup } from 'framer-motion'

import { useDashboardData } from '../model/carga'
import { MainStatsGrid, StatusStatsGrid } from './Grade.web'
import { BusinessMetricsSection } from './Metricas.web'
import { DashboardChartsSection } from './Graficos.web'
import { TopEquipmentSection } from './Destaques.web'
import { QuickActionsSection } from './Atalhos.web'
import { RecentQuotesSection } from './Recentes.web'
import { DashboardExpandedOverlays } from './Expandidos.web'
import { OwnerSubscriptionNotice } from '../../../widgets/aviso-assinatura'
import { ChecklistPrimeirosPassos } from '../../../widgets/checklist-primeiros-passos'

const DashboardFinancialKPIs = dynamic(
  () =>
    import('./Kpis.web').then((mod) => ({
      default: mod.DashboardFinancialKPIs,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-[180px] bg-gray-100 animate-pulse rounded-lg"
          />
        ))}
      </div>
    ),
  }
)

export function AdminDashboard() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
  ])
  return <AdminDashboardContent key={scope} />
}

function AdminDashboardContent() {
  const {
    stats,
    expandedCardId,
    setExpandedCardId,
    statsError,
    recentQuotes,
    isLoading,
    revenueData,
    agingData,
    statusChartData,
    fetchDashboardData,
  } = useDashboardData()

  if (statsError) {
    return (
      <>
        <ChecklistPrimeirosPassos />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Erro ao carregar o dashboard
                </h2>
                <p className="text-sm text-gray-600">{statsError}</p>
                <Button onClick={() => fetchDashboardData()} variant="default">
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LayoutGroup>
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <OwnerSubscriptionNotice />
          <ChecklistPrimeirosPassos />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 lg:mb-8"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
              <div className="absolute inset-0"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white drop-shadow-sm">
                    Dashboard Executivo
                  </h1>
                </div>
                <p className="text-orange-50 mb-4 font-medium">
                  Visão geral completa do sistema de locação de equipamentos
                </p>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
                  <Activity className="w-5 h-5 text-orange-50" />
                  <span className="font-semibold text-white">
                    Sistema em tempo real
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <MainStatsGrid stats={stats} isLoading={isLoading} />
          <StatusStatsGrid stats={stats} isLoading={isLoading} />

          {/* KPIs Financeiros */}
          {stats?.financialMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <DashboardFinancialKPIs
                financialMetrics={stats.financialMetrics}
              />
            </motion.div>
          )}

          <DashboardChartsSection
            stats={stats}
            statusChartData={statusChartData}
            revenueData={revenueData}
            agingData={agingData}
            onExpand={setExpandedCardId}
          />

          <BusinessMetricsSection stats={stats} />
          <TopEquipmentSection stats={stats} />
          <QuickActionsSection />
          <RecentQuotesSection recentQuotes={recentQuotes} />
        </div>

        <DashboardExpandedOverlays
          expandedCardId={expandedCardId}
          setExpandedCardId={setExpandedCardId}
          stats={stats}
          statusChartData={statusChartData}
          revenueData={revenueData}
          agingData={agingData}
        />
      </LayoutGroup>
    </div>
  )
}
