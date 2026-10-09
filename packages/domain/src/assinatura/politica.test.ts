import { describe, expect, it } from 'vitest'
import { POLITICA_COMERCIAL_PADRAO, validarPolitica } from './politica'

describe('política de cobrança', () => {
  it('o padrão é 7 dias de tolerância, 30 de pausa e 30 para abandono, e não pode ser alterado', () => {
    expect(POLITICA_COMERCIAL_PADRAO).toEqual({
      graceDays: 7,
      suspendDays: 30,
      incompleteDays: 30,
    })
    expect(Object.isFrozen(POLITICA_COMERCIAL_PADRAO)).toBe(true)
    expect(validarPolitica(POLITICA_COMERCIAL_PADRAO)).toBe(
      POLITICA_COMERCIAL_PADRAO
    )
  })

  it('aceita os extremos das CHECK de plan_versions', () => {
    expect(() =>
      validarPolitica({ graceDays: 0, suspendDays: 7, incompleteDays: 1 })
    ).not.toThrow()
    expect(() =>
      validarPolitica({ graceDays: 15, suspendDays: 90, incompleteDays: 365 })
    ).not.toThrow()
  })

  it.each([
    [{ graceDays: -1, suspendDays: 30, incompleteDays: 30 }, 'graceDays'],
    [{ graceDays: 16, suspendDays: 30, incompleteDays: 30 }, 'graceDays'],
    [{ graceDays: 7, suspendDays: 6, incompleteDays: 30 }, 'suspendDays'],
    [{ graceDays: 7, suspendDays: 91, incompleteDays: 30 }, 'suspendDays'],
    [{ graceDays: 7, suspendDays: 30, incompleteDays: 0 }, 'incompleteDays'],
    [{ graceDays: 7, suspendDays: 30.5, incompleteDays: 30 }, 'suspendDays'],
  ])('recusa %o (%s)', (politica, campo) => {
    expect(() => validarPolitica(politica)).toThrow(new RegExp(`^${campo}`))
  })
})
