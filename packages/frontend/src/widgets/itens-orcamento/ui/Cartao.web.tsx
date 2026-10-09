'use client'

import Image from 'next/image'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@gb-locacoes/ui'
import { EquipmentQuotePriceBlock } from '../../../features/bloco-preco'
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  User,
} from 'lucide-react'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatAdjustmentReason,
  formatDate,
  type Quote,
  type QuoteAdjustmentFromApi,
  ADJUSTMENT_CATEGORY_LABEL,
  createDefaultAdjustmentItem,
  type PriceAdjustmentItem,
} from '../../../entities/orcamento'
import { formatCurrency, getInitials } from '../../../shared/lib/formatting'
import { toast } from 'sonner'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QuoteItemsCardProps {
  selectedQuote: Quote
  selectedQuoteStatus: string
  selectedQuoteAdjustments: QuoteAdjustmentFromApi[]
  boletoPayment: { status?: string } | null
  isAdjustingPrice: boolean
  removingItemId: string | null
  removingAdjustmentId: string | null
  onRemoveItem: (_itemId: string) => void
  onEditItem: (_item: NonNullable<Quote['items']>[number]) => void
  onRemoveAdjustment: (_adjustmentId: string) => void
  onEditAdjustment: (_adjustment: QuoteAdjustmentFromApi) => void
  onOpenPriceAdjustment: (_initialItems: PriceAdjustmentItem[]) => void
}

