'use client'
import { useQuotePage, useQuotePageScope } from '../model/use-quote-page'
import type { QuotePagePorts } from '../model/quote-page-contract'

import Image from 'next/image'
import { Link } from '@gb-locacoes/ui'

import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Checkbox, Separator } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check } from 'lucide-react'
import { AddressForm } from '@gb-locacoes/ui'
import { fetchAddressByCEP } from '../../../shared/lib/cep'
import { toast } from 'sonner'
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
import { CloseButton } from '@gb-locacoes/ui'
import {
  storefrontLegalItemParts,
  type StorefrontLegalBlock,
} from '@gb-locacoes/contracts/storefront-legal'

import {
  calculateIntelligentPrice,
  getPricingConfig,
} from '../../../entities/equipamento'

import { isAddressDifferent } from '../../../entities/orcamento'
import { formatCurrency } from '../../../shared/lib/moeda'
import { GoogleCustomerReviews } from '../../../widgets/avaliacoes-google'
import { usePublicSettings } from '../../../entities/configuracao'
import { useIdentidadePublica } from '../../../entities/organizacao'
import {
  convertFormDataToWhatsApp,
  openWhatsAppQuote,
} from '../../../entities/orcamento'
import { type CartItem } from '../../../features/carrinho'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Loader2,
  Minus,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  User,
  MapPin,
  Truck,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useRef } from 'react'

