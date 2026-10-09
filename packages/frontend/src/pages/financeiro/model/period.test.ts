import { expect, it } from 'vitest'
import { generatePeriodOptions, getPeriodDateRange } from './period'
it('mantém todos mais treze meses e limites locais inclusivos', () => {
  const options = generatePeriodOptions()
  expect(options).toHaveLength(14)
  expect(options[0]).toEqual({ value: 'all', label: 'Todos os períodos' })
  expect(getPeriodDateRange('all')).toEqual({ startDate: null, endDate: null })
  expect(getPeriodDateRange('2032-02')).toEqual({
    startDate: new Date(2032, 1, 1).toISOString(),
    endDate: new Date(2032, 2, 0, 23, 59, 59, 999).toISOString(),
  })
})
