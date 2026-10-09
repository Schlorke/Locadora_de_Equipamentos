'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useApiClientRevision } from '../../../shared/api'
import { useSession } from '../../../entities/sessao'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { AdminCard } from '../../../widgets/cartao-admin'
import {
  AdvancedCalendar,
  type CalendarEvent,
} from '../../../widgets/calendario'
import { Badge } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { FilterSelectGroup } from '@gb-locacoes/ui'
import { FilterResetButton } from '@gb-locacoes/ui'
import { ViewToggle } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { Package, Calendar, Search, List } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { parseISO } from 'date-fns'

import { statusConfig } from '../model/tipos.web'
import { RentalTable } from './Tabela.web'
import { RentalDetailDialog } from './Dialogo.web'
import { useRentalsData } from '../model/carga'

function AdminRentalsPageContent() {
  const {
    rentals,
    filteredRentals,
    loading,
    selectedRental,
    setSelectedRental,
    contractLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    periodFilter,
    setPeriodFilter,
    viewMode,
    setViewMode,
    paginatedRentals,
    tableCurrentPage,
    tableTotalPages,
    setTablePage,
    clientDocuments,
    uploadingDocumentType,
    handleUploadClientDocument,
    handleGenerateContract,
    handleCheckIn,
    handleCheckOut,
  } = useRentalsData()

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

  // Calendar events mapping
  const calendarEvents: CalendarEvent[] = filteredRentals.map((rental) => {
    const equipmentNames = rental.rental_items
      .map((item) => item.equipments.name)
      .join(', ')
    const clientName = rental.users.name || 'Cliente'
    const isPending = rental.status === 'PENDING'
    const createdAt = rental.createdat ? parseISO(rental.createdat) : undefined

    const start =
      isPending && createdAt ? createdAt : parseISO(rental.startdate)
    const end = isPending && createdAt ? createdAt : parseISO(rental.enddate)

    const statusColors: Record<string, string> = {
      PENDING: '#F97316', // token-check-allow: laranja da locação pendente
      ACTIVE: '#3B82F6', // token-check-allow: azul da locação ativa
      COMPLETED: '#10B981', // token-check-allow: verde da locação concluída
      CANCELLED: '#EF4444', // token-check-allow: vermelho da locação cancelada
      OVERDUE: '#FBBF24', // token-check-allow: âmbar da locação atrasada
      PENDING_RETURN: '#8B5CF6', // token-check-allow: roxo do retorno pendente
    }

    return {
      id: rental.id,
      title: `${clientName} - ${equipmentNames}`,
      start,
      end,
      resourceId: rental.status,
      color: statusColors[rental.status] || '#6B7280', // token-check-allow: cinza do status desconhecido da locação
      type: 'rental',
      status: rental.status,
      isPendingRequest: isPending,
      createdAt: isPending ? createdAt : undefined,
      metadata: {
        clientName: rental.users.name,
        clientEmail: rental.users.email,
        clientPhone: rental.users.phone,
        equipmentCount: rental.rental_items.length,
        total: rental.total,
        equipmentNames,
      },
    }
  })

  const calendarResources = Object.entries(statusConfig).map(
    ([status, config]) => ({
      id: status,
      name: config.label,
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        <AdminPageHeader
          title="Gerenciar Locações"
          subtitle="Visualize e gerencie todas as locações de equipamentos"
          icon={<Package className="w-8 h-8" />}
          infoBadge={{
            icon: <Package className="w-5 h-5 text-orange-50" />,
            text: `${Array.isArray(filteredRentals) ? filteredRentals.length : rentals.length} locações encontradas`,
          }}
          className="mb-8"
        />

        {/* Menu de Navegação por Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <Card className="relative overflow-visible border-0 shadow-xl bg-white backdrop-blur-sm">
            <CardContent className="relative z-10 p-4 md:p-6">
              <div className="flex flex-col gap-4">
                {/* Título */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Filtrar por Status
                    </h2>
                    <p className="text-sm text-gray-600">
                      Clique em um status para visualizar as locações
                    </p>
                  </div>
                </div>

                {/* Grid de Botões de Status */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(statusConfig).map(([status, config]) => {
                    if (!config) return null
                    const Icon = config.icon
                    const totalStatusRentals = rentals.filter(
                      (r) => (r.status?.toUpperCase() || r.status) === status
                    )
                    const isActive = statusFilter === status

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (statusFilter !== status) {
                            setStatusFilter(status)
                          }
                        }}
                        className={cn(
                          'group flex flex-col items-center justify-center gap-2 px-6 py-4 md:px-4 rounded-lg border transition-all duration-300 relative',
                          'bg-transparent hover:bg-background border-gray-200 shadow-md hover:shadow-lg',
                          isActive && 'shadow-lg'
                        )}
                        title={`Ver locações ${config.label.toLowerCase()}`}
                        aria-label={`Filtrar por ${config.label}`}
                      >
                        {totalStatusRentals.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="absolute top-2 right-2 text-xs"
                          >
                            {totalStatusRentals.length}
                          </Badge>
                        )}
                        <div
                          className={cn(
                            'p-2 rounded-lg bg-gradient-to-br transition-all duration-300 flex items-center justify-center',
                            config.gradient,
                            isActive && 'scale-110'
                          )}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span
                          className={cn(
                            'text-sm md:text-xs font-medium text-center leading-tight transition-all duration-300',
                            isActive
                              ? 'text-orange-600 font-semibold'
                              : 'text-gray-700 group-hover:text-orange-600'
                          )}
                        >
                          {config.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Filtros - Busca e Dropdowns */}
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                  <div className="flex flex-col md:flex-row gap-3 flex-1 w-full items-center">
                    <div className="relative flex-1 w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar por cliente, email, telefone, empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="w-full md:w-auto">
                      <div className="flex items-center gap-3">
                        <FilterSelectGroup
                          filters={[
                            {
                              label: 'Período',
                              value: periodFilter,
                              onValueChange: setPeriodFilter,
                              placeholder: 'Filtrar por período',
                              options: [
                                { value: 'all', label: 'Todos os períodos' },
                                { value: 'today', label: 'Hoje' },
                                { value: 'week', label: 'Última semana' },
                                { value: 'month', label: 'Último mês' },
                              ],
                            },
                          ]}
                          gap="sm"
                        />
                        <FilterResetButton
                          onClick={() => {
                            setPeriodFilter('all')
                            setSearchTerm('')
                          }}
                          title="Resetar filtros"
                          size="md"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center w-full">
                    <ViewToggle
                      options={[
                        { value: 'table', label: 'Tabela', icon: List },
                        {
                          value: 'calendar',
                          label: 'Calendário',
                          icon: Calendar,
                        },
                      ]}
                      value={viewMode}
                      onValueChange={(value) =>
                        setViewMode(value as 'table' | 'calendar')
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Calendário Avançado de Locações */}
        {viewMode === 'calendar' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <AdminCard title="Calendário de Locações" variant="flat">
              <AdvancedCalendar
                events={calendarEvents}
                resources={calendarResources}
                onEventClick={(event) => {
                  const rental = filteredRentals.find((r) => r.id === event.id)
                  if (rental) {
                    setSelectedRental(rental)
                  }
                }}
                defaultViewMode="weekly"
              />
            </AdminCard>
          </motion.div>
        )}

        {/* Lista de Locações Filtradas - Tabela */}
        {filteredRentals.length > 0 && viewMode === 'table' && (
          <RentalTable
            paginatedRentals={paginatedRentals}
            totalItems={filteredRentals.length}
            currentPage={tableCurrentPage}
            totalPages={tableTotalPages}
            onPageChange={setTablePage}
            onSelectRental={setSelectedRental}
          />
        )}

        {/* Mensagem quando não há locações */}
        {!loading &&
          viewMode !== 'calendar' &&
          filteredRentals.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <Card className="bg-white shadow-lg border-0">
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma locação encontrada
                  </h3>
                  <p className="text-sm text-gray-500">
                    {statusFilter !== 'all'
                      ? `Não há locações com status "${statusConfig[statusFilter]?.label || statusFilter}"`
                      : 'Não há locações cadastradas no sistema'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

        {/* Mensagem quando não há locações no calendário */}
        {!loading &&
          viewMode === 'calendar' &&
          filteredRentals.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <Card className="bg-white shadow-lg border-0">
                <CardContent className="p-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma locação encontrada
                  </h3>
                  <p className="text-sm text-gray-500">
                    {statusFilter !== 'all'
                      ? `Não há locações com status "${statusConfig[statusFilter]?.label || statusFilter}" para exibir no calendário`
                      : 'Não há locações cadastradas no sistema'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

        {/* Dialog de Detalhes */}
        <RentalDetailDialog
          rental={selectedRental}
          clientDocuments={clientDocuments}
          uploadingDocumentType={uploadingDocumentType}
          contractLoading={contractLoading}
          onClose={() => setSelectedRental(null)}
          onGenerateContract={handleGenerateContract}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onUploadDocument={handleUploadClientDocument}
        />
      </div>
    </div>
  )
}

export function AdminRentalsPage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session, status } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    status,
    revision,
  ])
  return <AdminRentalsPageContent key={scope} />
}
