import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { obligationBalance, roundToCents } from './saldo'

/** 100 por semana (valor direto) em 9 dias: 100 + 2 · 100/7 no float do cálculo de preço. */
const FRACTIONAL_TOTAL = 100 + (2 * 100) / 7

describe('roundToCents', () => {
  it('arredonda a centavos com ROUND_HALF_UP, como o provedor cobra', () => {
    expect(FRACTIONAL_TOTAL).toBe(128.57142857142858)
    expect(roundToCents(FRACTIONAL_TOTAL).toFixed()).toBe('128.57')
    expect(roundToCents('0.125').toFixed()).toBe('0.13')
    expect(roundToCents('0.135').toFixed()).toBe('0.14')
    expect(roundToCents('-0.125').toFixed()).toBe('-0.13')
    expect(roundToCents('21.428571428571427').toFixed()).toBe('21.43')
    expect(
      roundToCents(new Decimal('128.571428571428571428571428571')).toFixed()
    ).toBe('128.57')
  })

  it('não depende da configuração global de arredondamento do decimal.js', () => {
    const previous = Decimal.rounding
    Decimal.set({ rounding: Decimal.ROUND_DOWN })
    try {
      expect(roundToCents('0.125').toFixed()).toBe('0.13')
    } finally {
      Decimal.set({ rounding: previous })
    }
  })

  it('recusa valor não finito', () => {
    expect(() => roundToCents(Number.NaN)).toThrow(RangeError)
    expect(() => roundToCents('Infinity')).toThrow(RangeError)
  })
})

describe('obligationBalance', () => {
  it('um total fracionário pago pelo valor cobrado (saldo em centavos) fica quitado', () => {
    const charged = obligationBalance(FRACTIONAL_TOTAL, [])
    expect(charged.toFixed()).toBe('128.57')
    expect(
      obligationBalance(FRACTIONAL_TOTAL, [charged.toFixed()]).toFixed()
    ).toBe('0')
  })

  it('cobra o restante em centavos e nunca um resíduo abaixo de um centavo', () => {
    expect(obligationBalance('128.5714285714', ['100']).toFixed()).toBe('28.57')
    expect(obligationBalance('128.5714285714', ['128.56']).toFixed()).toBe(
      '0.01'
    )
    expect(obligationBalance('30', ['10', '20']).toFixed()).toBe('0')
    expect(obligationBalance('30', ['29.99']).toFixed()).toBe('0.01')
  })

  it('pagamentos legados fora de centavos contam pelo valor em centavos', () => {
    expect(
      obligationBalance(FRACTIONAL_TOTAL, ['64.285714', '64.285714']).lte(0)
    ).toBe(true)
  })
})
