import Decimal from 'decimal.js'
import { MoneySchema } from '@gb-locacoes/contracts/entitlements'

/**
 * Monthly income typed by the owner. `null` until the owner types: the currency field shows "R$ 0,00" from the
 * start, so an untouched field is never sent as zero. The field reports a `number`; it becomes the contract string
 * (`"12345.67"`) through `Decimal`, never through float arithmetic. `invalid` beyond `Decimal(12, 2)`.
 */
export type ValorFaturamento = string | null | 'invalid'

export function valorDigitado(value: number): ValorFaturamento {
  if (!Number.isFinite(value) || value < 0) return 'invalid'
  const text = new Decimal(String(value)).toFixed(2)
  return MoneySchema.safeParse(text).success ? text : 'invalid'
}

/** Brazilian currency text of a contract value, for the summary before sending. */
export function valorFormatado(value: string) {
  const [integer, cents] = new Decimal(value).toFixed(2).split('.')
  return 'R$ ' + integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + cents
}
