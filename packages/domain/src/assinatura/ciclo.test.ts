import { expect, it } from 'vitest'
import { periodoMensal } from './ciclo'
it.each([
  ['2026-01-31', '2026-02-27'],
  ['2028-01-31', '2028-02-28'],
  ['2026-12-03', '2027-01-02'],
  ['2026-02-28', '2026-03-27'],
])('monthly civil cycle from %s ends on %s', (start, end) => {
  expect(periodoMensal(start)).toEqual({ periodStart: start, periodEnd: end })
})
it('rejects corrected or invalid dates', () => {
  expect(() => periodoMensal('2026-02-31')).toThrow()
})
