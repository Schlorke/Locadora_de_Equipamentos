'use client'

import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { Edit, Package, Truck } from 'lucide-react'
import { formatCurrency } from '../../../shared/lib/formatting'
import type { Quote, QuoteAdjustmentFromApi } from '../../../entities/orcamento'

export interface QuoteDeliveryCardProps {
  selectedQuote: Quote
  selectedQuoteAdjustments: QuoteAdjustmentFromApi[]
  onEditClick: () => void
}

export function QuoteDeliveryCard({
  selectedQuote,
  selectedQuoteAdjustments,
  onEditClick,
}: QuoteDeliveryCardProps) {
  if (!selectedQuote.deliveryType && !selectedQuote.deliveryAddress) {
    return null
  }

  return (
    <Card className="rounded-lg text-card-foreground border border-slate-200 bg-slate-50/60 shadow-md">
      <CardContent className="p-0">
        <div className="space-y-2 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                Entrega / Retirada
              </p>
              {selectedQuote.deliveryType && (
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Tipo:
                  </span>
                  <span className="font-mono text-xs text-slate-600 sm:text-sm truncate uppercase">
                    {selectedQuote.deliveryType === 'DELIVERY'
                      ? 'Entrega no Endereço'
                      : 'Retirada em Loja'}
                  </span>
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs w-full sm:w-auto gap-1.5 border-slate-200 text-slate-700"
            aria-label="Editar entrega e endereço"
            onClick={onEditClick}
          >
            <Edit className="h-3 w-3" />
            Editar
          </Button>
        </div>
        <div className="border-t border-slate-200">
          {(() => {
            const hasTravelAdjustment = selectedQuoteAdjustments.some(
              (a) => a.category === 'TRAVEL'
            )
            const showDeliveryFeeRow =
              !hasTravelAdjustment &&
              selectedQuote.deliveryFee != null &&
              selectedQuote.deliveryFee > 0
            const isClientRequestedQuote =
              selectedQuote.deliveryType === 'DELIVERY' &&
              !!selectedQuote.deliveryAddress
            if (!showDeliveryFeeRow) return null
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                    Valor do Frete
                    {isClientRequestedQuote ? ' (calculado pelo sistema)' : ''}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatCurrency(selectedQuote.deliveryFee ?? 0)}
                  </p>
                </div>
              </div>
            )
          })()}
          {selectedQuote.deliveryAddress &&
            selectedQuote.deliveryType === 'DELIVERY' && (
              <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-2">
                  Endereço de Entrega
                </p>
                <div className="flex flex-col gap-1 px-3 pt-3 pb-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="space-y-1 text-sm text-slate-900">
                    {selectedQuote.deliveryAddress.street && (
                      <div>
                        <span className="font-bold">Logradouro:</span>{' '}
                        {selectedQuote.deliveryAddress.street}
                        {selectedQuote.deliveryAddress.number &&
                          `, ${selectedQuote.deliveryAddress.number}`}
                        {selectedQuote.deliveryAddress.complement &&
                          ` - ${selectedQuote.deliveryAddress.complement}`}
                      </div>
                    )}
                    {selectedQuote.deliveryAddress.neighborhood && (
                      <div>
                        <span className="font-bold">Bairro:</span>{' '}
                        {selectedQuote.deliveryAddress.neighborhood}
                      </div>
                    )}
                    {(selectedQuote.deliveryAddress.city ||
                      selectedQuote.deliveryAddress.state) && (
                      <div>
                        <span className="font-bold">Cidade/Estado:</span>{' '}
                        {selectedQuote.deliveryAddress.city || ''}
                        {selectedQuote.deliveryAddress.city &&
                          selectedQuote.deliveryAddress.state &&
                          ' / '}
                        {selectedQuote.deliveryAddress.state || ''}
                      </div>
                    )}
                    {selectedQuote.deliveryAddress.zipCode && (
                      <div>
                        <span className="font-bold">CEP:</span>{' '}
                        {selectedQuote.deliveryAddress.zipCode}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          {selectedQuote.deliveryType === 'PICKUP' && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <p className="text-sm text-slate-900">
                  Cliente retirará os equipamentos na loja
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
