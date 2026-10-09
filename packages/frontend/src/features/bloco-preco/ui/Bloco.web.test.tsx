import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EquipmentQuotePriceBlock } from './Bloco.web'
import type { EquipmentQuotePriceBlockVariant } from './contract'

const cases: Array<{
  variant: EquipmentQuotePriceBlockVariant
  label: string
  amount: string
  original: boolean
}> = [
  {
    variant: {
      kind: 'discount',
      periodLabel: 'Mensal',
      appliedDiscount: 25,
      discountAmount: 50,
    },
    label: 'Preço final:',
    amount: '150,00',
    original: true,
  },
  {
    variant: { kind: 'direct', directValue: 120 },
    label: 'Valor direto:',
    amount: '120,00',
    original: true,
  },
  {
    variant: { kind: 'simple' },
    label: 'Preço final:',
    amount: '150,00',
    original: false,
  },
]

describe('Bloco de preço do orçamento', () => {
  it.each(cases)(
    '$variant.kind: exibe o valor contratado por último',
    ({ variant, label, amount, original }) => {
      const html = renderToStaticMarkup(
        <EquipmentQuotePriceBlock
          equipmentName="Betoneira"
          originalPrice={200}
          finalPrice={150}
          variant={variant}
          contentBeforeFinalPrice={<p>Quantidade: 2</p>}
        />
      )
      const text = html
        .replace(/<[^>]*>/g, '')
        .replace(/(?:&nbsp;|\u00a0)/g, ' ')
      expect(text).toContain('Betoneira')
      expect(text.includes('Preço original:')).toBe(original)
      if (original) expect(text).toContain('Preço original:R$ 200,00')
      if (variant.kind === 'discount') {
        expect(text).toContain('Mensal: -25%')
        expect(text).toContain('-R$ 50,00')
      }
      expect(text.indexOf('Quantidade: 2')).toBeLessThan(text.indexOf(label))
      expect(text).toMatch(new RegExp(`${label}R\\$ ${amount}$`))
    }
  )
})
