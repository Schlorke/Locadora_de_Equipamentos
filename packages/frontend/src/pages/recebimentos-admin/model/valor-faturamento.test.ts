import { describe, expect, it } from 'vitest'
import { valorDigitado, valorFormatado } from './valor-faturamento'

describe('monthly income typed by the owner', () => {
  it.each([
    [0, '0.00'],
    [0.1, '0.10'],
    [12345.67, '12345.67'],
    [98765.43, '98765.43'],
    [1234567890.12, '1234567890.12'],
    [9999999999.99, '9999999999.99'],
    // What the currency field reports for 999999999999 typed digits, divided by 100 as a number.
    [999999999999 / 100, '9999999999.99'],
    [0.1 + 0.2, '0.30'],
  ])('%s becomes the exact contract string %s', (value, text) => {
    expect(valorDigitado(value)).toBe(text)
  })

  it.each([10000000000, 1e21, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '%s is not a valid Decimal(12, 2) value',
    (value) => {
      expect(valorDigitado(value)).toBe('invalid')
    }
  )

  it('formats the contract string for the summary without converting it to a number', () => {
    expect(valorFormatado('98765.43')).toBe('R$ 98.765,43')
    expect(valorFormatado('0.00')).toBe('R$ 0,00')
    expect(valorFormatado('9999999999.99')).toBe('R$ 9.999.999.999,99')
  })
})
