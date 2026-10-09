import { describe, expect, it } from 'vitest'
import { calculateRentalLateFee } from './multa'

describe('calculateRentalLateFee', () => {
  it('devolve a multa já em centavos: 1000 em 7 dias, 3 dias de atraso = 21.43', () => {
    const result = calculateRentalLateFee({
      total: 1000,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-08T00:00:00.000Z'),
      currentDate: new Date('2026-01-11T00:00:00.000Z'),
    })
    // 1000/7 · 3 · 0.05 = 21.428571… — o provedor cobra 21.43.
    expect(result).toEqual({ lateFee: 21.43, daysOverdue: 3, overdue: true })
  })

  it('arredonda meio centavo para cima (ROUND_HALF_UP)', () => {
    // 0.5 por dia · 5% · 5 dias = 0.125 → 0.13
    const result = calculateRentalLateFee({
      total: '0.5',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-02T00:00:00.000Z'),
      currentDate: new Date('2026-01-07T00:00:00.000Z'),
    })
    expect(result.lateFee).toBe(0.13)
  })
})