export function QuoteItemsCard({
  selectedQuote,
  selectedQuoteStatus,
  selectedQuoteAdjustments,
  boletoPayment,
  isAdjustingPrice,
  removingItemId,
  removingAdjustmentId,
  onRemoveItem,
  onEditItem,
  onRemoveAdjustment,
  onEditAdjustment,
  onOpenPriceAdjustment,
}: QuoteItemsCardProps) {
  return (
    <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md">
      <CardContent className="p-0">
        {/* Cabeçalho: ícone + título/código; botão Adicionar equipamento abaixo (mesmo espaçamento do card do cliente para alinhar a borda) */}
        <div className="space-y-2 p-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                Equipamentos e Valores
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                  Código:
                </span>
                <span className="font-mono text-xs text-slate-600 sm:text-sm">
                  {selectedQuote.quoteCode || selectedQuote.id}
                </span>
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs w-full sm:w-auto gap-1.5 border-slate-200 text-slate-700"
            aria-label="Adicionar equipamento ao orçamento"
            onClick={() =>
              toast.info('Adicionar equipamento em desenvolvimento')
            }
          >
            <Plus className="h-3 w-3" />
            Adicionar equipamento
          </Button>
        </div>
        <div className="border-t border-orange-200">
          <div className="space-y-6 px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
            {/* Seção Equipamentos - border-b só quando há equipamentos E seção valores (para separar os blocos) */}
            <div
              className={cn(
                'space-y-4',
                ((Array.isArray(selectedQuote.items) &&
                  selectedQuote.items.length > 0) ||
                  (Array.isArray(selectedQuote.equipments) &&
                    (selectedQuote.equipments?.length ?? 0) > 0)) &&
                  (selectedQuote.originalTotal ||
                    selectedQuote.finalTotal ||
                    selectedQuote.priceAdjustmentReason ||
                    selectedQuote.lateFee) &&
                  'border-b-2 border-orange-200 pb-4'
              )}
            >
              {Array.isArray(selectedQuote.items) &&
                selectedQuote.items.length > 0 &&
                selectedQuote.items.map((item, index) => {
                  const equipment = item.equipment
                  if (!equipment) return null

                  const originalPrice = item.pricePerDay
                    ? item.pricePerDay * item.days * item.quantity
                    : 0
                  const finalPrice = item.total || originalPrice
                  const hasDiscount =
                    item.appliedDiscount &&
                    item.appliedDiscount > 0 &&
                    !item.useDirectValue
                  const hasDirectValue =
                    item.useDirectValue === true && (item.directValue ?? 0) > 0
                  const appliedDiscount = item.appliedDiscount ?? 0
                  const discountAmount = originalPrice - finalPrice
                  const normalizedPeriod = (item.appliedPeriod || '')
                    .toString()
                    .toLowerCase()

                  const periodLabel =
                    normalizedPeriod === 'weekly' ||
                    normalizedPeriod === 'semanal'
                      ? 'Semanal'
                      : normalizedPeriod === 'biweekly' ||
                          normalizedPeriod === 'quinzenal'
                        ? 'Quinzenal'
                        : normalizedPeriod === 'monthly' ||
                            normalizedPeriod === 'mensal'
                          ? 'Mensal'
                          : 'Diário'

                  const thumbnailUrl =
                    (
                      equipment as {
                        images?: string[]
                      }
                    )?.images?.[0]?.trim() || null

                  return (
                    <div
                      key={item.id || index}
                      className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail - mesmo padrão área do cliente */}
                        <div className="shrink-0">
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                            {thumbnailUrl ? (
                              <Image
                                src={thumbnailUrl}
                                alt={equipment.name ?? ''}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Package className="h-6 w-6 text-slate-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Detalhes - formato padrão de orçamento por equipamento */}
                        <div className="flex-1 min-w-0">
                          <EquipmentQuotePriceBlock
                            equipmentName={equipment.name ?? ''}
                            originalPrice={originalPrice}
                            finalPrice={finalPrice}
                            inlineOriginalPrice
                            variant={
                              hasDiscount
                                ? {
                                    kind: 'discount',
                                    periodLabel,
                                    appliedDiscount,
                                    discountAmount,
                                  }
                                : hasDirectValue
                                  ? {
                                      kind: 'direct',
                                      directValue: item.directValue ?? 0,
                                    }
                                  : { kind: 'simple' }
                            }
                            contentBeforeFinalPrice={
                              <>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <span className="text-[13px] text-gray-600 font-medium">
                                    Qtd: {item.quantity}x
                                  </span>
                                  <span className="text-[13px] text-gray-400">
                                    ·
                                  </span>
                                  <span className="text-[13px] text-orange-600 font-medium">
                                    {periodLabel}
                                  </span>
                                  <span className="text-[13px] text-gray-400">
                                    ·
                                  </span>
                                  <span className="text-[13px] text-gray-600 font-medium">
                                    {item.days}{' '}
                                    {item.days === 1 ? 'dia' : 'dias'}
                                  </span>
                                </div>
                                {item.startDate && item.endDate && (
                                  <div className="text-[13px] text-gray-900 font-semibold mt-1">
                                    {formatDate(item.startDate)} até{' '}
                                    {formatDate(item.endDate)}
                                  </div>
                                )}
                                {item.includeWeekends !== undefined && (
                                  <div className="flex items-center gap-1.5 text-[13px] mt-1">
                                    <span
                                      className={
                                        item.includeWeekends
                                          ? 'text-green-600 font-semibold'
                                          : 'text-red-600 font-semibold'
                                      }
                                    >
                                      {item.includeWeekends ? '✓' : '✗'}
                                    </span>
                                    <span className="text-gray-600 font-medium">
                                      {item.includeWeekends
                                        ? 'Incluir finais de semana'
                                        : 'Não inclui finais de semana'}
                                    </span>
                                  </div>
                                )}
                              </>
                            }
                          />
                        </div>
                      </div>
                      <div className="flex w-full items-center gap-2 pt-3 mt-2 border-t border-gray-200">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                          onClick={() => {
                            if (item.id) {
                              onRemoveItem(item.id)
                            }
                          }}
                          disabled={removingItemId === item.id}
                          aria-label="Remover item do orçamento"
                        >
                          {removingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                          Remover
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                          onClick={() => onEditItem(item)}
                          aria-label="Editar item do orçamento"
                        >
                          <Edit className="h-3.5 w-3.5 shrink-0" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              {(!selectedQuote.items || selectedQuote.items.length === 0) &&
                Array.isArray(selectedQuote.equipments) &&
                selectedQuote.equipments.map((equipment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {equipment.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        Quantidade: {equipment.quantity} -{' '}
                        {formatCurrency(equipment.dailyPrice)}
                        /dia
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(
                          equipment.quantity * equipment.dailyPrice
                        )}
                      </div>
                      <div className="text-xs text-slate-500">subtotal/dia</div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Seção Valores (condicional) - sem border-t; a divisória fica no bloco de equipamentos (border-b) */}
            {(selectedQuote.originalTotal ||
              selectedQuote.finalTotal ||
              selectedQuote.priceAdjustmentReason ||
              selectedQuote.lateFee) && (
              <div className="space-y-4 pt-0 mt-0">
                <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-green-700">
                      Valor Original
                    </div>
                    {selectedQuoteStatus === 'approved' &&
                      boletoPayment &&
                      ['PENDING', 'OVERDUE'].includes(
                        boletoPayment.status?.toUpperCase() ?? ''
                      ) && (
                        <Badge
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm border-0 bg-orange-500 text-white hover:bg-orange-600 transition-colors duration-200"
                          aria-label="Pagamento pendente"
                        >
                          Pendente
                        </Badge>
                      )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const deliveryFee =
                        Number(selectedQuote.deliveryFee ?? 0) || 0
                      const pickupFee =
                        Number(selectedQuote.pickupFee ?? 0) || 0
                      const freightTotal = deliveryFee + pickupFee
                      return (
                        freightTotal > 0 && (
                          <>
                            <div className="text-sm font-medium text-slate-600">
                              Frete:
                            </div>
                            <div className="text-sm font-medium text-slate-600">
                              {formatCurrency(freightTotal)}
                            </div>
                          </>
                        )
                      )
                    })()}
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(
                        selectedQuote.originalTotal ??
                          selectedQuote.totalPrice ??
                          0
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Calculado com base nos equipamentos e descontos
                  </div>
                </div>

                {selectedQuote.lateFee && selectedQuote.lateFee > 0 && (
                  <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-red-700">
                        Multa por Atraso
                      </div>
                      {selectedQuote.lateFeeApproved ? (
                        <Badge className="border border-slate-200 bg-slate-100 text-xs text-slate-700">
                          Aprovada
                        </Badge>
                      ) : (
                        <Badge
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm border-0 bg-red-500 text-white hover:bg-red-600 transition-colors duration-200"
                          aria-label="Multa pendente de aprovação"
                        >
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <div className="-mt-0.5 text-lg font-bold text-red-600">
                      {formatCurrency(selectedQuote.lateFee)}
                    </div>
                    {selectedQuote.lateFeeApprovedAt && (
                      <div className="text-xs text-slate-600 mt-2">
                        Aprovada em:{' '}
                        {new Date(
                          selectedQuote.lateFeeApprovedAt
                        ).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}

                {((selectedQuote.finalTotal &&
                  selectedQuote.finalTotal !==
                    (selectedQuote.originalTotal ??
                      selectedQuote.totalPrice)) ||
                  selectedQuoteAdjustments.length > 0) && (
                  <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-700">
                      Valor Final Editado
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-lg font-bold text-orange-600">
                        {formatCurrency(selectedQuote.finalTotal ?? 0)}
                      </div>
                      {(() => {
                        const originalValue =
                          selectedQuote.originalTotal ??
                          selectedQuote.totalPrice ??
                          0
                        const finalValue = selectedQuote.finalTotal ?? 0
                        const difference = finalValue - originalValue
                        const absDifference = Math.abs(difference)
                        const isIncrease = difference > 0
                        if (difference === 0) return null
                        return (
                          <div
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold border ${
                              isIncrease
                                ? 'bg-green-600 text-white border-green-600'
                                : 'bg-red-600 text-white border-red-600'
                            }`}
                            title={
                              isIncrease
                                ? 'Aumento no valor'
                                : 'Redução no valor'
                            }
                          >
                            {isIncrease ? (
                              <ArrowUp
                                className="h-3 w-3 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <ArrowDown
                                className="h-3 w-3 shrink-0"
                                aria-hidden
                              />
                            )}
                            <span>
                              {isIncrease ? 'mais' : 'menos'}{' '}
                              {formatCurrency(absDifference)}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                    {selectedQuoteAdjustments.length > 0 ? (
                      <div className="mt-2 space-y-3">
                        {selectedQuoteAdjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className="flex flex-col bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
                          >
                            {/* Header: administrador que criou o ajuste + data do ajuste */}
                            <div className="flex items-center gap-2.5 border-b border-slate-100 p-4">
                              <Avatar className="h-10 w-10 shrink-0 rounded-full border-2 border-slate-200 bg-slate-100">
                                {adj.createdByUser?.image ? (
                                  <AvatarImage
                                    src={adj.createdByUser.image}
                                    alt=""
                                    className="object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-500 to-orange-500 text-xs font-semibold text-white shadow-sm">
                                  {getInitials(
                                    adj.createdByUser?.name ?? 'Admin'
                                  ) || <User className="h-4 w-4" />}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {adj.createdByUser?.name ?? 'Administrador'}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-600">
                                  {adj.createdByUser?.email ?? '—'}
                                </p>
                                {adj.createdAt && (
                                  <p className="mt-1 text-xs text-slate-600">
                                    Ajustado em:{' '}
                                    {new Date(adj.createdAt).toLocaleString(
                                      'pt-BR'
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Conteúdo: categoria, valor, justificativa */}
                            <div className="flex flex-col gap-3 p-4">
                              <div className="flex flex-col gap-0.5 pb-3 border-b border-slate-100">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                  {ADJUSTMENT_CATEGORY_LABEL[adj.category]}
                                </span>
                                <span className="text-sm text-slate-900">
                                  {formatCurrency(adj.amount)}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 pt-3">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                  Justificativa
                                </span>
                                <p className="mt-0.5 text-sm text-slate-700">
                                  {adj.justification}
                                </p>
                              </div>
                            </div>
                            {/* Botões Remover e Editar (mesmo estilo do bloco de equipamento) */}
                            <div className="flex w-full items-center gap-2 border-t border-slate-200 pt-3 mt-2 px-4 pb-4">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                                onClick={() => onRemoveAdjustment(adj.id)}
                                disabled={removingAdjustmentId === adj.id}
                                aria-label="Remover reajuste do orçamento"
                              >
                                {removingAdjustmentId === adj.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                )}
                                Remover
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                                onClick={() => onEditAdjustment(adj)}
                                aria-label="Editar reajuste do orçamento"
                              >
                                <Edit className="h-3.5 w-3.5 shrink-0" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      selectedQuote.priceAdjustmentReason && (
                        <div className="mt-2 rounded border border-slate-200 bg-white p-3">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                            Justificativa do Ajuste
                          </div>
                          <div className="text-sm text-slate-900">
                            {formatAdjustmentReason(
                              selectedQuote.priceAdjustmentReason
                            )}
                          </div>
                          {selectedQuote.priceAdjustedAt && (
                            <div className="text-xs text-slate-600 mt-2">
                              Ajustado em:{' '}
                              {new Date(
                                selectedQuote.priceAdjustedAt
                              ).toLocaleString('pt-BR')}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                <Button
                  onClick={() => {
                    const deliveryFee =
                      (selectedQuote?.deliveryFee != null
                        ? Number(selectedQuote.deliveryFee)
                        : 0) || 0
                    const hasTravelAdj = selectedQuoteAdjustments.some(
                      (a) => a.category === 'TRAVEL'
                    )
                    const initialItem =
                      deliveryFee > 0 && !hasTravelAdj
                        ? createDefaultAdjustmentItem({
                            category: 'TRAVEL',
                            value: deliveryFee,
                            reason: 'Deslocamento (Frete)',
                          })
                        : createDefaultAdjustmentItem({ value: 0, reason: '' })
                    onOpenPriceAdjustment([initialItem])
                  }}
                  disabled={isAdjustingPrice}
                  variant="outline"
                  size="default"
                  className="w-full border-gray-200 bg-background shadow-md hover:text-orange-600 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Ajustar Valor Final
                </Button>
              </div>
            )}

            {/* Mensagem do Cliente (último bloco do card Equipamentos e Valores) */}
            {selectedQuote.message && (
              <div className="space-y-3 border-t-2 border-orange-200 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    Mensagem do Cliente
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {selectedQuote.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
