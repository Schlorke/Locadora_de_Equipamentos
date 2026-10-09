import {
  exactIntelligentPrice,
  type PricingValues,
} from '../equipamento/preco'
import { roundToCents } from '../locacao/saldo'

const PERIOD_LABELS: Record<string, string> = {
  daily: 'diaria',
  weekly: 'semanal',
  biweekly: 'quinzenal',
  monthly: 'mensal',
}

/** Equipamento como vem do banco: dinheiro em Decimal do Prisma, texto ou número. */
export type EquipmentPricingInput = PricingValues

export function buildQuotePricing(
  equipment: EquipmentPricingInput,
  days: number,
  quantity: number
) {
  // A mesma função que a tela usa (`calculateIntelligentPrice`): o preço mostrado é o gravado.
  const { pricingConfig, price: unitTotal } = exactIntelligentPrice(equipment, days)
  const safeDays = Math.max(1, days)

  return {
    /** Taxa diária de referência (não é cobrada diretamente; pode ter mais de 2 casas). */
    pricePerDay: unitTotal.div(safeDays).toNumber(),
    /**
     * Total do item em centavos (2 casas, ROUND_HALF_UP), calculado em Decimal
     * do começo ao fim e arredondado uma vez: é o valor gravado no orçamento e
     * cobrado pelo provedor.
     */
    total: roundToCents(unitTotal.times(quantity)).toNumber(),
    pricingConfig,
    appliedPeriod: PERIOD_LABELS[pricingConfig.period] ?? 'diaria',
  }
}
