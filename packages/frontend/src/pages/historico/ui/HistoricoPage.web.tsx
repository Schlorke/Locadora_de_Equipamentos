'use client'

import { useHistory, useHistoryScope } from '../model/use-history'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { ClientAreaBadge } from '../../../features/selo-area-cliente'
import { SearchBar } from '@gb-locacoes/ui'
import {
  Calendar,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ArrowRight,
  ArrowLeft,
  Trash2,
  MapPin,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from '@gb-locacoes/ui'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogHeaderIcon,
  AlertDialogTitle,
} from '@gb-locacoes/ui'

// Função para formatar endereço completo
const statusConfig: Record<
  string,
  {
    label: string
    color: string
    icon: React.ComponentType<{ className?: string }>
    statusKey: string
  }
> = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-orange-100 text-orange-800',
    icon: Clock,
    statusKey: 'pending',
  },
  ACTIVE: {
    label: 'Em Andamento',
    color: 'bg-orange-100 text-orange-800',
    icon: Package,
    statusKey: 'in_progress',
  },
  COMPLETED: {
    label: 'Concluído',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    statusKey: 'completed',
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    statusKey: 'cancelled',
  },
  OVERDUE: {
    label: 'Atrasado',
    color: 'bg-red-100 text-red-800',
    icon: AlertCircle,
    statusKey: 'in_progress',
  },
}

