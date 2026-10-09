'use client'

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { formatCurrency } from '../../../shared/lib/moeda'
/**
 * Bloco de preço padrão para orçamento de equipamento.
 * Garante o mesmo formato DOM em toda a aplicação: nome do equipamento,
 * preço original (se aplicável), desconto ou valor direto, preço final.
 * O valor final sempre fica por último.
 *
 * Estrutura DOM (design system):
 * - Nome: p.text-sm.font-medium.text-gray-900.mb-2
 * - Preço original: p.text-xs.text-gray-500.line-through (label + valor)
 * - Desconto: p.text-xs.font-semibold.text-orange-600 (label + valor)
 * - contentBeforeFinalPrice (opcional): Qtd, período, datas, etc.
 * - Preço final: p.text-sm.font-bold (label gray-900 + valor green-600), border-t
 */
import type { EquipmentQuotePriceBlockProps } from './contract'

const FinalPriceBlock = ({
  label,
  value,
}: {
  label: string
  value: number
}) => (
  <div className="pt-1 border-t border-gray-200">
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <span className="text-sm font-bold text-green-600">
        {formatCurrency(value)}
      </span>
    </div>
  </div>
)

function OriginalPriceBlock({ value }: { value: number; inline?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xs text-gray-500 line-through">
        Preço original:
      </span>
      <span className="text-xs text-gray-500 line-through">
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function EquipmentQuotePriceBlock({
  equipmentName,
  originalPrice,
  finalPrice,
  variant,
  className,
  contentBeforeFinalPrice,
  inlineOriginalPrice,
}: EquipmentQuotePriceBlockProps) {
  return (
    <div className={cn(className)}>
      <p className="text-sm font-medium text-gray-900 mb-2">{equipmentName}</p>

      {variant.kind === 'discount' && (
        <div className="space-y-1">
          <OriginalPriceBlock
            value={originalPrice}
            inline={inlineOriginalPrice}
          />
          <p className="text-xs font-semibold text-orange-600">
            {variant.periodLabel}: -{variant.appliedDiscount}%
          </p>
          <p className="text-xs font-semibold text-orange-600">
            -{formatCurrency(variant.discountAmount)}
          </p>
          {contentBeforeFinalPrice}
          <FinalPriceBlock label="Preço final:" value={finalPrice} />
        </div>
      )}

      {variant.kind === 'direct' && (
        <div className="space-y-1">
          <OriginalPriceBlock
            value={originalPrice}
            inline={inlineOriginalPrice}
          />
          {contentBeforeFinalPrice}
          <FinalPriceBlock label="Valor direto:" value={variant.directValue} />
        </div>
      )}

      {variant.kind === 'simple' && (
        <div className="pt-1 space-y-1">
          {contentBeforeFinalPrice}
          <FinalPriceBlock label="Preço final:" value={finalPrice} />
        </div>
      )}
    </div>
  )
}
