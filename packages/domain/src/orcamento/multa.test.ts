import { describe, expect, it } from 'vitest'
import { calculateLateFee } from './multa'

const end = new Date('2026-01-01T00:00:00.000Z')
const threeDaysLater = new Date('2026-01-04T00:00:00.000Z')

describe('calculateLateFee', () => {
  it('aplica o mínimo de 50 quando um dia de atraso calcula 20', () => {
    const result = calculateLateFee(
      1000,
      end,
      new Date('2026-01-02T00:00:00.000Z'),
      { dailyRate: 0.02, minAmount: 50, maxAmount: 500 }
    )

    expect(result.daysLate).toBe(1)
    expect(result.fee.toNumber()).toBe(50)
  })

  it('aplica o máximo de 500 quando trinta dias de atraso calculam 600', () => {
    const result = calculateLateFee(
      1000,
      end,
      new Date('2026-01-31T00:00:00.000Z'),
      { dailyRate: 0.02, minAmount: 50, maxAmount: 500 }
    )

    expect(result.daysLate).toBe(30)
    expect(result.fee.toNumber()).toBe(500)
  })

  it('devolve a multa em centavos: 128.57 · 2% · 3 dias = 7.71', () => {
    const result = calculateLateFee(128.57, end, threeDaysLater)
    // 7.7142 sem arredondar não é cobrável pelo provedor.
    expect(result.fee.toFixed()).toBe('7.71')
    expect(result.daysLate).toBe(3)
  })

  it('arredonda meio centavo para cima (ROUND_HALF_UP)', () => {
    // 0.25 · 50% · 1 dia = 0.125 → 0.13
    const result = calculateLateFee(
      0.25,
      end,
      new Date('2026-01-02T00:00:00.000Z'),
      {
        dailyRate: 0.5,
      }
    )
    expect(result.fee.toFixed()).toBe('0.13')
  })
})