import { SaveAddressDialog } from './SalvarEndereco.web'
import { ConfirmAddressDialog } from './ConfirmarEndereco.web'
import { SelectAddressDialog } from './SelecionarEndereco.web'
import { SaveCustomerInfoDialog } from './SalvarInformacoes.web'
const webPorts: QuotePagePorts = {
  preferences: {
    getItem: (key) =>
      typeof window === 'undefined' ? null : localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  },
  query: { get: () => null },
  clearQuery: () => {
    if (typeof window !== 'undefined' && window.history?.replaceState)
      window.history.replaceState({}, '', window.location.pathname)
  },
  scrollTop: () => window.scrollTo(0, 0),
  focusField: (id) => {
    const field =
      id === 'delivery-type'
        ? document.querySelector<HTMLElement>(
            '[role="combobox"][aria-controls*="radix"]'
          )
        : document.getElementById(id)
    field?.focus()
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
}
function QuotePage() {
  const searchParams = useSearchParams()
  // WhatsApp e nome da própria locadora (achado 143): nunca o número ou a marca de outra.
  const { settings: contatoDaLocadora } = usePublicSettings()
  const nomeDaLocadora = useIdentidadePublica()?.nome ?? null
  const ports = useMemo(
    () => ({ ...webPorts, query: searchParams }),
    [searchParams]
  )
  const {
    selectedEquipments,
    displayedItems,
    formData,
    setFormData,
    getNewCustomerInfoToSave,
    isSubmitting,
    submittedQuote,
    freightOptions,
    selectedFreight,
    setSelectedFreight,
    isCalculatingFreight,
    availabilityErrors,
    pendingWeekendConfirmation,
    hasAcceptedTerms,
    setHasAcceptedTerms,
    termos,
    userAddresses,
    saveAddressDialogOpen,
    setSaveAddressDialogOpen,
    confirmAddressDialogOpen,
    setConfirmAddressDialogOpen,
    selectAddressDialogOpen,
    setSelectAddressDialogOpen,
    selectedSavedAddress,
    saveCustomerInfoDialogOpen,
    setSaveCustomerInfoDialogOpen,
    formatDate,
    resolveDateRange,
    handlePhoneChange,
    handleCPFChange,
    handleCNPJChange,
    updateQuantity,
    updateDays,
    removeEquipment,
    calculateSubtotal,
    calculateTotal,
    handleDeliveryTypeChange,
    handleSubmit,
    handleWeekendConfirmation,
    handleWeekendConfirmationCancel,
    handleSaveAddress,
    handleSkipSaveAddress,
    handleSaveCustomerInfo,
    handleSkipSaveCustomerInfo,
    handleConfirmAddress,
    handleDismissConfirmation,
    handleSelectAddress,
    handleUseOtherAddress,
    handleCancelAddressDialog,
    getEquipmentImage,
  } = useQuotePage(ports)
  const termsCheckboxRef = useRef<HTMLButtonElement | null>(null)
  const renderTermsBlocks = (blocks: readonly StorefrontLegalBlock[]) =>
    blocks.map((block, index) => {
      if (block.type === 'paragraph') {
        return (
          <p key={`paragraph-${index}`} className="text-sm text-gray-700">
            {block.text}
          </p>
        )
      }

      if (block.type === 'list') {
        return (
          <ul
            key={`list-${index}`}
            className="list-disc list-inside space-y-2 text-sm text-gray-700"
          >
            {block.items.map((item, itemIndex) => {
              const { lead, text } = storefrontLegalItemParts(item)
              return (
                <li key={`item-${index}-${itemIndex}`}>
                  {lead === null ? (
                    text
                  ) : (
                    <>
                      <strong>{lead}</strong>
                      {text}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )
      }

      return null
    })
  const _handleWhatsAppSubmit = () => {
    // Validação: aceite dos termos (só com os Termos da locadora publicados; D-C, parte 1)
    if (termos.bloqueio) {
      toast.error('Termos de Uso indisponíveis', {
        description: termos.bloqueio,
        duration: 6000,
      })
      return
    }
    if (termos.exigeAceite && !hasAcceptedTerms) {
      toast.info('Aceite dos Termos', {
        description:
          'Para continuar, leia e aceite os Termos de Uso antes de enviar a solicitação.',
        duration: 6000,
      })

      if (termsCheckboxRef.current) {
        termsCheckboxRef.current.focus()
        termsCheckboxRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
      return
    }

    if (!formData.cpf.trim() && !formData.cnpj.trim()) {
      toast.error('Erro de Validação', {
        description: 'Por favor, preencha pelo menos o CPF ou CNPJ.',
      })
      return
    }

    // Validação: campos obrigatórios
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim()
    ) {
      toast.error('Erro de Validação', {
        description: 'Por favor, preencha todos os campos obrigatórios.',
      })
      return
    }

    if (!contatoDaLocadora.whatsappNumber.trim()) {
      toast.error('WhatsApp indisponível', {
        description:
          'Esta locadora ainda não informou o WhatsApp. Envie a solicitação pelo formulário.',
      })
      return
    }

    try {
      // Converter dados para formato WhatsApp
      const whatsappData = convertFormDataToWhatsApp(
        formData,
        selectedEquipments.map((eq) => ({
          name: eq.equipmentName,
          quantity: eq.quantity,
          days: eq.days,
          pricePerDay: Number(eq.pricePerDay),
          finalPrice: calculateSubtotal(eq),
          id: eq.equipmentId,
          discount: (() => {
            const pricingConfig = getPricingConfig(eq, eq.days)
            if (pricingConfig.discount && pricingConfig.discount > 0) {
              return {
                type: 'percentage' as const,
                value: pricingConfig.discount,
                period:
                  pricingConfig.period === 'daily'
                    ? 'diário'
                    : pricingConfig.period === 'weekly'
                      ? 'semanal'
                      : pricingConfig.period === 'biweekly'
                        ? 'quinzenal'
                        : pricingConfig.period === 'monthly'
                          ? 'mensal'
                          : 'diário',
              }
            }
            return undefined
          })(),
        })),
        window.location.origin,
        nomeDaLocadora
      )

      // Abrir WhatsApp da locadora com mensagem formatada
      openWhatsAppQuote(whatsappData, contatoDaLocadora.whatsappNumber)

      toast.success('Orçamento Preparado! 📱', {
        description: 'WhatsApp aberto com sua solicitação formatada.',
      })
    } catch (error) {
      console.error('Erro ao preparar mensagem WhatsApp:', error)
      toast.error('Erro', {
        description: 'Erro ao preparar mensagem para WhatsApp.',
      })
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header com gradiente - seguindo padrão da página de equipamentos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
            {/* Clean depth layers without decorative elements */}
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>

            {/* Content */}
            <div className="relative z-10 text-center">
              <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                Solicitar Orçamento
              </h1>
              <p className="text-orange-50 mb-4 font-medium">
                Configure seu orçamento e receba nossa melhor proposta
              </p>
              <div className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit mx-auto">
                <ShoppingCart className="w-5 h-5 text-orange-50" />
                <span className="font-semibold text-white">
                  {selectedEquipments.length} equipamentos selecionados
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Equipamentos Selecionados - Coluna Principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6 lg:space-y-8"
          >
            <motion.div
              animate={{
                height: 'auto',
              }}
              transition={{
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                {/* Clean depth layers for equipment card */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

                <CardHeader className="relative z-10 p-4 sm:p-6 lg:p-6">
                  <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                    <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600" />
                    Equipamentos Selecionados ({selectedEquipments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 p-4 sm:p-6 lg:p-6 pt-0">
                  {selectedEquipments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-base font-medium">
                        Nenhum equipamento selecionado
                      </p>
                      <p className="text-small text-gray-400 mt-2">
                        Você pode solicitar um orçamento geral ou{' '}
                        <Link
                          href="/equipamentos"
                          className="text-orange-600 hover:text-orange-700 underline"
                        >
                          navegar pelos equipamentos
                        </Link>{' '}
                        para adicionar itens específicos
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {displayedItems.map((equipment) => {
                          const imageUrl = getEquipmentImage(equipment)
                          const displayRange = resolveDateRange(equipment)
                          // Verificar se o item está sendo removido
                          const isRemoving =
                            'isRemoving' in equipment
                              ? (
                                  equipment as CartItem & {
                                    isRemoving: boolean
                                  }
                                ).isRemoving
                              : false
                          return (
                            <motion.div
                              key={equipment.equipmentId}
                              initial={false}
                              animate={false}
                              exit={{
                                opacity: 0,
                              }}
                              transition={{
                                duration: 0.3,
                              }}
                              className={`relative overflow-hidden border-0 bg-white rounded-lg p-4 shadow-lg transition-all duration-300 ${
                                isRemoving
                                  ? 'pointer-events-none'
                                  : 'hover:shadow-xl hover:scale-[1.01]'
                              }`}
                            >
                              {/* Clean depth layers for equipment item card */}
                              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-gray-100/20"></div>
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-gray-50/30"></div>

                              {/* Conteúdo do item */}
                              <motion.div
                                className="relative z-10 flex flex-col sm:flex-row gap-4"
                                animate={
                                  isRemoving
                                    ? {
                                        opacity: 0,
                                        scale: 0.95,
                                        y: -5,
                                      }
                                    : {
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                      }
                                }
                                transition={{
                                  duration: 0.5,
                                  ease: [0.25, 0.46, 0.45, 0.94],
                                }}
                              >
                                {/* Imagem */}
                                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden mx-auto sm:mx-0 shadow-sm flex items-center justify-center">
                                  <Image
                                    src={imageUrl || '/placeholder.svg'}
                                    alt={equipment.equipmentName}
                                    width={80}
                                    height={80}
                                    priority
                                    className="max-w-full max-h-full object-contain"
                                    style={{ width: 'auto', height: 'auto' }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement
                                      target.src = `/placeholder.svg?height=60&width=60&text=${encodeURIComponent(equipment.equipmentName)}`
                                    }}
                                  />
                                </div>

                                {/* Informações do Equipamento */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-center sm:text-left">
                                    <h3 className="font-semibold text-lg truncate">
                                      {equipment.equipmentName}
                                    </h3>
                                    <div className="flex flex-wrap gap-1 justify-center sm:justify-start mb-2">
                                      {equipment.category && (
                                        <Badge
                                          variant="secondary"
                                          className="text-sm rounded-full"
                                        >
                                          {equipment.category.name}
                                        </Badge>
                                      )}
                                      {(() => {
                                        const pricingConfig = getPricingConfig(
                                          equipment,
                                          equipment.days
                                        )
                                        const actualPeriodLabel =
                                          pricingConfig.period === 'daily'
                                            ? 'Diário'
                                            : pricingConfig.period === 'weekly'
                                              ? 'Semanal'
                                              : pricingConfig.period ===
                                                  'biweekly'
                                                ? 'Quinzenal'
                                                : pricingConfig.period ===
                                                    'monthly'
                                                  ? 'Mensal'
                                                  : 'Diário'

                                        return (
                                          <Badge
                                            variant="outline"
                                            className="text-sm rounded-full border-orange-200 text-orange-700 bg-orange-50 font-medium"
                                          >
                                            {actualPeriodLabel}
                                            {pricingConfig.useDirectValue ? (
                                              <span className="ml-1 font-semibold">
                                                Valor Fixo
                                              </span>
                                            ) : (pricingConfig.discount || 0) >
                                              0 ? (
                                              <span className="ml-1 font-semibold">
                                                -{pricingConfig.discount}%
                                              </span>
                                            ) : null}
                                          </Badge>
                                        )
                                      })()}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-3">
                                      {(() => {
                                        const pricingConfig = getPricingConfig(
                                          equipment,
                                          equipment.days
                                        )
                                        const calculatedPrice =
                                          calculateIntelligentPrice(
                                            equipment,
                                            equipment.days
                                          )
                                        // Só calcular originalPrice se realmente for mostrar (desconto, não valor direto)
                                        const shouldShowOriginalPrice =
                                          !pricingConfig.useDirectValue &&
                                          (pricingConfig.discount || 0) > 0
                                        const originalPrice =
                                          shouldShowOriginalPrice
                                            ? Number(equipment.pricePerDay) *
                                              equipment.days
                                            : 0
                                        const actualPeriodLabel =
                                          pricingConfig.period === 'daily'
                                            ? 'diário'
                                            : pricingConfig.period === 'weekly'
                                              ? 'semanal'
                                              : pricingConfig.period ===
                                                  'biweekly'
                                                ? 'quinzenal'
                                                : pricingConfig.period ===
                                                    'monthly'
                                                  ? 'mensal'
                                                  : 'diário'
                                        const showDiscount =
                                          !pricingConfig.useDirectValue &&
                                          (pricingConfig.discount || 0) > 0
                                        const showDirect =
                                          pricingConfig.useDirectValue && true

                                        return (
                                          <div>
                                            {showDiscount &&
                                              originalPrice > 0 && (
                                                <div className="text-sm text-gray-500 line-through">
                                                  {formatCurrency(
                                                    originalPrice
                                                  )}
                                                </div>
                                              )}
                                            <div>
                                              <span className="font-semibold text-green-600 text-base">
                                                {formatCurrency(
                                                  calculatedPrice
                                                )}
                                              </span>
                                              <span className="text-xs text-gray-500 ml-1">
                                                total ({equipment.days} dias)
                                              </span>
                                            </div>
                                            {showDirect ? (
                                              <div className="text-xs text-orange-700 font-medium">
                                                Valor direto {actualPeriodLabel}
                                                :{' '}
                                                {formatCurrency(
                                                  pricingConfig.directValue || 0
                                                )}
                                                {pricingConfig.multiplier > 1
                                                  ? ` / ${pricingConfig.multiplier} dias`
                                                  : ''}
                                              </div>
                                            ) : showDiscount ? (
                                              <div className="text-xs text-green-600 font-medium">
                                                ✓ Desconto {actualPeriodLabel}{' '}
                                                aplicado: -
                                                {pricingConfig.discount}%
                                              </div>
                                            ) : null}
                                          </div>
                                        )
                                      })()}
                                    </div>
                                    {/* Informações de datas e finais de semana */}
                                    {displayRange && (
                                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-x-3 sm:gap-y-1 mt-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <span className="font-medium text-gray-700">
                                            Período:
                                          </span>
                                          <span>
                                            {formatDate(displayRange.startDate)}{' '}
                                            até{' '}
                                            {formatDate(displayRange.endDate)}
                                            {displayRange.isAuto && (
                                              <span className="text-[10px] text-gray-500">
                                                {' '}
                                                (previsto)
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        {equipment.includeWeekends && (
                                          <div className="flex items-center gap-1.5 text-xs">
                                            <span className="text-green-600 font-semibold">
                                              ✓
                                            </span>
                                            <span className="text-gray-600 font-medium">
                                              Incluir finais de semana
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Erros de disponibilidade */}
                                    {availabilityErrors[
                                      equipment.equipmentId
                                    ] && (
                                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                                        <span className="font-semibold">
                                          ⚠️
                                        </span>
                                        <span>
                                          {
                                            availabilityErrors[
                                              equipment.equipmentId
                                            ]
                                          }
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Controles - Layout Responsivo */}
                                  <div className="flex flex-row gap-4 [@media(max-width:1170px)]:flex-col mt-4">
                                    {/* Controle de Quantidade */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <Label className="text-sm font-medium text-gray-700 text-center sm:text-left sm:w-20">
                                        Quantidade:
                                      </Label>
                                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                                        <div className="flex items-center justify-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              updateQuantity(
                                                equipment.equipmentId,
                                                equipment.quantity - 1
                                              )
                                            }
                                            disabled={equipment.quantity <= 1}
                                            className="h-8 w-8 p-0 shrink-0"
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <Input
                                            type="number"
                                            value={equipment.quantity}
                                            onChange={(e) =>
                                              updateQuantity(
                                                equipment.equipmentId,
                                                Number.parseInt(
                                                  e.target.value
                                                ) || 1
                                              )
                                            }
                                            className="w-14 h-8 text-center font-medium px-1 pr-4 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                            min="1"
                                            max={equipment.maxStock || 999}
                                          />
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              updateQuantity(
                                                equipment.equipmentId,
                                                equipment.quantity + 1
                                              )
                                            }
                                            disabled={
                                              equipment.quantity >=
                                              (equipment.maxStock || 999)
                                            }
                                            className="h-8 w-8 p-0 shrink-0"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        {equipment.maxStock &&
                                          equipment.maxStock < 999 && (
                                            <span className="text-xs text-gray-500 sm:ml-2">
                                              Max: {equipment.maxStock}{' '}
                                              disponível
                                            </span>
                                          )}
                                      </div>
                                    </div>

                                    {/* Controle de Período */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <Label className="text-sm font-medium text-gray-700 text-center sm:text-left">
                                        Dias:
                                      </Label>
                                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                                        <div className="flex items-center justify-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const currentValue =
                                                equipment.days
                                              const newValue = Math.max(
                                                1,
                                                currentValue - 1
                                              )
                                              const days = newValue
                                              updateDays(
                                                equipment.equipmentId,
                                                days
                                              )
                                            }}
                                            className="h-8 w-8 p-0 shrink-0"
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <Input
                                            type="number"
                                            value={equipment.days}
                                            onChange={(e) => {
                                              const periods =
                                                Number.parseInt(
                                                  e.target.value
                                                ) || 1
                                              const days = periods
                                              updateDays(
                                                equipment.equipmentId,
                                                days
                                              )
                                            }}
                                            className="w-14 h-8 text-center font-medium px-1 pr-4 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                            min="1"
                                          />
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const currentValue =
                                                equipment.days
                                              const newValue = currentValue + 1
                                              const days = newValue
                                              updateDays(
                                                equipment.equipmentId,
                                                days
                                              )
                                            }}
                                            className="h-8 w-8 p-0 shrink-0"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap sm:ml-2">
                                          ({equipment.days} dias)
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Preço e Ações */}
                                <div className="text-center sm:text-right shrink-0">
                                  <p className="text-base font-semibold text-primary mb-2">
                                    {formatCurrency(
                                      calculateSubtotal(equipment)
                                    )}
                                  </p>
                                  <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeEquipment(equipment.equipmentId)
                                      }
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                </div>
                              </motion.div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Formulário de Contato - SEMPRE VISÍVEL */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
              {/* Clean depth layers for contact card */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

              <CardHeader className="relative z-10 p-4 sm:p-6 lg:p-6">
                <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600" />
                  Dados para Contato
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Preencha seus dados para receber o orçamento personalizado
                </p>
              </CardHeader>
              <CardContent className="relative z-10 p-4 sm:p-6 lg:p-6 pt-0">
                <form
                  id="quote-form"
                  onSubmit={(e) => {
                    e.preventDefault()

                    // Validação de TODOS os campos obrigatórios
                    const missingFields: string[] = []
                    const fieldIds: string[] = []

                    if (!formData.name || !formData.name.trim()) {
                      missingFields.push('Nome Completo')
                      fieldIds.push('name')
                    }

                    if (!formData.phone || !formData.phone.trim()) {
                      missingFields.push('Telefone')
                      fieldIds.push('phone')
                    }

                    if (!formData.email || !formData.email.trim()) {
                      missingFields.push('E-mail')
                      fieldIds.push('email')
                    }

                    // Se há campos faltantes, mostrar toast informativa
                    if (missingFields.length > 0) {
                      const fieldsList = missingFields.join(', ')
                      toast.info('Campos Obrigatórios', {
                        description: `Por favor, preencha os seguintes campos antes de enviar: ${fieldsList}.`,
                        duration: 6000,
                      })

                      // Focar no primeiro campo faltante
                      if (fieldIds.length > 0) {
                        const firstField = document.getElementById(fieldIds[0]!)
                        if (firstField) {
                          firstField.focus()
                          firstField.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          })
                        }
                      }
                      return
                    }

                    // Se passou nas validações, chama o handleSubmit normal
                    void handleSubmit(e)
                  }}
                  className="space-y-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome completo"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className="mt-1"
                        placeholder="(51) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={handleCPFChange}
                        className="mt-1"
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={handleCNPJChange}
                        className="mt-1"
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="mt-1"
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Empresa/Construtora</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            company: e.target.value,
                          }))
                        }
                        className="mt-1"
                        placeholder="Nome da empresa (se PJ)"
                      />
                    </div>
                  </div>

                  {/* Tipo de Entrega */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4" />
                      Tipo de Entrega/Retirada{' '}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.deliveryType}
                      onValueChange={handleDeliveryTypeChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o tipo de entrega" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PICKUP">Retirada em Loja</SelectItem>
                        <SelectItem value="DELIVERY">
                          Entrega no Endereço
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Endereço de Entrega */}
                  {formData.deliveryType === 'DELIVERY' && (
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4" />
                        Endereço de Entrega
                      </Label>
                      <AddressForm
                        lookupAddress={fetchAddressByCEP}
                        value={
                          formData.deliveryAddress || {
                            cep: '',
                            logradouro: '',
                            numero: '',
                            complemento: '',
                            bairro: '',
                            cidade: '',
                            estado: '',
                          }
                        }
                        onChange={(address) =>
                          setFormData((prev) => ({
                            ...prev,
                            deliveryAddress: address,
                          }))
                        }
                        required
                      />
                    </div>
                  )}

                  {/* Seleção de Frete */}
                  {formData.deliveryType === 'DELIVERY' &&
                    freightOptions.length > 0 && (
                      <div>
                        <Label
                          htmlFor="freight"
                          className="flex items-center gap-2 mb-2"
                        >
                          <Truck className="h-4 w-4" />
                          Opções de Frete
                        </Label>
                        {isCalculatingFreight ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Calculando frete...
                          </div>
                        ) : (
                          <Select
                            modal={false}
                            value={selectedFreight || undefined}
                            onValueChange={setSelectedFreight}
                          >
                            <SelectTrigger className="mt-1 h-auto min-h-[3.5rem] py-3 px-4 [&>span]:line-clamp-none [&>span]:block [&>span]:w-full">
                              <SelectValue placeholder="Selecione uma opção de frete" />
                            </SelectTrigger>
                            <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                              {freightOptions.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.id}
                                  className="py-3 pl-4 pr-2 [&>span:first-child]:hidden"
                                >
                                  <div className="flex flex-col gap-1.5 w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm leading-tight">
                                        {option.name}
                                      </span>
                                      <SelectPrimitive.ItemIndicator className="inline-flex items-center justify-center shrink-0">
                                        <Check className="h-4 w-4 text-orange-600" />
                                      </SelectPrimitive.ItemIndicator>
                                    </div>
                                    <span className="text-sm text-gray-600 leading-tight text-left">
                                      {option.company} •{' '}
                                      {formatCurrency(option.price)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                  <div>
                    <Label htmlFor="message">Observações</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      placeholder="Descreva seu projeto, local de entrega, prazo necessário, etc."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Resumo do Pedido - Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <Card className="lg:sticky lg:top-24 overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
              {/* Clean depth layers for summary card */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

              <CardHeader className="relative z-10 p-4 sm:p-6 lg:p-6">
                <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                  <Package className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600" />
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 space-y-4 p-4 sm:p-6 lg:p-6 pt-0">
                {selectedEquipments.length > 0 ? (
                  <>
                    {selectedEquipments.map((equipment, index) => {
                      const displayRange = resolveDateRange(equipment)

                      return (
                        <div
                          key={`summary-${equipment.equipmentId}-${index}`}
                          className="space-y-1 pb-3"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 pr-2">
                              <p className="font-medium text-gray-900 text-sm leading-tight">
                                {equipment.equipmentName}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-sm text-gray-600 font-medium">
                                  Qtd: {equipment.quantity}x
                                </span>
                                {(() => {
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
                                  const showDiscount =
                                    !pricingConfig.useDirectValue &&
                                    (pricingConfig.discount || 0) > 0
                                  const showDirect =
                                    pricingConfig.useDirectValue && true

                                  return (
                                    <>
                                      <span className="text-sm text-gray-400">
                                        ·
                                      </span>
                                      <span className="text-sm text-orange-600 font-medium">
                                        {actualPeriodLabel}
                                        {showDirect ? ' – valor direto' : ''}
                                      </span>
                                      <span className="text-sm text-gray-400">
                                        ·
                                      </span>
                                      <span className="text-sm text-gray-600 font-medium">
                                        {equipment.days} dias
                                      </span>
                                      {showDirect ? (
                                        <span className="text-sm text-orange-700 font-semibold">
                                          Valor direto:{' '}
                                          {formatCurrency(
                                            pricingConfig.directValue || 0
                                          )}
                                          {pricingConfig.multiplier > 1
                                            ? ` / ${pricingConfig.multiplier} dias`
                                            : ''}
                                        </span>
                                      ) : showDiscount ? (
                                        <span className="text-sm text-green-600 font-semibold">
                                          Desc. {actualPeriodLabel}: -
                                          {pricingConfig.discount}%
                                        </span>
                                      ) : null}
                                    </>
                                  )
                                })()}
                              </div>
                              {/* Informações de datas e finais de semana */}
                              {displayRange && (
                                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-x-3 sm:gap-y-1 mt-1">
                                  <div className="text-xs text-gray-600">
                                    {formatDate(displayRange.startDate)} até{' '}
                                    {formatDate(displayRange.endDate)}
                                    {displayRange.isAuto && (
                                      <span className="text-[10px] text-gray-500">
                                        {' '}
                                        (previsto)
                                      </span>
                                    )}
                                  </div>
                                  {equipment.includeWeekends && (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <span className="text-green-600 font-semibold">
                                        ✓
                                      </span>
                                      <span className="text-gray-600 font-medium">
                                        Incluir finais de semana
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {(() => {
                                const pricingConfig = getPricingConfig(
                                  equipment,
                                  equipment.days
                                )
                                const finalPrice = calculateSubtotal(equipment)
                                const showDiscount =
                                  !pricingConfig.useDirectValue &&
                                  (pricingConfig.discount || 0) > 0
                                // Só calcular originalPrice se realmente for mostrar (desconto, não valor direto)
                                const originalPrice = showDiscount
                                  ? Number(equipment.pricePerDay) *
                                    equipment.days *
                                    equipment.quantity
                                  : 0

                                return (
                                  <div>
                                    {showDiscount && originalPrice > 0 && (
                                      <div className="text-sm text-gray-500 line-through">
                                        {formatCurrency(originalPrice)}
                                      </div>
                                    )}
                                    <div className="font-semibold text-green-600 text-base">
                                      {formatCurrency(finalPrice)}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(
                            selectedEquipments.reduce(
                              (total, eq) => total + calculateSubtotal(eq),
                              0
                            )
                          )}
                        </span>
                      </div>
                      {selectedFreight && freightOptions.length > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Frete:</span>
                          <span className="text-gray-900 font-medium">
                            {formatCurrency(
                              freightOptions.find(
                                (opt) => opt.id === selectedFreight
                              )?.price || 0
                            )}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total:</span>
                        <span className="text-primary text-xl">
                          {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      *Valor estimado. Orçamento final pode variar conforme
                      condições específicas.
                    </p>
                    {/* Termos da própria locadora (onda 134; D-C, parte 1): aceite só com os Termos publicados. */}
                    {termos.exigeAceite && termos.documento
                      ? ((termosPublicados) => (
                          <div className="mt-4 flex items-start gap-3">
                            <Checkbox
                              id="terms-accept"
                              ref={termsCheckboxRef}
                              checked={hasAcceptedTerms}
                              onCheckedChange={(checked) =>
                                setHasAcceptedTerms(checked === true)
                              }
                              aria-describedby="terms-helper"
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1 text-sm text-gray-700">
                                <Label
                                  htmlFor="terms-accept"
                                  className="text-sm text-gray-700"
                                >
                                  Li e concordo com os
                                </Label>
                                <Dialog.Root>
                                  <Dialog.Trigger className="h-auto p-0 text-sm text-orange-600 underline-offset-4 hover:underline hover:text-orange-700 transition-colors duration-200">
                                    Termos de Uso
                                  </Dialog.Trigger>
                                  <Dialog.Portal>
                                    <Dialog.Backdrop />
                                    <Dialog.Popup
                                      variant="default"
                                      className="max-w-3xl"
                                    >
                                      <Dialog.Content>
                                        <Dialog.Header>
                                          <Dialog.HeaderIcon>
                                            <FileText className="h-4 w-4" />
                                          </Dialog.HeaderIcon>
                                          <div className="flex-1 flex flex-col">
                                            <Dialog.Title className="text-lg md:text-xl font-semibold text-gray-800">
                                              Termos e Condições de Uso
                                            </Dialog.Title>
                                            <p className="text-xs text-gray-500">
                                              Última atualização:{' '}
                                              {termosPublicados.lastUpdated}
                                            </p>
                                          </div>
                                          <Dialog.CloseButton aria-label="Fechar termos" />
                                        </Dialog.Header>
                                        <Dialog.Body>
                                          <Dialog.BodyViewport>
                                            <Dialog.BodyContent className="space-y-6">
                                              {termosPublicados.sections.map(
                                                (section, index) => (
                                                  <div
                                                    key={section.id}
                                                    className="space-y-2"
                                                  >
                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                      {index + 1}.{' '}
                                                      {section.title}
                                                    </h3>
                                                    <div className="space-y-2">
                                                      {renderTermsBlocks(
                                                        section.blocks
                                                      )}
                                                    </div>
                                                  </div>
                                                )
                                              )}
                                            </Dialog.BodyContent>
                                          </Dialog.BodyViewport>
                                        </Dialog.Body>
                                        <Dialog.Footer className="flex flex-col-reverse sm:flex-row gap-3">
                                          <Dialog.Close className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium h-10 px-4 py-2 text-sm border border-gray-200 bg-background shadow-md hover:text-orange-600 hover:scale-105 hover:shadow-lg transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
                                            Fechar
                                          </Dialog.Close>
                                        </Dialog.Footer>
                                      </Dialog.Content>
                                    </Dialog.Popup>
                                  </Dialog.Portal>
                                </Dialog.Root>
                              </div>
                              <p
                                id="terms-helper"
                                className="text-xs text-gray-500"
                              >
                                Você precisa aceitar os termos para enviar a
                                solicitação.
                              </p>
                            </div>
                          </div>
                        ))(termos.documento)
                      : null}
                    {termos.bloqueio ? (
                      <p role="alert" className="mt-4 text-sm text-destructive">
                        {termos.bloqueio}
                      </p>
                    ) : null}

                    {/* Botão Principal - Solicitar Orçamento */}
                    <div className="pt-4">
                      <Button
                        type="submit"
                        form="quote-form"
                        className="w-full hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                        size="lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar Solicitação'
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-gray-500">Orçamento Geral</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Receberá proposta personalizada por email
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Dialog de confirmação de finais de semana */}
      <AlertDialog
        open={pendingWeekendConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleWeekendConfirmationCancel()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="relative pr-8">
            <CloseButton
              size="sm"
              variant="ghostWhite"
              className="absolute right-4 top-4"
              onClick={handleWeekendConfirmationCancel}
              aria-label="Fechar dialog"
            />
            <AlertDialogHeaderIcon />
            <AlertDialogTitle>Incluir finais de semana?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-4 md:p-6">
            <AlertDialogDescription>
              Você está solicitando locação de{' '}
              <strong>
                {pendingWeekendConfirmation?.equipmentName ||
                  'este equipamento'}
              </strong>{' '}
              sem ter selecionado datas específicas no calendário.
              <br />
              <br />
              <strong>
                Deseja incluir os finais de semana na contagem de dias?
              </strong>
              <br />
              <br />
              <span className="text-sm text-muted-foreground">
                • <strong>Sim:</strong> Sábados e domingos serão contados como
                dias de locação
                <br />• <strong>Não:</strong> Apenas dias úteis (segunda a
                sexta) serão contados
              </span>
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWeekendConfirmationCancel}>
              Não, apenas dias úteis
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleWeekendConfirmation(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Sim, incluir finais de semana
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs de endereço */}
      {formData.deliveryAddress && (
        <SaveAddressDialog
          open={saveAddressDialogOpen}
          onOpenChange={setSaveAddressDialogOpen}
          address={formData.deliveryAddress}
          isAddressNew={
            userAddresses.length === 0 ||
            !userAddresses.some(
              (savedAddress) =>
                !isAddressDifferent(formData.deliveryAddress!, savedAddress)
            )
          }
          customerInfo={getNewCustomerInfoToSave()}
          onSave={handleSaveAddress}
          onSkip={handleSkipSaveAddress}
        />
      )}

      {selectedSavedAddress && (
        <ConfirmAddressDialog
          open={confirmAddressDialogOpen}
          onOpenChange={(open) => {
            setConfirmAddressDialogOpen(open)
            if (!open) handleCancelAddressDialog()
          }}
          address={selectedSavedAddress}
          onConfirm={handleConfirmAddress}
          onCancel={handleCancelAddressDialog}
          onDismissChange={handleDismissConfirmation}
        />
      )}

      <SelectAddressDialog
        open={selectAddressDialogOpen}
        onOpenChange={(open) => {
          setSelectAddressDialogOpen(open)
          if (!open) handleCancelAddressDialog()
        }}
        addresses={userAddresses}
        onSelect={handleSelectAddress}
        onUseOther={handleUseOtherAddress}
        onCancel={handleCancelAddressDialog}
      />

      {/* Dialog de salvamento de informações do cliente - Só mostra informações NOVAS */}
      <SaveCustomerInfoDialog
        open={saveCustomerInfoDialogOpen}
        onOpenChange={setSaveCustomerInfoDialogOpen}
        customerInfo={getNewCustomerInfoToSave()}
        onSave={handleSaveCustomerInfo}
        onSkip={handleSkipSaveCustomerInfo}
      />

      {/* Google Customer Reviews — opt-in survey após envio com sucesso */}
      {submittedQuote && (
        <GoogleCustomerReviews
          merchantId={contatoDaLocadora.siteContent?.googleMerchantId ?? null}
          orderId={submittedQuote.id}
          customerEmail={submittedQuote.email}
          deliveryCountry="BR"
        />
      )}
    </div>
  )
}

export function QuotePageWrapper() {
  const scope = useQuotePageScope()
  return (
    <Suspense fallback={null}>
      <QuotePage key={scope} />
    </Suspense>
  )
}
