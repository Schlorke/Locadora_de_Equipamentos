import type * as React from 'react'
export type EquipmentQuotePriceBlockVariant =
  | {
      kind: 'discount'
      periodLabel: string
      appliedDiscount: number
      discountAmount: number
    }
  | { kind: 'direct'; directValue: number }
  | { kind: 'simple' }

export interface EquipmentQuotePriceBlockProps {
  /** Nome do equipamento */
  equipmentName: string
  /** Preço original (antes de desconto) - usado em discount e direct */
  originalPrice: number
  /** Preço final (após desconto ou valor direto) */
  finalPrice: number
  /** Tipo de exibição: desconto percentual, valor direto ou apenas final */
  variant: EquipmentQuotePriceBlockVariant
  /** Classe opcional no wrapper do bloco (ex.: pt-4 border-t para itens > 0) */
  className?: string
  /** Conteúdo opcional antes do preço final (Qtd, período, datas), para que o valor final fique por último */
  contentBeforeFinalPrice?: React.ReactNode
  /** Quando true, "Preço original:" e o valor ficam na mesma linha (ex.: admin/orcamentos) */
  inlineOriginalPrice?: boolean
}
