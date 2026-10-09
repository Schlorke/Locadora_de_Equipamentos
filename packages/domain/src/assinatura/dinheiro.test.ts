import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { paraDecimal } from './dinheiro'

describe('paraDecimal', () => {
  it('aceita Decimal e string decimal sem perder centavos', () => {
    expect(paraDecimal('0.1').plus(paraDecimal('0.2')).toFixed(2)).toBe('0.30')
    expect(paraDecimal(new Decimal('199.90')).toFixed(2)).toBe('199.90')
  })

  it('recusa number, texto não decimal e valores infinitos ou NaN', () => {
    expect(() => paraDecimal(0.1 as unknown as string)).toThrow(TypeError)
    expect(() => paraDecimal('R$ 10')).toThrow()
    expect(() => paraDecimal('Infinity')).toThrow(RangeError)
    expect(() => paraDecimal('NaN')).toThrow(RangeError)
  })
})
