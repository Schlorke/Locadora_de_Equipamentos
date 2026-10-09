'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'

import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { AdminCard } from '../../../widgets/cartao-admin'
import { Card, CardContent } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'
import { AdvancedCalendar } from '../../../widgets/calendario'
import { toMaintenanceCalendarEvent } from '../model/calendar'
import { useMaintenanceData } from '../model/carga'
import { MaintenanceFilterBar } from './Filtros.web'
import { MaintenanceTable } from './Tabela.web'
import { MaintenanceDetailDialog } from './Dialogo.web'

export function AdminMaintenancePage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    tenant?.tenant.status,
    revision,
    slug,
    session?.user?.id,
  ])
  return <AdminMaintenancePageContent key={scope} />
}

function AdminMaintenancePageContent() {
  const {
    filteredMaintenances,
    loading,
    selectedMaintenance,
    setSelectedMaintenance,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    viewMode,
    setViewMode,
    paginatedMaintenances,
    tableCurrentPage,
    tableTotalPages,
    setTablePage,
    maintenances,
  } = useMaintenanceData()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        <AdminPageHeader
          title="Gerenciar Manutenções"
          subtitle="Agenda e histórico de manutenções de equipamentos"
          icon={<Wrench className="w-8 h-8" />}
          infoBadge={{
            icon: <Wrench className="w-5 h-5 text-orange-50" />,
            text: `${Array.isArray(filteredMaintenances) ? filteredMaintenances.length : maintenances.length} manutenções encontradas`,
          }}
          className="mb-8"
        />

        <MaintenanceFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {viewMode === 'calendar' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <AdminCard title="Calendário de Manutenções" variant="flat">
              <AdvancedCalendar
                events={filteredMaintenances.map(toMaintenanceCalendarEvent)}
                resources={Array.from(
                  new Map(
                    filteredMaintenances.map((m) => [
                      m.equipment.id,
                      {
                        id: m.equipment.id,
                        name: m.equipment.name,
                      },
                    ])
                  ).values()
                )}
                onEventClick={(event) => {
                  const maintenance = filteredMaintenances.find(
                    (m) => m.id === event.id
                  )
                  if (maintenance) {
                    setSelectedMaintenance(maintenance)
                  }
                }}
                defaultViewMode="weekly"
                fixedColumnWidth={true}
              />
            </AdminCard>
          </motion.div>
        )}

        {viewMode === 'list' && filteredMaintenances.length > 0 && (
          <MaintenanceTable
            paginatedMaintenances={paginatedMaintenances}
            totalItems={filteredMaintenances.length}
            currentPage={tableCurrentPage}
            totalPages={tableTotalPages}
            onPageChange={setTablePage}
            onSelectMaintenance={setSelectedMaintenance}
          />
        )}

        {!loading &&
          viewMode === 'list' &&
          filteredMaintenances.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <Card className="bg-white shadow-lg border-0">
                <CardContent className="p-12 text-center">
                  <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma manutenção encontrada
                  </h3>
                  <p className="text-sm text-gray-500">
                    Não há manutenções cadastradas no sistema
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

        <MaintenanceDetailDialog
          maintenance={selectedMaintenance}
          onClose={() => setSelectedMaintenance(null)}
        />
      </div>
    </div>
  )
}
