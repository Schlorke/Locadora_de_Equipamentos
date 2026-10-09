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
import { AdvancedCalendar } from '../../../widgets/calendario'
import { motion } from 'framer-motion'
import { Truck } from 'lucide-react'
import { toLogisticsCalendarEvent } from '../model/calendar'
import { useLogisticsData } from '../model/carga'
import { LogisticsFilterBar } from './Filtros.web'
import { LogisticsTable } from './Tabela.web'
import { DeliveryDetailDialog } from './Dialogo.web'

export function AdminLogisticsPage() {
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
  return <AdminLogisticsPageContent key={scope} />
}

function AdminLogisticsPageContent() {
  const {
    deliveries,
    filteredDeliveries,
    loading,
    selectedDelivery,
    setSelectedDelivery,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    viewMode,
    setViewMode,
    vehicles,
    drivers,
    isEditing,
    setIsEditing,
    editingDelivery,
    setEditingDelivery,
    paginatedDeliveries,
    tableCurrentPage,
    tableTotalPages,
    setTablePage,
    handleEditDelivery,
    handleSaveDelivery,
    handleUpdateStatus,
    handleCloseDialog,
    handleCancelEditing,
  } = useLogisticsData()

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
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <AdminPageHeader
            title="Gerenciar Logística"
            subtitle="Entregas e coletas de equipamentos"
            icon={<Truck className="w-8 h-8" />}
            infoBadge={{
              icon: <Truck className="w-5 h-5 text-orange-50" />,
              text: `${Array.isArray(filteredDeliveries) ? filteredDeliveries.length : deliveries.length} entregas encontradas`,
            }}
            className="flex-1"
          />
        </div>

        <LogisticsFilterBar
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
            <AdminCard title="Calendário de Logística" variant="flat">
              <AdvancedCalendar
                events={filteredDeliveries.map(toLogisticsCalendarEvent)}
                resources={[
                  ...vehicles.map((vehicle) => ({
                    id: vehicle.id,
                    name: `${vehicle.plate} • ${vehicle.model ?? vehicle.brand ?? vehicle.type}`,
                  })),
                  { id: 'type-DELIVERY', name: 'Sem veículo • Entregas' },
                  { id: 'type-PICKUP', name: 'Sem veículo • Coletas' },
                ]}
                onEventClick={(event) => {
                  const delivery = filteredDeliveries.find(
                    (d) => d.id === event.id
                  )
                  if (delivery) {
                    handleEditDelivery(delivery)
                  }
                }}
                defaultViewMode="weekly"
              />
            </AdminCard>
          </motion.div>
        )}

        {viewMode === 'table' && filteredDeliveries.length > 0 && (
          <LogisticsTable
            paginatedDeliveries={paginatedDeliveries}
            totalItems={filteredDeliveries.length}
            currentPage={tableCurrentPage}
            totalPages={tableTotalPages}
            onPageChange={setTablePage}
            onViewDelivery={(delivery) => {
              setSelectedDelivery(delivery)
              setIsEditing(false)
            }}
            onEditDelivery={handleEditDelivery}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {!loading && filteredDeliveries.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-12 text-center">
                <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Nenhuma entrega encontrada
                </h3>
                <p className="text-sm text-gray-500">
                  Não há entregas ou coletas cadastradas no sistema
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <DeliveryDetailDialog
          delivery={selectedDelivery}
          isEditing={isEditing}
          editingDelivery={editingDelivery}
          setEditingDelivery={setEditingDelivery}
          vehicles={vehicles}
          drivers={drivers}
          onClose={handleCloseDialog}
          onEdit={handleEditDelivery}
          onSave={handleSaveDelivery}
          onCancelEditing={handleCancelEditing}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>
    </div>
  )
}
