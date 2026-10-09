import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { buildQuotePricing } from '../orcamento/preco'
import { calculateIntelligentPrice, type PricingFields } from './preco'

/** Valor exato em centavos, calculado aqui de forma independente (Decimal, ROUND_HALF_UP). */
const cents = (value: Decimal) =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()

type Period = 'daily' | 'weekly' | 'biweekly' | 'monthly'
const periodOf = (days: number): [Period, number] =>
  days >= 30
    ? ['monthly', 30]
    : days >= 15
      ? ['biweekly', 15]
      : days >= 7
        ? ['weekly', 7]
        : ['daily', 1]

describe('calculateIntelligentPrice: o preço que a tela mostra é o que o orçamento grava e cobra', () => {
  it('meio centavo exato sobe (Decimal, ROUND_HALF_UP), não cai pelo float', () => {
    // 50,05 · 1 dia − 10% = 45,045 exatos; o float dava 45,044999… e a tela mostrava R$ 45,04.
    expect(
      calculateIntelligentPrice({ pricePerDay: 50.05, dailyDiscount: 10 }, 1)
    ).toBe(45.05)
    // 1,13 · 5 dias − 10% = 5,085 exatos; o float dava 5,0849… (tela R$ 5,08).
    expect(
      calculateIntelligentPrice({ pricePerDay: 1.13, dailyDiscount: 10 }, 5)
    ).toBe(5.09)
    // Mês direto de 50,05 por 45 dias = 75,075 exatos; o float dava 75,0749….
    expect(
      calculateIntelligentPrice(
        {
          pricePerDay: 2,
          monthlyUseDirectValue: true,
          monthlyDirectValue: 50.05,
        },
        45
      )
    ).toBe(75.08)
  })

  it('o total do item com quantidade arredonda preço · quantidade uma vez só, igual ao servidor', () => {
    // 3 · 45,045 = 135,135 → 135,14 (arredondar a unidade antes daria 3 · 45,05 = 135,15).
    const cart: PricingFields = { pricePerDay: 50.05, dailyDiscount: 10 }
    expect(buildQuotePricing(cart, 1, 3).total).toBe(135.14)
    expect(buildQuotePricing({ pricePerDay: '50.05', dailyDiscount: 10 }, 1, 3).total).toBe(135.14)
  })

  it('grade com desconto: tela (números do carrinho) = orçamento (texto do Prisma) = cálculo exato', () => {
    const wrong: string[] = []
    for (let price = 5000; price <= 7000; price += 5) {
      const exactPrice = new Decimal(price).div(100)
      for (let days = 1; days <= 30; days += 1) {
        const [period] = periodOf(days)
        for (const discount of [5, 10, 15, 20]) {
          const cart = {
            pricePerDay: exactPrice.toNumber(),
            [period + 'Discount']: discount,
          } as PricingFields
          const stored = {
            pricePerDay: exactPrice.toFixed(2),
            [period + 'Discount']: discount,
          } as Parameters<typeof buildQuotePricing>[0]
          const base = exactPrice.times(days)
          const unit = base.minus(base.times(discount).div(100))
          if (calculateIntelligentPrice(cart, days) !== cents(unit))
            wrong.push(`${exactPrice} ${days}d ${discount}%: tela ${calculateIntelligentPrice(cart, days)}`)
          for (const quantity of [1, 3]) {
            const expected = cents(unit.times(quantity))
            const screen = buildQuotePricing(cart, days, quantity).total
            const server = buildQuotePricing(stored, days, quantity).total
            if (screen !== expected || server !== expected)
              wrong.push(`${exactPrice} ${days}d ${discount}% x${quantity}: tela ${screen}, servidor ${server}, exato ${expected}`)
          }
        }
      }
    }
    expect(wrong.slice(0, 10)).toEqual([])
  })

  it('grade com valor direto: tela = orçamento = valor · dias / período, sem o erro do float', () => {
    const wrong: string[] = []
    for (let value = 1000; value <= 6000; value += 5) {
      const direct = new Decimal(value).div(100)
      for (let days = 1; days <= 60; days += 1) {
        const [period, multiplier] = periodOf(days)
        const cart = {
          pricePerDay: 1,
          [period + 'UseDirectValue']: true,
          [period + 'DirectValue']: direct.toNumber(),
        } as PricingFields
        const stored = {
          pricePerDay: '1.00',
          [period + 'UseDirectValue']: true,
          [period + 'DirectValue']: direct.toFixed(2),
        } as Parameters<typeof buildQuotePricing>[0]
        const unit = direct.times(days).div(multiplier)
        const screen = calculateIntelligentPrice(cart, days)
        const server = buildQuotePricing(stored, days, 1).total
        if (screen !== cents(unit) || server !== cents(unit))
          wrong.push(`${direct} ${days}d: tela ${screen}, servidor ${server}, exato ${cents(unit)}`)
      }
    }
    expect(wrong.slice(0, 10)).toEqual([])
  })

  it('dias inválidos não quebram a tela: valem 0', () => {
    expect(calculateIntelligentPrice({ pricePerDay: 50 }, Number.NaN)).toBe(0)
    expect(calculateIntelligentPrice({ pricePerDay: 50 }, -3)).toBe(0)
  })
})