function HistoricoPageContent() {
  const router = useRouter()
  const {
    quotes,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    rentalToDelete,
    setRentalToDelete,
    quoteToDelete,
    setQuoteToDelete,
    isDeleting,
    isDeletingQuote,
    handleDeleteRental,
    handleDeleteQuote,
    filteredItems,
    quoteToRentalMap,
    formatCurrency,
    formatDate,
    formatDeliveryAddress,
  } = useHistory()
  const getStatusInfo = (status: string) => {
    return (
      statusConfig[status] || {
        label: 'Desconhecido',
        color: 'bg-gray-100 text-gray-800',
        icon: AlertCircle,
        statusKey: 'unknown',
      }
    )
  }

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
          className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
      {/* Hero Section */}
      <section
        id="dashboard-banner"
        className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
      >
        {/* Elementos animados de background removidos nesta seção da área do cliente */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button
              variant="ghost"
              onClick={() => router.push('/area-cliente')}
              className="mb-4 text-[0.9375rem] text-white hover:text-white hover:scale-100 hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold leading-tight">
                Meus Orçamentos
              </h1>
              <p className="text-base md:text-lg text-white leading-relaxed max-w-2xl mx-auto">
                Acompanhe todas as suas solicitações de orçamento e locações
              </p>
            </div>
          </motion.div>
        </div>

        {/* Onda SVG no final */}
        <div className="relative w-full overflow-hidden">
          <svg
            className="relative block w-full h-12"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
              className="fill-gray-50"
            />
          </svg>
        </div>
      </section>

      {/* Content */}
      <section className="-mt-20 lg:py-10 md:-mt-24 md:py-16 py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {/* Search Bar */}
          <motion.div
            className="mb-8 relative z-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <SearchBar
              searchPlaceholder="Buscar por equipamento..."
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              filters={[
                {
                  label: 'Status',
                  value: statusFilter,
                  onValueChange: setStatusFilter,
                  placeholder: 'Filtrar por status',
                  options: [
                    { value: 'all', label: 'Todos os status' },
                    { value: 'pending', label: 'Pendente' },
                    { value: 'approved', label: 'Aprovado' },
                    { value: 'in_progress', label: 'Em Andamento' },
                    { value: 'completed', label: 'Concluído' },
                    { value: 'cancelled', label: 'Cancelado' },
                  ],
                },
              ]}
            />
          </motion.div>

          {/* History Items List */}
          <motion.div
            className="mt-8 space-y-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {filteredItems.map((item, index) => {
              if (item.type === 'rental') {
                const rental = item.data
                const statusInfo = getStatusInfo(rental.status)
                const StatusIcon = statusInfo.icon
                const totalQuantity = rental.rental_items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                )
                const totalDays = rental.rental_items[0]?.totaldays || 0
                const equipmentNames = rental.rental_items
                  .map((item) => item.equipments.name)
                  .join(', ')

                return (
                  <motion.div
                    key={`rental-${rental.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group z-0 border-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
                      <CardContent className="p-6 sm:p-6 relative z-0">
                        {/* Linha 1: Título (coluna 1) + Botões (coluna 2) */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          {/* Coluna 1: Título com ícone e badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white shrink-0">
                                <Package className="h-5 w-5" />
                              </div>
                              <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex-1 min-w-0">
                                {equipmentNames}
                              </h3>
                            </div>
                            <ClientAreaBadge
                              className={`${statusInfo.color} px-3 py-1 rounded-full font-medium self-start sm:self-center shrink-0`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </ClientAreaBadge>
                          </div>

                          {/* Coluna 2: Botões de ação */}
                          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto sm:flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg group border border-gray-200"
                              asChild
                            >
                              <Link
                                href={`/area-cliente/historico/${rental.id}`}
                              >
                                <Eye className="h-4 w-4" />
                                Ver Detalhes
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRentalToDelete(rental.id)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-900 hover:text-red-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </div>

                        {/* Linha 2: Quantidade, Período e Valor Total (uma linha só) */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Quantidade:</span>
                            <span className="font-bold text-gray-900">
                              {totalQuantity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Período:</span>
                            <span className="font-bold text-gray-900">
                              {totalDays} dias
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Valor Total:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(rental.total)}
                            </span>
                          </div>
                        </div>

                        {/* Linha 3: Notas (se houver, uma linha só) */}
                        {rental.notes && (
                          <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-xl">
                            {rental.notes}
                          </p>
                        )}

                        {/* Linha 4: Datas de Início e Fim (uma linha só) */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Início:</span>
                            <span className="font-medium text-gray-700">
                              {formatDate(rental.startdate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Fim:</span>
                            <span className="font-medium text-gray-700">
                              {formatDate(rental.enddate)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              } else {
                // Renderizar orçamento no mesmo estilo de locação
                const quote = item.data
                const statusInfo = getStatusInfo(
                  quote.status === 'pending'
                    ? 'PENDING'
                    : quote.status === 'approved'
                      ? 'ACTIVE'
                      : quote.status === 'rejected'
                        ? 'CANCELLED'
                        : 'COMPLETED'
                )
                const StatusIcon = statusInfo.icon
                const equipmentNames =
                  quote.items?.map((item) => item.equipment.name).join(', ') ||
                  'N/A'

                // Calcular quantidade total e período total do orçamento
                const totalQuantity =
                  quote.items?.reduce((sum, item) => sum + item.quantity, 0) ||
                  0
                const totalDays = quote.items?.[0]?.days || 0

                // Para orçamentos, usar datas dos itens se existirem
                // Se não tiver startDate/endDate, calcular baseado em createdAt + days
                let startDate = quote.items?.[0]?.startDate || quote.createdAt
                let endDate = quote.items?.[0]?.endDate

                // Se não tiver endDate mas tiver days, calcular
                if (!endDate && totalDays > 0 && startDate) {
                  const start = new Date(startDate)
                  start.setDate(start.getDate() + totalDays - 1)
                  endDate = start.toISOString()
                } else if (!endDate) {
                  endDate = startDate
                }

                return (
                  <motion.div
                    key={`quote-${quote.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group z-0 border-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
                      <CardContent className="p-6 sm:p-6 relative z-0">
                        {/* Linha 1: Título (coluna 1) + Botões (coluna 2) */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          {/* Coluna 1: Título com ícone e badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white shrink-0">
                                <Package className="h-5 w-5" />
                              </div>
                              <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex-1 min-w-0">
                                {equipmentNames}
                              </h3>
                            </div>
                            <ClientAreaBadge
                              className={`${statusInfo.color} px-3 py-1 rounded-full font-medium self-start sm:self-center shrink-0`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </ClientAreaBadge>
                          </div>

                          {/* Coluna 2: Botões de ação */}
                          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto sm:flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg group border border-gray-200"
                              asChild
                            >
                              <Link
                                href={
                                  quoteToRentalMap.has(quote.id)
                                    ? `/area-cliente/historico/${quoteToRentalMap.get(quote.id)}`
                                    : `/area-cliente/historico/quote_${quote.id}`
                                }
                              >
                                <Eye className="h-4 w-4" />
                                Ver Detalhes
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQuoteToDelete(quote.id)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-900 hover:text-red-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                              disabled={isDeletingQuote}
                            >
                              <Trash2 className="h-4 w-4" />
                              {quote.status === 'pending'
                                ? 'Cancelar'
                                : 'Excluir'}
                            </Button>
                          </div>
                        </div>

                        {/* Linha 2: Quantidade, Período e Valor Total (uma linha só) */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Quantidade:</span>
                            <span className="font-bold text-gray-900">
                              {totalQuantity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Período:</span>
                            <span className="font-bold text-gray-900">
                              {totalDays} dias
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                            <span className="font-medium">Valor Total:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(
                                quote.finalTotal ??
                                  quote.originalTotal ??
                                  quote.totalPrice ??
                                  0
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Linha 3: Empresa e Tipo de Entrega (se houver) */}
                        {(quote.company || quote.deliveryType) && (
                          <div className="flex flex-wrap gap-3 mb-4">
                            {quote.company && (
                              <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-xl">
                                <span className="font-semibold text-gray-700">
                                  Empresa:
                                </span>{' '}
                                {quote.company}
                              </p>
                            )}
                            {quote.deliveryType && (
                              <div className="flex items-start gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-xl">
                                <MapPin className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                                <div>
                                  <span className="font-semibold text-gray-700 block">
                                    {quote.deliveryType === 'DELIVERY'
                                      ? 'Entrega no Endereço:'
                                      : 'Retirar em Loja'}
                                  </span>
                                  {quote.deliveryAddress && (
                                    <span className="text-gray-600">
                                      {typeof quote.deliveryAddress === 'string'
                                        ? quote.deliveryAddress
                                        : formatDeliveryAddress(
                                            quote.deliveryAddress
                                          )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Linha 4: Datas de Início e Fim (uma linha só) */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Início:</span>
                            <span className="font-medium text-gray-700">
                              {formatDate(startDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Fim:</span>
                            <span className="font-medium text-gray-700">
                              {formatDate(endDate)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              }
            })}
          </motion.div>

          {filteredItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl z-0 border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
                <CardContent className="text-center py-16 relative z-0">
                  <div className="p-6 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Package className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3">
                    Nenhuma locação encontrada
                  </h3>
                  <p className="text-gray-600 mb-6 text-sm sm:text-lg">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Tente ajustar os filtros de busca'
                      : 'Você ainda não possui histórico de locações'}
                  </p>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button
                      variant="outline"
                      size="default"
                      className="inline-flex items-center gap-2 px-6 group rounded-lg bg-white text-gray-900 hover:text-orange-600 border border-gray-200 hover:border-gray-200"
                      asChild
                    >
                      <Link href="/orcamento">
                        Solicitar Primeiro Orçamento
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>

      {/* Dialog de confirmação de exclusão de locação */}
      <AlertDialog
        open={rentalToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRentalToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogHeaderIcon />
            <AlertDialogTitle>Excluir locação do histórico?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-4 md:p-6">
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A locação será permanentemente
              removida do seu histórico.
              <br />
              <br />
              <strong>Você tem certeza que deseja continuar?</strong>
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRental}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão de orçamento */}
      <AlertDialog
        open={quoteToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQuoteToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogHeaderIcon />
            <AlertDialogTitle>
              {quotes.find((q) => q.id === quoteToDelete)?.status === 'pending'
                ? 'Cancelar orçamento?'
                : 'Excluir orçamento?'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-4 md:p-6">
            <AlertDialogDescription>
              {quotes.find((q) => q.id === quoteToDelete)?.status === 'pending'
                ? 'O orçamento será cancelado e removido permanentemente. Esta ação não pode ser desfeita.'
                : 'Esta ação não pode ser desfeita. O orçamento será permanentemente excluído.'}
              <br />
              <br />
              <strong>Você tem certeza que deseja continuar?</strong>
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingQuote}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuote}
              disabled={isDeletingQuote}
            >
              {isDeletingQuote
                ? quotes.find((q) => q.id === quoteToDelete)?.status ===
                  'pending'
                  ? 'Cancelando...'
                  : 'Excluindo...'
                : quotes.find((q) => q.id === quoteToDelete)?.status ===
                    'pending'
                  ? 'Sim, cancelar'
                  : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function HistoricoPage() {
  return <HistoricoPageContent key={useHistoryScope()} />
}
