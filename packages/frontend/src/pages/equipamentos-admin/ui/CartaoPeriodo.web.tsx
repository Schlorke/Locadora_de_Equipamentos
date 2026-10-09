'use client'

import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'

import { PRICING_PERIOD_CONFIG, type PricingPeriod } from '../model/tipos'

interface PricingPeriodCardProps {
  period: PricingPeriod
  rentalEnabled: boolean
  onRentalEnabledChange: (_enabled: boolean) => void
  useDirectValue: boolean
  onUseDirectValueChange: (_useDirectValue: boolean) => void
  discount: number
  onDiscountChange: (_discount: number) => void
  directValue: number
  onDirectValueChange: (_directValue: number) => void
  onKeyDown: (_e: React.KeyboardEvent) => void
}

export function PricingPeriodCard({
  period,
  rentalEnabled,
  onRentalEnabledChange,
  useDirectValue,
  onUseDirectValueChange,
  discount,
  onDiscountChange,
  directValue,
  onDirectValueChange,
  onKeyDown,
}: PricingPeriodCardProps) {
  const config = PRICING_PERIOD_CONFIG[period]

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 shadow-xl transition-all duration-300 hover:shadow-2xl"
      style={{
        boxShadow:
          'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px', // token-check-allow: sombra original do cartão de período de preço
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">{config.label}</h4>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={`${period}RentalDisabled`}
            checked={!rentalEnabled}
            onChange={(e) => onRentalEnabledChange(!e.target.checked)}
            className="rounded text-orange-600"
            aria-label={config.disableLabel}
          />
          <Label
            htmlFor={`${period}RentalDisabled`}
            className="text-xs text-gray-700"
          >
            {config.disableLabel}
          </Label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column: Percentage discount */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`${period}UsePercentage`}
              checked={!useDirectValue}
              onChange={(e) => {
                onUseDirectValueChange(!e.target.checked)
              }}
              disabled={!rentalEnabled}
              className="rounded text-orange-600 disabled:cursor-not-allowed"
              aria-label={`Usar desconto percentual para período ${config.label.split(' ')[1]?.toLowerCase() || period}`}
            />
            <Label
              htmlFor={`${period}UsePercentage`}
              className="text-xs text-gray-700"
            >
              Usar desconto percentual
            </Label>
          </div>
          <div>
            <Label
              htmlFor={`${period}Discount`}
              className="text-xs text-gray-600"
            >
              Desconto (%)
            </Label>
            <Input
              id={`${period}Discount`}
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0
                const clampedValue = Math.min(Math.max(value, 0), 100)
                onDiscountChange(clampedValue)
              }}
              disabled={useDirectValue || !rentalEnabled}
              className="mt-1 text-sm"
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        {/* Right column: Direct value */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`${period}UseDirectValue`}
              checked={useDirectValue}
              onChange={(e) => {
                onUseDirectValueChange(e.target.checked)
              }}
              disabled={!rentalEnabled}
              className="rounded text-orange-600 disabled:cursor-not-allowed"
              aria-label={`Usar valor direto para período ${config.label.split(' ')[1]?.toLowerCase() || period}`}
            />
            <Label
              htmlFor={`${period}UseDirectValue`}
              className="text-xs text-gray-700"
            >
              Usar valor direto
            </Label>
          </div>
          <div>
            <Label
              htmlFor={`${period}DirectValue`}
              className="text-xs text-gray-600"
            >
              Valor Direto (R$)
            </Label>
            <Input
              id={`${period}DirectValue`}
              type="number"
              min="0"
              step="0.01"
              value={directValue}
              onChange={(e) =>
                onDirectValueChange(parseFloat(e.target.value) || 0)
              }
              disabled={!useDirectValue || !rentalEnabled}
              className="mt-1 text-sm"
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
