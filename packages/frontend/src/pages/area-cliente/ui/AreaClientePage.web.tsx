'use client'

import { useAreaCliente, useAreaClienteScope } from '../model/use-area-cliente'
import type { CustomerActivity as Activity } from '../../../entities/cliente'
import Image from 'next/image'
import { Button } from '@gb-locacoes/ui'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import {
  FileText,
  Clock,
  ShoppingCart,
  TrendingUp,
  Plus,
  Package,
  Eye,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  XCircle,
  ArrowRight,
  X,
  MapPin,
} from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { getPricingConfig } from '../../../entities/equipamento'

const statusConfig: Record<
  string,
  {
    label: string
    color: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-orange-100 text-orange-800',
    icon: Clock,
  },
  ACTIVE: {
    label: 'Ativa',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
  },
  COMPLETED: {
    label: 'Concluída',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  OVERDUE: {
    label: 'Atrasada',
    color: 'bg-red-100 text-red-800',
    icon: AlertTriangle,
  },
}

function AreaClientePageContent() {
  const {
    session,
    rentals,
    loading,
    quotesCount,
    quotes,
    activities,
    activitiesLoading,
    dismissedActivities,
    itemCount,
    mounted,
    cartItems,
    getTotalPrice,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatDeliveryAddress,
    formatRelativeTime,
    dismissActivity,
    formatCartDate,
    resolveDateRange,
    calculateSubtotal,
    getEquipmentImage,
    activeRentals,
  } = useAreaCliente()
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'quote_created':
        return FileText
      case 'quote_approved':
        return CheckCircle
      case 'quote_rejected':
        return XCircle
      case 'rental_created':
        return Package
      case 'rental_completed':
        return CheckCircle
      case 'payment_made':
        return DollarSign
      case 'rental_updated':
        return Clock
      default:
        return Clock
    }
  }

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'quote_created':
        return 'text-blue-600 bg-blue-100'
      case 'quote_approved':
        return 'text-green-600 bg-green-100'
      case 'quote_rejected':
        return 'text-red-600 bg-red-100'
      case 'rental_created':
        return 'text-purple-600 bg-purple-100'
      case 'rental_completed':
        return 'text-green-600 bg-green-100'
      case 'payment_made':
        return 'text-emerald-600 bg-emerald-100'
      case 'rental_updated':
        return 'text-orange-600 bg-orange-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div
      className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0"
      id="area-cliente-dashboard"
    >
      {/* Hero Section com Identidade Visual Completa */}
      <section
        className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
        id="dashboard-banner"
      >
        {/* Elementos animados de background removidos nesta seção da área do cliente */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 lg:py-14 relative z-10">
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold leading-tight">
              Bem-vindo de volta,
              <span className="text-yellow-300 relative block mt-1">
                {session?.user?.name || 'Cliente'}!
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-yellow-300/90 rounded-full"></div>
              </span>
            </h1>
            <p className="text-base md:text-lg text-white leading-relaxed max-w-2xl mx-auto">
              Gerencie seus orçamentos, acompanhe suas locações e tenha controle
              total sobre seus equipamentos
            </p>
          </motion.div>
        </div>

        {/* Onda SVG no final */}
        <div className="relative w-full overflow-hidden">
          <svg
            className="relative block w-full h-6"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
              fill={
                '#f9fafb' /* token-check-allow: onda SVG do dashboard do cliente; gray-50 ainda não está na paleta */
              }
            />
          </svg>
        </div>
      </section>

      {/* Dashboard Principal - LAYOUT OTIMIZADO */}
      <section className="py-12 md:py-16 lg:py-10 relative -mt-20 md:-mt-24 overflow-visible">
        <div className="sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-visible">
          {/* Stats Grid - 1 coluna em mobile, 3 colunas em desktop */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-stretch"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Card Carrinho - Padrão Histórico */}
            <Link href="/orcamento" className="flex-1 h-full">
              <div className="relative overflow-hidden h-full rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer bg-white/95">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between h-full">
                    <div className="flex flex-col justify-center h-full">
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        Carrinho
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mb-1">
                        {mounted ? itemCount : 0}
                      </p>
                      <p className="text-sm text-gray-500">
                        itens selecionados
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white group-hover:scale-110 transition-transform self-center">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Card Orçamentos - Padrão Histórico */}
            <Link href="/area-cliente/historico" className="h-full">
              <div className="relative overflow-hidden h-full rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer bg-white/95">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between h-full">
                    <div className="flex flex-col justify-center h-full">
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        Orçamentos
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mb-1">
                        {quotesCount}
                      </p>
                      <p className="text-sm text-gray-500">solicitações</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white group-hover:scale-110 transition-transform self-center">
                      <FileText className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Card Total - Padrão Histórico */}
            <Link href="/orcamento" className="h-full">
              <div className="relative overflow-hidden h-full rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer bg-white/95">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between h-full">
                    <div className="flex flex-col justify-center h-full">
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        Total Estimado
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mb-1">
                        R$ {getTotalPrice().toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">no carrinho</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white group-hover:scale-110 transition-transform self-center">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Seções Principais - Layout Proporcional à linha superior */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {/* Meu Carrinho - Layout com Botões no Fundo */}
            <Card className="relative overflow-visible bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col h-full border-0">
              <CardHeader className="relative z-10 pb-6 md:pb-8">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  Meu Carrinho
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 p-6 lg:px-6 pt-0 pb-8 flex flex-col flex-1 overflow-visible">
                {mounted && itemCount > 0 ? (
                  <div className="flex flex-col flex-1 min-h-0 overflow-visible">
                    {/* Bloco unificado com itens e total */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md flex-1 flex flex-col min-h-0 overflow-visible">
                      {/* Lista de itens do carrinho - padding para sombras */}
                      <div className="space-y-4 p-5 flex-1 overflow-y-auto min-h-0">
                        {cartItems.map((equipment, index) => {
                          const displayRange = resolveDateRange(equipment)
                          const pricingConfig = getPricingConfig(
                            equipment,
                            equipment.days
                          )
                          const actualPeriodLabel =
                            pricingConfig.period === 'daily'
                              ? 'Diário'
                              : pricingConfig.period === 'weekly'
                                ? 'Semanal'
                                : pricingConfig.period === 'biweekly'
                                  ? 'Quinzenal'
                                  : pricingConfig.period === 'monthly'
                                    ? 'Mensal'
                                    : 'Diário'
                          const finalPrice = calculateSubtotal(equipment)

                          return (
                            <div
                              key={`cart-item-${equipment.equipmentId}-${index}`}
                              className="flex gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                            >
                              {/* Thumbnail */}
                              <div className="shrink-0">
                                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                                  <Image
                                    src={getEquipmentImage(equipment)}
                                    alt={equipment.equipmentName}
                                    fill
                                    className="object-cover"
                                    sizes="56px"
                                  />
                                </div>
                              </div>

                              {/* Detalhes */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm leading-tight mb-1">
                                  {equipment.equipmentName}
                                </p>
                                <div className="flex flex-wrap gap-1 mb-1">
                                  <span className="text-xs text-gray-600 font-medium">
                                    Qtd: {equipment.quantity}x
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ·
                                  </span>
                                  <span className="text-xs text-orange-600 font-medium">
                                    {actualPeriodLabel}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ·
                                  </span>
                                  <span className="text-xs text-gray-600 font-medium">
                                    {equipment.days} dias
                                  </span>
                                </div>
                                {displayRange && (
                                  <div className="text-xs text-gray-600 mb-1">
                                    {formatCartDate(displayRange.startDate)} até{' '}
                                    {formatCartDate(displayRange.endDate)}
                                    {displayRange.isAuto && (
                                      <span className="text-[10px] text-gray-500">
                                        {' '}
                                        (previsto)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {equipment.includeWeekends !== undefined && (
                                  <div className="flex items-center gap-1.5 text-xs mb-1">
                                    <span
                                      className={
                                        equipment.includeWeekends
                                          ? 'text-green-600 font-semibold'
                                          : 'text-red-600 font-semibold'
                                      }
                                    >
                                      {equipment.includeWeekends ? '✓' : '✗'}
                                    </span>
                                    <span className="text-gray-600 font-semibold">
                                      {equipment.includeWeekends
                                        ? 'Incluir finais de semana'
                                        : 'Não inclui finais de semana'}
                                    </span>
                                  </div>
                                )}
                                <div className="text-sm font-semibold text-green-600">
                                  {formatCurrency(finalPrice)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Total estimado - Separador e valor - Fixo na parte inferior */}
                      <div className="border-t-2 border-orange-200 mx-5 pt-3 pb-5 mt-auto">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">
                            Total Estimado
                          </p>
                          <p className="text-xl md:text-2xl font-bold text-orange-600">
                            {formatCurrency(getTotalPrice())}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Botões fixos na parte inferior */}
                    <div className="flex flex-col sm:flex-row justify-center gap-2 mt-6">
                      <Button
                        size="default"
                        asChild
                        className="w-full sm:flex-1 h-10"
                      >
                        <Link href="/orcamento">
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Ver Carrinho
                        </Link>
                      </Button>
                      <Button
                        size="default"
                        variant="outline"
                        asChild
                        className="w-full sm:flex-1 h-10 bg-white text-gray-900 hover:bg-white hover:text-orange-600 border border-gray-200 hover:border-gray-200 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0"
                      >
                        <Link href="/equipamentos">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Mais
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Área central com ícone e texto */}
                    <div className="flex flex-col flex-1 justify-center items-center text-center px-4 py-8">
                      <div className="space-y-4">
                        <ShoppingCart className="h-12 w-12 md:h-14 md:w-14 text-gray-300 mx-auto" />
                        <p className="text-base md:text-lg font-medium text-gray-500">
                          Seu carrinho está vazio
                        </p>
                      </div>
                    </div>
                    {/* Botão fixo na parte inferior */}
                    <div className="flex justify-center mt-auto">
                      <Button
                        size="default"
                        asChild
                        className="w-full h-10 bg-white text-gray-900 hover:bg-white hover:text-orange-600 border border-gray-200 hover:border-gray-200 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0"
                      >
                        <Link href="/equipamentos">
                          <Plus className="h-4 w-4" />
                          Adicionar Equipamentos
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Minhas Locações / Orçamentos Pendentes - Layout com Lista */}
            <Card className="relative overflow-visible bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full border-0">
              <div className="absolute inset-0 bg-white"></div>
              <CardHeader className="relative z-10 pb-6 md:pb-8">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div
                    className={cn(
                      'p-2 rounded-lg text-white',
                      activeRentals.length > 0
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                        : quotes.filter((q) => q.status === 'pending').length >
                            0
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    )}
                  >
                    {activeRentals.length > 0 ? (
                      <Package className="h-5 w-5" />
                    ) : quotes.filter((q) => q.status === 'pending').length >
                      0 ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </div>
                  {activeRentals.length > 0
                    ? 'Minhas Locações'
                    : quotes.filter((q) => q.status === 'pending').length > 0
                      ? 'Orçamentos Pendentes'
                      : 'Minhas Locações'}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative pb-8 z-10 pt-0 flex flex-col flex-1 overflow-visible">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Clock className="h-8 w-8 text-gray-300 animate-spin" />
                  </div>
                ) : activeRentals.length > 0 ? (
                  <div className="flex flex-col flex-1 min-h-0 overflow-visible">
                    {/* Lista de locações - pode crescer */}
                    <div className="space-y-3 flex-1 min-h-0 overflow-visible p-1">
                      {activeRentals.slice(0, 3).map((rental) => {
                        const StatusIcon =
                          statusConfig[rental.status]?.icon || Clock
                        return (
                          <div
                            key={rental.id}
                            className="group p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {rental.rental_items[0]?.equipments.name ||
                                    'Equipamento'}
                                  {rental.rental_items.length > 1 &&
                                    ` +${rental.rental_items.length - 1}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(rental.startdate)} -{' '}
                                  {formatDate(rental.enddate)}
                                </p>
                                {rental.rental_items[0]?.includeWeekends !==
                                  undefined && (
                                  <div className="flex items-center gap-1.5 text-xs mt-1">
                                    <span
                                      className={
                                        rental.rental_items[0].includeWeekends
                                          ? 'text-green-600 font-semibold'
                                          : 'text-red-600 font-semibold'
                                      }
                                    >
                                      {rental.rental_items[0].includeWeekends
                                        ? '✓'
                                        : '✗'}
                                    </span>
                                    <span className="text-gray-600 font-semibold">
                                      {rental.rental_items[0].includeWeekends
                                        ? 'Incluir finais de semana'
                                        : 'Não inclui finais de semana'}
                                    </span>
                                  </div>
                                )}
                                {rental.createdat && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Solicitado às{' '}
                                    {formatDateTime(rental.createdat)}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  statusConfig[rental.status]?.color
                                )}
                              >
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig[rental.status]?.label}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-green-600">
                                {formatCurrency(rental.total)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="opacity-0 group-hover:opacity-100 transition-all duration-200 [transition-timing-function:ease-in-out] hover:shadow-md hover:bg-white hover:text-[var(--brand)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link
                                  href={`/area-cliente/historico/${rental.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Botão fixo na parte inferior */}
                    <div className="mt-auto pt-4">
                      {activeRentals.length > 3 && (
                        <Button variant="outline" className="w-full" asChild>
                          <Link href="/area-cliente/historico">
                            Ver todas as locações ({rentals.length})
                          </Link>
                        </Button>
                      )}
                      {activeRentals.length <= 3 && rentals.length > 3 && (
                        <Button variant="outline" className="w-full" asChild>
                          <Link href="/area-cliente/historico">
                            Ver todas as locações ({rentals.length})
                          </Link>
                        </Button>
                      )}
                      {/* Botão sempre visível para acessar o histórico completo */}
                      {activeRentals.length <= 3 && rentals.length <= 3 && (
                        <Button variant="outline" className="w-full" asChild>
                          <Link href="/area-cliente/historico">
                            Ver Histórico Completo
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : quotes.filter((q) => q.status === 'pending').length > 0 ? (
                  /* Mostrar orçamentos pendentes quando não há locações ativas */
                  <div className="flex flex-col flex-1 min-h-0 overflow-visible">
                    {/* Lista de orçamentos pendentes - pode crescer */}
                    <div className="space-y-3 flex-1 min-h-0 overflow-visible p-1">
                      {quotes
                        .filter((q) => q.status === 'pending')
                        .slice(0, 3)
                        .map((quote) => {
                          const equipmentNames =
                            quote.items
                              ?.map((item) => item.equipment.name)
                              .join(', ') || 'N/A'
                          const totalQuantity =
                            quote.items?.reduce(
                              (sum, item) => sum + item.quantity,
                              0
                            ) || 0
                          const totalDays = quote.items?.[0]?.days || 0

                          return (
                            <div
                              key={quote.id}
                              className="group p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">
                                    {equipmentNames}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {totalQuantity}x • {totalDays} dias
                                  </p>
                                  {quote.deliveryType && (
                                    <div className="flex items-center gap-1.5 text-xs mt-1">
                                      <MapPin className="h-3 w-3 text-orange-500" />
                                      <span className="text-gray-600 font-medium truncate">
                                        {quote.deliveryType === 'DELIVERY'
                                          ? formatDeliveryAddress(
                                              quote.deliveryAddress
                                            )
                                          : 'Retirar em Loja'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-orange-100 text-orange-800 ml-2 shrink-0"
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pendente
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-green-600">
                                  {formatCurrency(
                                    quote.finalTotal ??
                                      quote.originalTotal ??
                                      quote.totalPrice ??
                                      0
                                  )}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 [transition-timing-function:ease-in-out] hover:shadow-md hover:bg-white"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Link
                                    href={`/area-cliente/historico/quote_${quote.id}`}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Ver
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    {/* Botão fixo na parte inferior */}
                    <div className="mt-auto pt-4">
                      <Button variant="outline" className="w-full" asChild>
                        <Link href="/area-cliente/historico">
                          Ver todos os orçamentos (
                          {quotes.filter((q) => q.status === 'pending').length})
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex flex-col flex-1 justify-center items-center text-center py-8">
                      <div className="space-y-4">
                        <Package className="h-12 w-12 md:h-14 md:w-14 text-gray-300 mx-auto" />
                        <p className="text-base md:text-lg font-medium text-gray-500">
                          Nenhuma locação ativa
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                      <Button size="default" asChild className="w-full h-10">
                        <Link href="/area-cliente/historico">
                          <Clock className="h-4 w-4 mr-2" />
                          Ver Histórico
                        </Link>
                      </Button>
                      <Button
                        size="default"
                        variant="outline"
                        asChild
                        className="w-full h-10"
                      >
                        <Link href="/equipamentos">
                          <Plus className="h-4 w-4 mr-2" />
                          Alugar Equipamentos
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Atividade Recente - Seção Compacta */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card className="relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
              <CardHeader className="relative z-10 pb-6 md:pb-8">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white">
                    <Clock className="h-5 w-5" />
                  </div>
                  Atividade Recente
                </CardTitle>
                <CardDescription>
                  Suas últimas ações na plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="relative pb-8 z-10 pt-0 overflow-visible">
                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Clock className="h-8 w-8 text-gray-300 animate-spin" />
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto px-4 py-3 -mx-2">
                    {activities
                      .filter(
                        (activity) => !dismissedActivities.has(activity.id)
                      )
                      .map((activity) => {
                        const Icon = getActivityIcon(activity.type)
                        const colorClass = getActivityColor(activity.type)
                        const ActivityContent = (
                          <div className="group relative p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                            {/* Seta à esquerda do botão close, centralizada verticalmente */}
                            {activity.link && (
                              <ArrowRight className="absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-hover:text-orange-600 transition-all duration-300 shrink-0 z-10" />
                            )}
                            {/* Botão de fechar no canto superior direito */}
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                dismissActivity(activity.id)
                              }}
                              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-lg disabled:pointer-events-none disabled:opacity-50 transition-all duration-300 text-slate-400 hover:text-slate-600 hover:bg-white focus:outline-hidden focus:ring-0 opacity-0 [.group:hover_&]:opacity-100 z-10"
                              aria-label="Remover atividade"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'p-2 rounded-lg shrink-0',
                                  colorClass
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0 pr-12">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="font-semibold text-gray-900 text-sm flex-1">
                                    {activity.title}
                                  </p>
                                  {activity.metadata?.amount && (
                                    <span className="text-sm font-bold text-green-600 shrink-0">
                                      {formatCurrency(activity.metadata.amount)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {activity.description}
                                </p>
                                <div className="flex items-center">
                                  <span className="text-xs text-gray-500">
                                    {formatRelativeTime(activity.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )

                        return activity.link ? (
                          <Link
                            key={activity.id}
                            href={activity.link}
                            className="block"
                          >
                            {ActivityContent}
                          </Link>
                        ) : (
                          <div key={activity.id}>{ActivityContent}</div>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center flex flex-col flex-1 justify-center py-16">
                    <Clock className="h-16 w-16 text-gray-300 mx-auto mt-[0.78rem] mb-[0.5rem]" />
                    <p className="text-[18px] font-2x1 text-gray-500">
                      Nenhuma atividade recente
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export function AreaClientePage() {
  return <AreaClientePageContent key={useAreaClienteScope()} />
}
