import Decimal from 'decimal.js'

/**
 * Dinheiro da assinatura: `Decimal` ou string decimal ("199.90"). `number` é
 * recusado no tipo e em tempo de execução (ADR de assinatura, D21): vira
 * `number` só na borda HTTP.
 */
export type Dinheiro = Decimal | string

export function paraDecimal(valor: Dinheiro): Decimal {
  if (typeof valor === 'number') {
    throw new TypeError(
      'Dinheiro não pode chegar como number; use Decimal ou string decimal.'
    )
  }
  const decimal = new Decimal(valor)
  if (!decimal.isFinite()) {
    throw new RangeError(`Valor monetário inválido: "${String(valor)}".`)
  }
  return decimal
}
