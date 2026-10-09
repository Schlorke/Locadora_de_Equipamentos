import { expect, it } from 'vitest'
import { subscriptionDate, subscriptionMoney } from './display'
it.each([
  ['199.90', 'R$ 199,90'],
  ['9999999999.99', 'R$ 9.999.999.999,99'],
  ['0.00', 'R$ 0,00'],
])('conserva os centavos de %s', (value, label) =>
  expect(subscriptionMoney(value!)).toBe(label)
)
it('dia civil nunca muda com o fuso do dispositivo', () => {
  expect(subscriptionDate('2026-10-01')).toBe('01/10/2026')
  expect(subscriptionDate(null)).toBe('Não informado')
})
