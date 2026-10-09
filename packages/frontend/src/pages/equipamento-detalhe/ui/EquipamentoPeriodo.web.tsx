'use client'
import { useEquipmentPeriod } from '../model/use-equipment-period'
import type { EquipmentPricingSelectorProps } from '../model/pricing-contract'

import { Badge, Button } from '../../../shared/ui'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Clock, TrendingDown } from 'lucide-react'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function EquipmentPricingSelector({
  pricePerDay,
  onPeriodChange,
  className,
  dailyDiscount = 0,
  weeklyDiscount = 10,
  biweeklyDiscount = 15,
  monthlyDiscount = 20,
  popularPeriod = 'weekly',
  // Direct value pricing configurations
  dailyDirectValue = 0,
  weeklyDirectValue = 0,
  biweeklyDirectValue = 0,
  monthlyDirectValue = 0,
  // Pricing method control (percentage or direct value)
  dailyUseDirectValue = false,
  weeklyUseDirectValue = false,
  biweeklyUseDirectValue = false,
  monthlyUseDirectValue = false,
  dailyRentalEnabled = true,
  weeklyRentalEnabled = true,
  biweeklyRentalEnabled = true,
  monthlyRentalEnabled = true,
  // Datas selecionadas no calendário
  selectedDays = 0,
  startDate,
  endDate: _endDate,
  selectedPeriod: externalSelectedPeriod,
}: EquipmentPricingSelectorProps) {
  const {
    pricingOptions,
    selectedPeriod,
    handlePeriodChange,
    selectedPrice,
    originalPrice,
    pricingConfig,
    isUsingDirectValue,
  } = useEquipmentPeriod({
    pricePerDay,
    onPeriodChange,
    className,
    dailyDiscount,
    weeklyDiscount,
    biweeklyDiscount,
    monthlyDiscount,
    popularPeriod,
    dailyDirectValue,
    weeklyDirectValue,
    biweeklyDirectValue,
    monthlyDirectValue,
    dailyUseDirectValue,
    weeklyUseDirectValue,
    biweeklyUseDirectValue,
    monthlyUseDirectValue,
    dailyRentalEnabled,
    weeklyRentalEnabled,
    biweeklyRentalEnabled,
    monthlyRentalEnabled,
    selectedDays,
    startDate,
    endDate: _endDate,
    selectedPeriod: externalSelectedPeriod,
  })

  return (
    <div className={cn('space-y-3', className)}>
      {/* Seletor de Período */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Desconto aplicado
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {pricingOptions.map((option) => {
            const isUnavailable = option.enabled === false
            return (
              <Button
                key={option.id}
                type="button"
                variant={
                  selectedPeriod.id === option.id ? 'gradient' : 'outline'
                }
                size="sm"
                disabled={isUnavailable}
                className={cn(
                  'relative justify-center text-sm py-3 h-auto border shadow-sm',
                  isUnavailable
                    ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed opacity-90 hover:bg-gray-100 hover:opacity-90'
                    : selectedPeriod.id === option.id
                      ? 'bg-[linear-gradient(to_right,#f97316,#ea580c,#f97316)] bg-[length:200%_100%] bg-left hover:bg-right text-white border-orange-600 shadow-lg transition-[background-position,transform,box-shadow] duration-500 ease-in-out' /* token-check-allow: gradiente laranja do período selecionado, orange-500 e orange-600 */
                      : 'bg-white border-border text-gray-700 hover:text-orange-500 hover:bg-white hover:border-gray-200 transition-[color,transform,box-shadow] duration-300'
                )}
                onClick={(e) => handlePeriodChange(option, e)}
                aria-disabled={isUnavailable}
                title={
                  isUnavailable
                    ? 'Período não oferecido para este equipamento'
                    : undefined
                }
              >
                <div className="text-center">
                  <div className="font-semibold">{option.label}</div>
                  {isUnavailable ? (
                    <div className="text-xs mt-1 text-gray-500 font-medium">
                      Indisponível
                    </div>
                  ) : option.useDirectValue &&
                    option.directValue !== undefined &&
                    option.directValue !== null &&
                    option.directValue > 0 ? (
                    <div className="text-xs opacity-90 mt-1">
                      {formatCurrency(option.directValue)}
                    </div>
                  ) : option.useDirectValue &&
                    option.directValue !== undefined &&
                    option.directValue !== null &&
                    option.directValue === 0 ? (
                    <div className="text-xs opacity-90 mt-1">R$ 0,00</div>
                  ) : option.discount > 0 ? (
                    <div className="text-xs opacity-90 mt-1">
                      {option.discount}% OFF
                    </div>
                  ) : null}
                </div>
                {option.popular && !isUnavailable && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 text-xs px-2 py-1 h-auto font-medium shadow-md"
                  >
                    Popular
                  </Badge>
                )}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Exibição do Preço */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-lg p-3 border border-orange-200/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="h-3 w-3" />
            <span>
              {selectedDays > 0
                ? `Preço por ${selectedDays} ${selectedDays === 1 ? 'dia' : 'dias'}`
                : `Preço por ${selectedPeriod.period}`}
            </span>
          </div>
          {!isUsingDirectValue &&
            ((selectedDays > 0 &&
              pricingConfig &&
              pricingConfig.discount > 0) ||
              (selectedDays === 0 && selectedPeriod.discount > 0)) && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-3 w-3" />
                <span className="text-xs font-medium">
                  {selectedDays > 0 && pricingConfig
                    ? `${pricingConfig.discount}% OFF`
                    : `${selectedPeriod.discount}% OFF`}
                </span>
              </div>
            )}
        </div>

        <div className="space-y-1">
          {!isUsingDirectValue &&
            ((selectedDays > 0 &&
              pricingConfig &&
              pricingConfig.discount > 0) ||
              (selectedDays === 0 && selectedPeriod.discount > 0)) && (
              <div className="text-xs text-gray-500 line-through">
                De: {formatCurrency(originalPrice)}
              </div>
            )}
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(selectedPrice)}
          </div>
          {!isUsingDirectValue &&
            ((selectedDays > 0 && selectedDays > 1) ||
              (selectedDays === 0 && selectedPeriod.multiplier > 1)) && (
              <div className="text-xs text-gray-600">
                {formatCurrency(
                  selectedDays > 0
                    ? selectedPrice / selectedDays
                    : selectedPrice / selectedPeriod.multiplier
                )}{' '}
                por dia
                {((selectedDays > 0 &&
                  pricingConfig &&
                  pricingConfig.discount > 0) ||
                  (selectedDays === 0 && selectedPeriod.discount > 0)) && (
                  <span className="text-green-600 ml-1 font-medium">
                    (economia: {formatCurrency(originalPrice - selectedPrice)})
                  </span>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Informações Adicionais - apenas para desconto percentual */}
      {!isUsingDirectValue &&
        ((selectedDays > 0 && pricingConfig && pricingConfig.discount > 0) ||
          (selectedDays === 0 && selectedPeriod.discount > 0)) && (
          <div className="text-xs bg-green-50 p-2.5 rounded-md border border-green-200">
            <div className="flex items-center gap-1.5 text-green-700 font-medium">
              <TrendingDown className="h-3 w-3" />
              <span>
                Você economiza {formatCurrency(originalPrice - selectedPrice)}{' '}
                com este período!
              </span>
            </div>
          </div>
        )}
    </div>
  )
}
