'use client'

import { useEffect } from 'react'
import {
  useRentalDetail,
  useRentalDetailScope,
} from '../model/use-rental-detail'
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  coerceNumber,
  normalizedPeriodLabel,
  getRentalTotals,
  getQuoteItemPrice,
  getRentalQuoteItemPrice,
} from '../model/presentation'
import { quoteTimeline, rentalTimeline } from '../model/timeline'
import { isAbortError, HttpError } from '../../../shared/api'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@gb-locacoes/ui'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { ClientAreaBadge } from '../../../features/selo-area-cliente'
import { motion } from 'framer-motion'
import {
  Package,
  Calendar,
  DollarSign,
  MapPin,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  Phone,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@gb-locacoes/ui'
import Image from 'next/image'
import { RentalTimeline } from './LinhaDoTempo.web'
import { EquipmentQuotePriceBlock } from '../../../features/bloco-preco'
import { usePublicSettings } from '../../../entities/configuracao'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import {
  parseAdjustmentBlocks,
  ADJUSTMENT_CATEGORY_LABELS,
} from '../../../entities/orcamento'

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

function RentalDetailsPageContent({ paramId }: { paramId: string | null }) {
  const router = useRouter()
  const { settings } = usePublicSettings()
  const {
    rental,
    quote,
    loading,
    isDeletingQuote,
    showDeleteDialog,
    setShowDeleteDialog,
    showAdjustmentDialog,
    setShowAdjustmentDialog,
    showCancelFromAdjustment,
    setShowCancelFromAdjustment,
    isQuote,
    fetchRental,
    handleDeleteQuote,
    rentalApi,
  } = useRentalDetail(paramId, router.push)
  // Lock scroll da página quando dialog de reajuste estiver aberta
  // Ref: docs/issues/known-issues.md ## 9. Backdrop incompleto e scroll liberado
  useEffect(() => {
    if (!showAdjustmentDialog) return
    document.documentElement.classList.add('overflow-hidden')
    document.body.classList.add('overflow-hidden')
    return () => {
      document.documentElement.classList.remove('overflow-hidden')
      document.body.classList.remove('overflow-hidden')
    }
  }, [showAdjustmentDialog])

  // Formata telefone para formato tel: (remove caracteres especiais e adiciona +55)
  const formatPhoneForTel = (phone: string): string => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.startsWith('55')) {
      return `+${cleanPhone}`
    }
    return `+55${cleanPhone}`
  }

  const getStatusInfo = (status: string) => {
    return (
      statusConfig[status] || {
        label: 'Desconhecido',
        color: 'bg-gray-100 text-gray-800',
        icon: Clock,
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

  if (!rental && !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md rounded-2xl shadow-xl border-0">
          <CardContent className="p-12 text-center">
            <div className="p-6 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {isQuote ? 'Orçamento não encontrado' : 'Locação não encontrada'}
            </h3>
            <Button asChild className="mt-4">
              <Link href="/area-cliente">Voltar para Área do Cliente</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Se for um orçamento, renderizar a visualização de orçamento
  if (isQuote && quote) {
    const quoteStatusConfig: Record<
      string,
      {
        label: string
        color: string
        icon: React.ComponentType<{ className?: string }>
      }
    > = {
      pending: {
        label: 'Pendente',
        color: 'bg-orange-100 text-orange-800',
        icon: Clock,
      },
      approved: {
        label: 'Aprovado',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
      },
      rejected: {
        label: 'Rejeitado',
        color: 'bg-red-100 text-red-800',
        icon: AlertTriangle,
      },
      completed: {
        label: 'Concluído',
        color: 'bg-blue-100 text-blue-800',
        icon: CheckCircle,
      },
    }

    const defaultStatus = {
      label: 'Pendente',
      color: 'bg-orange-100 text-orange-800',
      icon: Clock,
    }
    const quoteStatusInfo = quoteStatusConfig[quote.status] ?? defaultStatus
    const QuoteStatusIcon = quoteStatusInfo.icon
    const quoteCodeDisplay =
      quote.quoteCode || quote.legacyExternalCode || quote.id
    // O total já inclui o frete (deliveryFee + pickupFee) quando o orçamento é criado
    // Portanto, não devemos somar o frete novamente
    const quoteTotalValue =
      quote.finalTotal ?? quote.originalTotal ?? quote.totalPrice ?? 0

    return (
      <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
        {/* Hero Section */}
        <section
          id="dashboard-banner"
          className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Button
                variant="ghost"
                onClick={() => router.push('/area-cliente/historico')}
                className="mb-4 text-[0.9375rem] text-white hover:text-white hover:scale-100 hover:underline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Histórico
              </Button>
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold leading-tight">
                  Detalhes do Orçamento
                </h1>
                <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-2xl mx-auto">
                  Código: {quoteCodeDisplay}
                </p>
                <div className="flex justify-center">
                  <ClientAreaBadge
                    className={`${quoteStatusInfo.color} px-4 py-2 rounded-full font-medium text-sm`}
                  >
                    <QuoteStatusIcon className="h-4 w-4 mr-2" />
                    {quoteStatusInfo.label}
                  </ClientAreaBadge>
                </div>

                {/* Banner de Reajuste */}
                {((quote.adjustments?.length ?? 0) > 0 ||
                  quote.priceAdjustmentReason) &&
                  quote.finalTotal != null && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="mt-4 mx-auto max-w-xl"
                    >
                      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <AlertTriangle className="w-6 h-6 text-amber-600" />
                          <p className="text-base font-semibold text-gray-900">
                            Valor do orçamento foi reajustado
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 text-base">
                          <span className="text-gray-500 line-through">
                            {formatCurrency(
                              quote.originalTotal ?? quote.totalPrice ?? 0
                            )}
                          </span>
                          <span className="text-gray-500">&rarr;</span>
                          <span className="text-gray-900 font-bold text-lg">
                            {formatCurrency(quote.finalTotal)}
                          </span>
                        </div>
                        <div className="inline-flex flex-col items-stretch gap-2 mt-3 mx-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAdjustmentDialog(true)}
                            className="w-full bg-white border-gray-200 text-gray-900 hover:text-orange-600"
                          >
                            Ver Detalhes do Reajuste
                          </Button>
                          {(() => {
                            const boletoPayment = quote.payments?.find(
                              (p) => p.method === 'BOLETO' && p.metadata?.pdfUrl
                            )
                            if (!boletoPayment) return null
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="w-full bg-white border-gray-200 text-gray-900 hover:text-orange-600"
                              >
                                <a
                                  href={boletoPayment.metadata!.pdfUrl!}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Baixar Boleto
                                </a>
                              </Button>
                            )
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  )}
              </div>
            </motion.div>
          </div>

          {/* Onda SVG */}
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
        <section className="-mt-20 lg:py-10 md:-mt-24 md:py-16 py-12 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Conteúdo Principal */}
              <div className="lg:col-span-2 space-y-6">
                {/* Equipamentos */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                          <Package className="h-5 w-5" />
                        </div>
                        Equipamentos
                      </CardTitle>
                      <CardDescription>
                        {quote.items?.length || 0} item(s) no orçamento
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      {quote.items?.map((item) => {
                        const equipmentImage =
                          item.equipment.images?.[0] ||
                          `/placeholder.svg?height=80&width=80&text=${encodeURIComponent(item.equipment.name)}`
                        const {
                          finalPrice,
                          originalPrice,
                          variant: variantEquip,
                        } = getQuoteItemPrice(item)

                        return (
                          <div
                            key={item.id}
                            className="p-4 bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              <div className="shrink-0">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                  <Image
                                    src={equipmentImage}
                                    alt={item.equipment.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <EquipmentQuotePriceBlock
                                  equipmentName={item.equipment.name}
                                  originalPrice={originalPrice}
                                  finalPrice={finalPrice}
                                  variant={variantEquip}
                                  inlineOriginalPrice
                                />
                                {item.equipment.category && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {item.equipment.category.name}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />
                                    <span>Qtd: {item.quantity}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                    <span>{item.days} dias</span>
                                  </div>
                                </div>
                                {item.includeWeekends !== undefined && (
                                  <div className="flex items-center gap-1.5 text-xs mt-2">
                                    <span
                                      className={
                                        item.includeWeekends
                                          ? 'text-green-600 font-semibold'
                                          : 'text-red-600 font-semibold'
                                      }
                                    >
                                      {item.includeWeekends ? '✓' : '✗'}
                                    </span>
                                    <span className="text-gray-600 font-semibold">
                                      {item.includeWeekends
                                        ? 'Inclui finais de semana'
                                        : 'Não inclui finais de semana'}
                                    </span>
                                  </div>
                                )}
                                {item.startDate && item.endDate && (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-600 font-semibold mt-2">
                                    <span>Período:</span>
                                    <span className="break-words">
                                      {formatDateShort(item.startDate)} até{' '}
                                      {formatDateShort(item.endDate)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Informações de Entrega */}
                {(quote.deliveryType || quote.deliveryAddress) && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                  >
                    <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                          <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                            <Truck className="h-5 w-5" />
                          </div>
                          Informações de Entrega
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          {quote.deliveryType && (
                            <div className="p-4 bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-gray-500">
                                  Forma de Entrega
                                </p>
                                {((quote.deliveryFee ?? 0) > 0 ||
                                  (quote.pickupFee ?? 0) > 0) && (
                                  <p className="font-bold text-lg text-orange-600">
                                    {formatCurrency(
                                      (quote.deliveryFee ?? 0) +
                                        (quote.pickupFee ?? 0)
                                    )}
                                  </p>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-900 mb-3">
                                {quote.deliveryType === 'DELIVERY'
                                  ? 'Entrega no Endereço'
                                  : quote.deliveryType === 'PICKUP'
                                    ? 'Retirada em Loja'
                                    : quote.deliveryType}
                              </p>

                              {quote.deliveryType === 'DELIVERY' &&
                                quote.deliveryAddress && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-500 mb-2">
                                          Endereço de Entrega
                                        </p>
                                        <div className="text-sm text-gray-900 space-y-1">
                                          {(() => {
                                            const address =
                                              quote.deliveryAddress
                                            if (
                                              !address ||
                                              typeof address !== 'object'
                                            ) {
                                              return (
                                                <p className="text-gray-500">
                                                  Endereço não informado
                                                </p>
                                              )
                                            }

                                            const addressParts = []
                                            const street =
                                              address.street ||
                                              address.logradouro
                                            if (street) {
                                              let streetLine = street
                                              if (address.number)
                                                streetLine += `, ${address.number}`
                                              if (address.complement)
                                                streetLine += ` - ${address.complement}`
                                              addressParts.push(streetLine)
                                            }
                                            const neighborhood =
                                              address.neighborhood ||
                                              address.bairro
                                            if (neighborhood)
                                              addressParts.push(neighborhood)
                                            const city =
                                              address.city || address.cidade
                                            const state =
                                              address.state || address.estado
                                            const zipCode =
                                              address.zipCode || address.cep
                                            if (city || state) {
                                              let cityState = city || ''
                                              if (city && state)
                                                cityState += ' - '
                                              if (state) cityState += state
                                              if (zipCode)
                                                cityState += ` - ${zipCode}`
                                              if (cityState)
                                                addressParts.push(cityState)
                                            }

                                            return addressParts.length > 0 ? (
                                              addressParts.map(
                                                (part, index) => (
                                                  <p
                                                    key={index}
                                                    className="text-sm"
                                                  >
                                                    {part}
                                                  </p>
                                                )
                                              )
                                            ) : (
                                              <p className="text-sm text-gray-500">
                                                Endereço não informado
                                              </p>
                                            )
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Linha do Tempo */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.45 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                          <Clock className="h-5 w-5" />
                        </div>
                        Linha do Tempo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <RentalTimeline
                        steps={
                          // Se rejeitado, mostra fluxo de rejeição
                          quoteTimeline(quote)
                        }
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Resumo */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                          <DollarSign className="h-5 w-5" />
                        </div>
                        Resumo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      {/* Descontos aplicados e Total */}
                      {quote.items &&
                      quote.items.some(
                        (item) =>
                          (item.appliedDiscount ?? 0) > 0 ||
                          (item.useDirectValue === true &&
                            (item.directValue ?? 0) > 0)
                      ) ? (
                        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md">
                          <p className="text-sm font-semibold text-orange-700 mb-3">
                            Desconto Aplicado
                          </p>
                          <div className="mb-4">
                            <div className="p-4 bg-gray-50 rounded-xl shadow-md space-y-4">
                              {quote.items.map((item, itemIndex) => {
                                const quantity = coerceNumber(item.quantity, 0)
                                const days = coerceNumber(item.days, 0)
                                const pricePerDay = coerceNumber(
                                  item.pricePerDay,
                                  0
                                )
                                const finalPrice = coerceNumber(item.total, 0)
                                const appliedDiscount =
                                  item.appliedDiscount ?? 0
                                const hasDiscount =
                                  appliedDiscount > 0 && !item.useDirectValue
                                const hasDirectValue =
                                  item.useDirectValue === true &&
                                  (item.directValue ?? 0) > 0
                                const periodLabel = normalizedPeriodLabel(
                                  item.appliedPeriod
                                )
                                const originalPrice = hasDiscount
                                  ? appliedDiscount >= 100
                                    ? finalPrice
                                    : finalPrice / (1 - appliedDiscount / 100)
                                  : pricePerDay * days * quantity
                                const discountAmount =
                                  originalPrice - finalPrice
                                const variant = hasDiscount
                                  ? {
                                      kind: 'discount' as const,
                                      periodLabel,
                                      appliedDiscount,
                                      discountAmount,
                                    }
                                  : hasDirectValue
                                    ? {
                                        kind: 'direct' as const,
                                        directValue: item.directValue ?? 0,
                                      }
                                    : { kind: 'simple' as const }

                                return (
                                  <EquipmentQuotePriceBlock
                                    key={item.id}
                                    equipmentName={item.equipment.name}
                                    originalPrice={originalPrice}
                                    finalPrice={finalPrice}
                                    variant={variant}
                                    className={
                                      itemIndex > 0
                                        ? 'pt-4 border-t border-gray-200'
                                        : undefined
                                    }
                                  />
                                )
                              })}
                              {(quote.deliveryFee ?? 0) +
                                (quote.pickupFee ?? 0) >
                                0 && (
                                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                  <p className="text-xs font-semibold text-gray-600">
                                    Frete:
                                  </p>
                                  <p className="text-xs font-semibold text-gray-700">
                                    {formatCurrency(
                                      (quote.deliveryFee ?? 0) +
                                        (quote.pickupFee ?? 0)
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Valor Reajustado */}
                          {quote.finalTotal &&
                            quote.finalTotal !==
                              (quote.originalTotal ?? quote.totalPrice) && (
                              <div className="mb-4">
                                <div className="p-3 bg-gray-50 rounded-xl shadow-md">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                                    <p className="text-sm font-semibold text-gray-900">
                                      Valor Reajustado
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs text-gray-500 line-through">
                                        Preço original:
                                      </p>
                                      <p className="text-xs text-gray-500 line-through">
                                        {formatCurrency(
                                          quote.originalTotal ??
                                            quote.totalPrice ??
                                            0
                                        )}
                                      </p>
                                    </div>
                                    {(() => {
                                      const originalValue =
                                        quote.originalTotal ??
                                        quote.totalPrice ??
                                        0
                                      const finalValue = quote.finalTotal ?? 0
                                      const difference =
                                        finalValue - originalValue
                                      const absDifference = Math.abs(difference)

                                      return (
                                        <div className="flex items-center justify-between">
                                          <p
                                            className={`text-xs font-semibold ${
                                              difference > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                            }`}
                                          >
                                            Reajuste:{' '}
                                            {originalValue > 0
                                              ? `${difference > 0 ? '+' : '-'}${Math.abs((difference / originalValue) * 100).toFixed(1)}`
                                              : '0.0'}
                                            %
                                          </p>
                                          <p
                                            className={`text-xs font-semibold ${
                                              difference > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                            }`}
                                          >
                                            {difference > 0 ? '+' : '-'}
                                            {formatCurrency(absDifference)}
                                          </p>
                                        </div>
                                      )
                                    })()}
                                    <div className="pt-1 border-t border-gray-200">
                                      <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-sm font-bold text-gray-900">
                                          Preço final:
                                        </span>
                                        <span className="text-sm font-bold text-green-600">
                                          {formatCurrency(quote.finalTotal)}
                                        </span>
                                      </div>
                                    </div>
                                    {((quote.adjustments?.length ?? 0) > 0 ||
                                      quote.priceAdjustmentReason) && (
                                      <div className="pt-2 mt-2 border-t border-gray-200">
                                        <p className="text-xs font-bold text-gray-900 mb-2">
                                          Justificativa do Ajuste
                                        </p>
                                        {quote.adjustments &&
                                        quote.adjustments.length > 0 ? (
                                          <div className="space-y-2">
                                            {quote.adjustments.map((adj) => (
                                              <div key={adj.id}>
                                                <div className="flex flex-wrap items-baseline gap-x-2">
                                                  <span className="text-xs font-bold text-gray-900">
                                                    {ADJUSTMENT_CATEGORY_LABELS[
                                                      adj.category
                                                    ] ?? adj.category}
                                                    :
                                                  </span>
                                                  <span className="text-xs font-bold text-green-600">
                                                    {formatCurrency(adj.amount)}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-gray-700">
                                                  {adj.justification}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            {parseAdjustmentBlocks(
                                              quote.priceAdjustmentReason
                                            ).map((block, idx) => (
                                              <div key={idx}>
                                                <p className="text-xs font-bold text-gray-900">
                                                  {block.category}
                                                </p>
                                                <p className="text-xs text-gray-700">
                                                  {block.justification}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {quote.priceAdjustedAt && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Ajustado em:{' '}
                                            {new Date(
                                              quote.priceAdjustedAt
                                            ).toLocaleString('pt-BR')}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          <div className="pt-4 border-t border-orange-200">
                            <p className="text-sm font-semibold text-green-700 mb-1">
                              Total a Pagar
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(quoteTotalValue)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md">
                          <p className="text-sm font-semibold text-orange-700 mb-3">
                            Desconto Aplicado
                          </p>
                          <p className="text-sm text-gray-500 mb-4">
                            Sem desconto
                          </p>
                          {/* Valor Reajustado */}
                          {quote.finalTotal &&
                            quote.finalTotal !==
                              (quote.originalTotal ?? quote.totalPrice) && (
                              <div className="mb-4">
                                <div className="p-3 bg-gray-50 rounded-xl shadow-md">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                                    <p className="text-sm font-semibold text-gray-900">
                                      Valor Reajustado
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs text-gray-500 line-through">
                                        Preço original:
                                      </p>
                                      <p className="text-xs text-gray-500 line-through">
                                        {formatCurrency(
                                          quote.originalTotal ??
                                            quote.totalPrice ??
                                            0
                                        )}
                                      </p>
                                    </div>
                                    {(() => {
                                      const originalValue =
                                        quote.originalTotal ??
                                        quote.totalPrice ??
                                        0
                                      const finalValue = quote.finalTotal ?? 0
                                      const difference =
                                        finalValue - originalValue
                                      const absDifference = Math.abs(difference)

                                      return (
                                        <div className="flex items-center justify-between">
                                          <p
                                            className={`text-xs font-semibold ${
                                              difference > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                            }`}
                                          >
                                            Reajuste:{' '}
                                            {originalValue > 0
                                              ? `${difference > 0 ? '+' : '-'}${Math.abs((difference / originalValue) * 100).toFixed(1)}`
                                              : '0.0'}
                                            %
                                          </p>
                                          <p
                                            className={`text-xs font-semibold ${
                                              difference > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                            }`}
                                          >
                                            {difference > 0 ? '+' : '-'}
                                            {formatCurrency(absDifference)}
                                          </p>
                                        </div>
                                      )
                                    })()}
                                    <div className="pt-1 border-t border-gray-200">
                                      <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-sm font-bold text-gray-900">
                                          Preço final:
                                        </span>
                                        <span className="text-sm font-bold text-green-600">
                                          {formatCurrency(quote.finalTotal)}
                                        </span>
                                      </div>
                                    </div>
                                    {((quote.adjustments?.length ?? 0) > 0 ||
                                      quote.priceAdjustmentReason) && (
                                      <div className="pt-2 mt-2 border-t border-gray-200">
                                        <p className="text-xs font-bold text-gray-900 mb-2">
                                          Justificativa do Ajuste
                                        </p>
                                        {quote.adjustments &&
                                        quote.adjustments.length > 0 ? (
                                          <div className="space-y-2">
                                            {quote.adjustments.map((adj) => (
                                              <div key={adj.id}>
                                                <div className="flex flex-wrap items-baseline gap-x-2">
                                                  <span className="text-xs font-bold text-gray-900">
                                                    {ADJUSTMENT_CATEGORY_LABELS[
                                                      adj.category
                                                    ] ?? adj.category}
                                                    :
                                                  </span>
                                                  <span className="text-xs font-bold text-green-600">
                                                    {formatCurrency(adj.amount)}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-gray-700">
                                                  {adj.justification}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            {parseAdjustmentBlocks(
                                              quote.priceAdjustmentReason
                                            ).map((block, idx) => (
                                              <div key={idx}>
                                                <p className="text-xs font-bold text-gray-900">
                                                  {block.category}
                                                </p>
                                                <p className="text-xs text-gray-700">
                                                  {block.justification}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {quote.priceAdjustedAt && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Ajustado em:{' '}
                                            {new Date(
                                              quote.priceAdjustedAt
                                            ).toLocaleString('pt-BR')}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          <div className="pt-4 border-t border-orange-200">
                            <p className="text-sm font-semibold text-green-700 mb-1">
                              Total a Pagar
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(quoteTotalValue)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Status do Pagamento: não exibir boleto nem opção de download se orçamento foi rejeitado. Comparação case-insensitive (API retorna lowercase; defensivo para uppercase). */}
                      {String(quote.status ?? '').toLowerCase() !==
                        'rejected' &&
                        quote.payments &&
                        quote.payments.length > 0 && (
                          <div className="p-4 bg-gray-50 rounded-xl shadow-md">
                            {quote.payments.map((payment) => (
                              <div key={payment.id} className="space-y-3">
                                <div>
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="font-semibold text-gray-900">
                                      {formatCurrency(
                                        !payment.paidAt
                                          ? quoteTotalValue
                                          : payment.amount
                                      )}
                                    </p>
                                    <ClientAreaBadge
                                      className={
                                        payment.paidAt
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-orange-100 text-orange-800'
                                      }
                                    >
                                      {payment.paidAt ? 'Pago' : 'Pendente'}
                                    </ClientAreaBadge>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-2">
                                    {payment.method}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Vencimento:{' '}
                                    {formatDateShort(payment.dueDate)}
                                  </p>
                                </div>
                                {payment.method === 'BOLETO' &&
                                  payment.metadata?.pdfUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                                    >
                                      <a
                                        href={payment.metadata.pdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        Baixar Boleto
                                      </a>
                                    </Button>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Ações */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-bold text-gray-900">
                        Ações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <Button
                        variant="outline"
                        className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                        asChild
                      >
                        <Link
                          href={`tel:${formatPhoneForTel(settings.whatsappNumber)}`}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Entrar em Contato
                        </Link>
                      </Button>
                      {quote.status === 'pending' && (
                        <Button
                          variant="outline"
                          className="w-full bg-white hover:bg-white text-gray-900 hover:text-red-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={isDeletingQuote}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {isDeletingQuote
                            ? 'Cancelando...'
                            : 'Cancelar Orçamento'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Dialog de Cancelamento */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar orçamento?</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="p-4 md:p-6">
              <AlertDialogDescription>
                O orçamento será cancelado e removido permanentemente. Esta ação
                não pode ser desfeita.
                <br />
                <br />
                <strong>Você tem certeza que deseja continuar?</strong>
              </AlertDialogDescription>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingQuote}>
                Não, manter
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteQuote}
                disabled={isDeletingQuote}
              >
                {isDeletingQuote ? 'Cancelando...' : 'Sim, cancelar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Detalhes do Reajuste (Base UI) com nested para confirmação de cancelamento */}
        <Dialog.Root
          open={showAdjustmentDialog}
          onOpenChange={setShowAdjustmentDialog}
        >
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup
              variant="default"
              data-nested-parent={showCancelFromAdjustment ? '' : undefined}
              className="max-w-md min-h-0 flex flex-col"
              style={{ height: '70vh', maxHeight: '70vh' }}
            >
              <Dialog.Content className="relative min-h-0 flex-1 flex flex-col overflow-hidden">
                {showCancelFromAdjustment && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
                  />
                )}
                <Dialog.Header>
                  <Dialog.HeaderIcon>
                    <AlertTriangle className="h-4 w-4" />
                  </Dialog.HeaderIcon>
                  <Dialog.Title className="text-xl font-semibold text-gray-800">
                    Detalhes do Reajuste
                  </Dialog.Title>
                  <Dialog.CloseButton aria-label="Fechar dialog" />
                </Dialog.Header>

                <Dialog.Body className="min-h-0 overflow-hidden">
                  <Dialog.BodyViewport
                    className="min-h-0 max-h-full"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    <Dialog.BodyContent>
                      <div className="space-y-4">
                        {/* Comparação de Valores */}
                        <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                              Valor original:
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                              {formatCurrency(
                                quote.originalTotal ?? quote.totalPrice ?? 0
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900">
                              Valor ajustado:
                            </span>
                            <span className="text-sm font-bold text-green-600">
                              {formatCurrency(quote.finalTotal ?? 0)}
                            </span>
                          </div>
                          {(() => {
                            const originalValue =
                              quote.originalTotal ?? quote.totalPrice ?? 0
                            const finalValue = quote.finalTotal ?? 0
                            const difference = finalValue - originalValue
                            if (originalValue <= 0) return null
                            return (
                              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                <span className="text-xs text-gray-500">
                                  Variação:
                                </span>
                                <span
                                  className={`text-xs font-semibold ${
                                    difference > 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {difference > 0 ? '+' : ''}
                                  {((difference / originalValue) * 100).toFixed(
                                    1
                                  )}
                                  %{' ('}
                                  {difference > 0 ? '+' : ''}
                                  {formatCurrency(Math.abs(difference))}
                                  {')'}
                                </span>
                              </div>
                            )
                          })()}

                          {/* Botão Baixar Boleto */}
                          {(() => {
                            const boletoPayment = quote.payments?.find(
                              (p) => p.method === 'BOLETO' && p.metadata?.pdfUrl
                            )
                            if (!boletoPayment) return null
                            return (
                              <div className="pt-3 border-t border-gray-200">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="w-full bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 border border-gray-200"
                                >
                                  <a
                                    href={boletoPayment.metadata!.pdfUrl!}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Baixar Boleto
                                  </a>
                                </Button>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Justificativa - exibe todos os reajustes do admin */}
                        {(quote.adjustments?.length ?? 0) > 0 ||
                        quote.priceAdjustmentReason ? (
                          <div className="p-4 bg-orange-50 rounded-xl">
                            <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                              Justificativa do Ajuste
                            </p>
                            {quote.adjustments &&
                            quote.adjustments.length > 0 ? (
                              <div className="space-y-3">
                                {quote.adjustments.map((adj) => (
                                  <div
                                    key={adj.id}
                                    className="flex flex-col gap-3 p-4 bg-white rounded-lg shadow-md"
                                  >
                                    <p className="text-sm font-bold text-gray-900 uppercase">
                                      {ADJUSTMENT_CATEGORY_LABELS[
                                        adj.category
                                      ] ?? adj.category}
                                    </p>
                                    <p className="text-sm font-semibold text-green-600">
                                      {formatCurrency(adj.amount)}
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {adj.justification}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {parseAdjustmentBlocks(
                                  quote.priceAdjustmentReason
                                ).map((block, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-col gap-1"
                                  >
                                    <p className="text-sm font-bold text-gray-900">
                                      {block.category}
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {block.justification}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Timestamp */}
                        {quote.priceAdjustedAt && (
                          <p className="text-xs text-gray-400">
                            Ajustado em:{' '}
                            {new Date(quote.priceAdjustedAt).toLocaleString(
                              'pt-BR'
                            )}
                          </p>
                        )}
                      </div>

                      {/* Dialog nested: Confirmação de Cancelamento */}
                      <Dialog.Root
                        open={showCancelFromAdjustment}
                        onOpenChange={setShowCancelFromAdjustment}
                      >
                        <Dialog.Portal>
                          <Dialog.Backdrop />
                          <Dialog.Popup
                            variant="default"
                            className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
                          >
                            <Dialog.Content>
                              <Dialog.Header className="flex-col items-start gap-1 pb-3">
                                <Dialog.CloseButton aria-label="Fechar" />
                                <Dialog.Title className="text-lg font-semibold text-gray-900">
                                  Cancelar orçamento?
                                </Dialog.Title>
                              </Dialog.Header>
                              <Dialog.Body className="flex-none">
                                <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                                  <Dialog.BodyContent className="space-y-2 py-2">
                                    <p className="text-sm text-gray-600">
                                      Tem certeza que deseja cancelar este
                                      orçamento? Esta ação{' '}
                                      <strong>não poderá ser revertida</strong>{' '}
                                      e o orçamento será removido
                                      permanentemente.
                                    </p>
                                  </Dialog.BodyContent>
                                </Dialog.BodyViewport>
                              </Dialog.Body>
                              <Dialog.Footer className="flex flex-row gap-3">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setShowCancelFromAdjustment(false)
                                  }
                                  disabled={isDeletingQuote}
                                  className="flex-1"
                                >
                                  Não, manter
                                </Button>
                                <Button
                                  variant="default"
                                  onClick={() => {
                                    setShowCancelFromAdjustment(false)
                                    setShowAdjustmentDialog(false)
                                    handleDeleteQuote()
                                  }}
                                  disabled={isDeletingQuote}
                                  className="flex-1"
                                >
                                  {isDeletingQuote
                                    ? 'Cancelando...'
                                    : 'Sim, cancelar orçamento'}
                                </Button>
                              </Dialog.Footer>
                            </Dialog.Content>
                          </Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Dialog.BodyContent>
                  </Dialog.BodyViewport>
                </Dialog.Body>

                <Dialog.Footer className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelFromAdjustment(true)}
                    disabled={isDeletingQuote}
                    className="w-full sm:flex-1 bg-white hover:bg-white hover:text-red-600 border-gray-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancelar Orçamento
                  </Button>
                  <Button asChild className="w-full sm:flex-1">
                    <Link
                      href={`tel:${formatPhoneForTel(settings.whatsappNumber)}`}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Entrar em Contato
                    </Link>
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    )
  }

  // Type guard: se chegamos aqui, rental deve existir
  if (!rental) {
    return null
  }

  const statusInfo = getStatusInfo(rental.status)
  const StatusIcon = statusInfo.icon
  const equipmentNames = rental.rental_items
    .map((item) => item.equipments.name)
    .join(', ')

  const { displayTotal, lateFeeValue, rentalShippingFee } =
    getRentalTotals(rental)

  return (
    <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
      {/* Hero Section com Identidade Visual Completa */}
      <section
        id="dashboard-banner"
        className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button
              variant="ghost"
              onClick={() => router.push('/area-cliente/historico')}
              className="mb-4 text-[0.9375rem] text-white hover:text-white hover:scale-100 hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Histórico
            </Button>
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold leading-tight">
                Detalhes da Locação
              </h1>
              <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-2xl mx-auto">
                {equipmentNames}
              </p>
              <div className="flex justify-center">
                <ClientAreaBadge
                  className={`${statusInfo.color} px-4 py-2 rounded-full font-medium text-sm`}
                >
                  <StatusIcon className="h-4 w-4 mr-2" />
                  {statusInfo.label}
                </ClientAreaBadge>
              </div>
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
      <section className="-mt-20 lg:py-10 md:-mt-24 md:py-16 py-12 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conteúdo Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Equipamentos */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                        <Package className="h-5 w-5" />
                      </div>
                      Equipamentos
                    </CardTitle>
                    <CardDescription>
                      {rental.rental_items.length} item(s) na locação
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {rental.rental_items.map((item) => {
                      // Buscar item correspondente no quote para obter includeWeekends
                      const quoteItem = rental.quote?.items?.find(
                        (qi) => qi.equipment.id === item.equipments.id
                      )
                      const includeWeekends =
                        quoteItem?.includeWeekends ?? false

                      // Obter imagem do equipamento
                      const equipmentImage: string =
                        item.equipments.images &&
                        item.equipments.images.length > 0 &&
                        item.equipments.images[0]
                          ? item.equipments.images[0]
                          : `/placeholder.svg?height=80&width=80&text=${encodeURIComponent(item.equipments.name)}`

                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              {/* Thumbnail */}
                              <div className="shrink-0">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                                  <Image
                                    src={equipmentImage}
                                    alt={item.equipments.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                </div>
                              </div>

                              {/* Detalhes */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900">
                                  {item.equipments.name}
                                </p>
                                {item.equipments.category && (
                                  <p className="text-sm text-gray-500">
                                    {item.equipments.category.name}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                    <span>Qtd: {item.quantity}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span>{item.totaldays} dias</span>
                                  </div>
                                </div>
                                {/* Informação sobre finais de semana */}
                                <div className="flex items-center gap-1.5 text-xs mt-2">
                                  <span
                                    className={
                                      includeWeekends
                                        ? 'text-green-600 font-semibold'
                                        : 'text-red-600 font-semibold'
                                    }
                                  >
                                    {includeWeekends ? '✓' : '✗'}
                                  </span>
                                  <span className="text-gray-600 font-semibold">
                                    {includeWeekends
                                      ? 'Inclui finais de semana'
                                      : 'Não inclui finais de semana'}
                                  </span>
                                </div>
                                {/* Período */}
                                {quoteItem?.startDate && quoteItem?.endDate && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold mt-2">
                                    <span>
                                      Período:{' '}
                                      {formatDateShort(quoteItem.startDate)} até{' '}
                                      {formatDateShort(quoteItem.endDate)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Valor */}
                            <div className="flex flex-col items-end shrink-0">
                              <p className="font-bold text-lg text-orange-600">
                                {formatCurrency(item.totalprice)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Informações de Entrega */}
              {(rental.quote?.deliveryType ||
                rental.quote?.deliveryAddress) && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                          <Truck className="h-5 w-5" />
                        </div>
                        Informações de Entrega
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Tipo de Entrega e Endereço juntos */}
                        {rental.quote?.deliveryType && (
                          <div className="p-4 bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-gray-500">
                                Forma de Entrega
                              </p>
                              {rentalShippingFee > 0 && (
                                <p className="font-bold text-lg text-orange-600">
                                  {formatCurrency(rentalShippingFee)}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-3">
                              {rental.quote.deliveryType === 'DELIVERY'
                                ? 'Entrega no Endereço'
                                : rental.quote.deliveryType === 'PICKUP'
                                  ? 'Retirada em Loja'
                                  : rental.quote.deliveryType}
                            </p>

                            {/* Endereço de Entrega - dentro do mesmo bloco */}
                            {rental.quote.deliveryType === 'DELIVERY' &&
                              rental.quote.deliveryAddress && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm text-gray-500 mb-2">
                                        Endereço de Entrega
                                      </p>
                                      <div className="text-xs text-gray-900 space-y-1">
                                        {(() => {
                                          try {
                                            // Tratar deliveryAddress como JSON se necessário
                                            const address =
                                              typeof rental.quote
                                                .deliveryAddress === 'string'
                                                ? JSON.parse(
                                                    rental.quote.deliveryAddress
                                                  )
                                                : rental.quote.deliveryAddress

                                            if (
                                              !address ||
                                              typeof address !== 'object'
                                            ) {
                                              return (
                                                <p className="text-gray-500">
                                                  Endereço não informado
                                                </p>
                                              )
                                            }

                                            const addressParts = []

                                            if (address.street) {
                                              let streetLine = address.street
                                              if (address.number) {
                                                streetLine += `, ${address.number}`
                                              }
                                              if (address.complement) {
                                                streetLine += ` - ${address.complement}`
                                              }
                                              addressParts.push(streetLine)
                                            }

                                            if (address.neighborhood) {
                                              addressParts.push(
                                                address.neighborhood
                                              )
                                            }

                                            if (address.city || address.state) {
                                              let cityState = ''
                                              if (address.city) {
                                                cityState = address.city
                                              }
                                              if (
                                                address.city &&
                                                address.state
                                              ) {
                                                cityState += ' - '
                                              }
                                              if (address.state) {
                                                cityState += address.state
                                              }
                                              if (address.zipCode) {
                                                cityState += ` - ${address.zipCode}`
                                              }
                                              if (cityState) {
                                                addressParts.push(cityState)
                                              }
                                            }

                                            return addressParts.length > 0 ? (
                                              addressParts.map(
                                                (part, index) => (
                                                  <p
                                                    key={index}
                                                    className="text-sm"
                                                  >
                                                    {part}
                                                  </p>
                                                )
                                              )
                                            ) : (
                                              <p className="text-sm text-gray-500">
                                                Endereço não informado
                                              </p>
                                            )
                                          } catch (error) {
                                            console.error(
                                              'Error parsing delivery address:',
                                              error
                                            )
                                            return (
                                              <p className="text-sm text-gray-500">
                                                Erro ao carregar endereço
                                              </p>
                                            )
                                          }
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Entregas e Coletas */}
              {rental.deliveries && rental.deliveries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white">
                          <Truck className="h-5 w-5" />
                        </div>
                        Entregas e Coletas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      {rental.deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <ClientAreaBadge
                                className={
                                  delivery.type === 'DELIVERY'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }
                              >
                                {delivery.type === 'DELIVERY'
                                  ? 'Entrega'
                                  : 'Coleta'}
                              </ClientAreaBadge>
                              <p className="text-sm text-gray-500 mt-2">
                                {formatDate(delivery.scheduledAt)}
                              </p>
                            </div>
                            <ClientAreaBadge
                              className={
                                delivery.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800'
                                  : delivery.status === 'IN_TRANSIT'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                              }
                            >
                              {delivery.status === 'COMPLETED'
                                ? 'Concluído'
                                : delivery.status === 'IN_TRANSIT'
                                  ? 'Em Trânsito'
                                  : 'Agendado'}
                            </ClientAreaBadge>
                          </div>
                          {delivery.address && (
                            <div className="flex items-start gap-2 mt-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                              <p className="text-sm text-gray-700">
                                {delivery.address.street || ''}
                                {delivery.address.city &&
                                  `, ${delivery.address.city}`}
                                {delivery.address.state &&
                                  ` - ${delivery.address.state}`}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Linha do Tempo */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
              >
                <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                        <Clock className="h-5 w-5" />
                      </div>
                      Linha do Tempo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <RentalTimeline steps={rentalTimeline(rental)} />
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Resumo */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      Resumo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {rental.quote?.items &&
                    rental.quote.items.some(
                      (item) =>
                        coerceNumber(item.appliedDiscount, 0) > 0 ||
                        (item.useDirectValue === true &&
                          coerceNumber(item.directValue, 0) > 0)
                    ) ? (
                      <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md">
                        <p className="text-sm font-semibold text-orange-700 mb-1">
                          Desconto Aplicado
                        </p>
                        <div className="space-y-3 mb-4">
                          {rental.quote.items
                            .filter(
                              (item) =>
                                coerceNumber(item.appliedDiscount, 0) > 0 ||
                                (item.useDirectValue === true &&
                                  coerceNumber(item.directValue, 0) > 0)
                            )
                            .map((quoteItem) => {
                              const {
                                finalPrice,
                                originalPrice,
                                variant: variantRental,
                                itemLabel,
                              } = getRentalQuoteItemPrice(quoteItem)

                              return (
                                <div
                                  key={quoteItem.id}
                                  className="p-4 bg-gray-50 rounded-xl shadow-md"
                                >
                                  <EquipmentQuotePriceBlock
                                    equipmentName={itemLabel}
                                    originalPrice={originalPrice}
                                    finalPrice={finalPrice}
                                    variant={variantRental}
                                  />
                                </div>
                              )
                            })}
                          {rentalShippingFee > 0 && (
                            <div className="p-4 bg-gray-50 rounded-xl shadow-md">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-600">
                                  Frete:
                                </p>
                                <p className="text-xs font-semibold text-gray-700">
                                  {formatCurrency(rentalShippingFee)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        {rental.lateFee && (
                          <div className="mb-4 pb-4 ">
                            <p className="text-sm text-red-700 mb-1">Multa</p>
                            <p className="text-lg font-semibold text-red-900">
                              {formatCurrency(lateFeeValue)}
                            </p>
                          </div>
                        )}
                        <div className="pt-4 border-t border-orange-200">
                          <p className="text-sm font-semibold text-green-700 mb-1">
                            Total a Pagar
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(displayTotal + lateFeeValue)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md">
                        <p className="text-sm font-semibold text-orange-700 mb-3">
                          Desconto Aplicado
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Sem desconto
                        </p>
                        {rental.lateFee && (
                          <div className="mb-4 pb-4 ">
                            <p className="text-sm text-red-700 mb-1">Multa</p>
                            <p className="text-lg font-semibold text-red-900">
                              {formatCurrency(lateFeeValue)}
                            </p>
                          </div>
                        )}
                        <div className="pt-4 border-t border-orange-200">
                          <p className="text-sm font-semibold text-green-700 mb-1">
                            Total a Pagar
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(displayTotal + lateFeeValue)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Status do Pagamento */}
                    {rental.payments && rental.payments.length > 0 && (
                      <div className="p-4 bg-gray-50 rounded-xl shadow-md">
                        {rental.payments.map((payment) => (
                          <div key={payment.id} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <p className="font-semibold text-gray-900">
                                  {formatCurrency(payment.amount)}
                                </p>
                                <ClientAreaBadge
                                  className={
                                    payment.paidAt
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-orange-100 text-orange-800'
                                  }
                                >
                                  {payment.paidAt ? 'Pago' : 'Pendente'}
                                </ClientAreaBadge>
                              </div>
                              <p className="text-sm text-gray-500 mt-2">
                                {payment.method}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Vencimento: {formatDateShort(payment.dueDate)}
                              </p>
                            </div>
                            {payment.method === 'BOLETO' &&
                              payment.metadata?.pdfUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                                >
                                  <a
                                    href={payment.metadata.pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Baixar Boleto
                                  </a>
                                </Button>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Ações */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-gray-900">
                      Ações
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {(rental.status === 'ACTIVE' ||
                      rental.status === 'OVERDUE') && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                          onClick={async () => {
                            const days = prompt(
                              'Quantos dias deseja prorrogar? (máximo 30 dias)',
                              '7'
                            )
                            if (!days) return

                            const extensionDays = parseInt(days, 10)
                            if (
                              isNaN(extensionDays) ||
                              extensionDays < 1 ||
                              extensionDays > 30
                            ) {
                              toast.error(
                                'Por favor, insira um número válido entre 1 e 30'
                              )
                              return
                            }

                            try {
                              const data = await rentalApi.extend(
                                rental.id,
                                extensionDays
                              )
                              toast.success(
                                `Prorrogação de ${extensionDays} dias solicitada com sucesso. Taxa adicional: ${formatCurrency(data.extensionFee || 0)}`
                              )
                              fetchRental()
                            } catch (error) {
                              if (isAbortError(error)) return
                              toast.error(
                                error instanceof HttpError
                                  ? error.message
                                  : 'Erro ao solicitar prorrogação'
                              )
                            }
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Solicitar Prorrogação
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                          onClick={async () => {
                            if (
                              !confirm(
                                'Deseja solicitar a coleta do equipamento? Nossa equipe entrará em contato para agendar.'
                              )
                            ) {
                              return
                            }

                            try {
                              await rentalApi.requestPickup(rental.id)
                              toast.success(
                                'Solicitação de coleta enviada. Nossa equipe entrará em contato em breve.'
                              )
                              fetchRental()
                            } catch (error) {
                              if (isAbortError(error)) return
                              toast.error(
                                error instanceof HttpError
                                  ? error.message
                                  : 'Erro ao solicitar coleta'
                              )
                            }
                          }}
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Solicitar Coleta
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                      asChild
                    >
                      <Link
                        href={`tel:${formatPhoneForTel(settings.whatsappNumber)}`}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Entrar em Contato
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border border-gray-200"
                      onClick={async () => {
                        try {
                          const response = await rentalApi.downloadContract(
                            rental.id
                          )
                          if (response.ok) {
                            // Se for HTML, criar blob e fazer download
                            const blob = response.blob
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `contrato-${rental.id}.html`
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                            document.body.removeChild(a)
                            toast.success('Contrato baixado com sucesso')
                          } else if (
                            response.status === 302 ||
                            response.redirected
                          ) {
                            // Se for redirecionamento para PDF, abrir em nova aba
                            window.open(response.url, '_blank')
                          } else {
                            toast.error('Erro ao baixar contrato')
                          }
                        } catch (error) {
                          if (isAbortError(error)) return
                          toast.error('Erro ao baixar contrato')
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Contrato
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function RentalDetailsPage() {
  const params = useParams()
  const paramId = typeof params.id === 'string' ? params.id : null
  return (
    <RentalDetailsPageContent
      key={useRentalDetailScope(paramId)}
      paramId={paramId}
    />
  )
}
