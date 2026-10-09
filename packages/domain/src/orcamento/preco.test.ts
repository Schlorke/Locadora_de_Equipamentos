import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { buildQuotePricing } from './preco'

/** Valor semanal direto de R$ 100: 9 dias = 1 semana + 2 dias a 100/7. */
const weeklyDirect = {
  pricePerDay: 20,
  weeklyUseDirectValue: true,
  weeklyDirectValue: 100,
}

describe('buildQuotePricing', () => {
  it('grava o total do item em centavos, não o float do cálculo (128.5714… → 128.57)', () => {
    const pricing = buildQuotePricing(weeklyDirect, 9, 1)
    expect(pricing.appliedPeriod).toBe('semanal')
    expect(pricing.total).toBe(128.57)
    expect(
      new Decimal(String(pricing.total)).decimalPlaces()
    ).toBeLessThanOrEqual(2)
  })

  it('multiplica pela quantidade em Decimal antes de arredondar', () => {
    // 2 · 128.571428… = 257.142857… → 257.14
    expect(buildQuotePricing(weeklyDirect, 9, 2).total).toBe(257.14)
    // 10% de desconto sobre 3 · 33.33 = 89.991 → 89.99
    expect(
      buildQuotePricing({ pricePerDay: 33.33, dailyDiscount: 10 }, 3, 1).total
    ).toBe(89.99)
  })

  it('meio centavo exato sobe (ROUND_HALF_UP sobre o Decimal, não sobre o float)', () => {
    // 50.05 · 1 dia − 10% = 45.045 exatos (o float dá 45.044999…) → 45.05
    expect(
      buildQuotePricing({ pricePerDay: '50.05', dailyDiscount: 10 }, 1, 1).total
    ).toBe(45.05)
    // 1.13 · 5 dias − 10% = 5.085 exatos (o float dá 5.0849…) → 5.09
    expect(
      buildQuotePricing({ pricePerDay: 1.13, dailyDiscount: 10 }, 5, 1).total
    ).toBe(5.09)
  })

  it('valor direto: mês completo mais a fração diária, sem o erro do float', () => {
    // 1 mês (50.05) + 15 dias a 50.05/30 = 75.075 exatos (o float dá 75.07499…) → 75.08
    expect(
      buildQuotePricing(
        {
          pricePerDay: 2,
          monthlyUseDirectValue: true,
          monthlyDirectValue: '50.05',
        },
        45,
        1
      ).total
    ).toBe(75.08)
  })
})
