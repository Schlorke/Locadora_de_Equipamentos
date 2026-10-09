import Decimal from 'decimal.js'

/** Valor monetário vindo do banco (Decimal do Prisma), de JSON (string) ou de testes (number). */
export type MoneyValue = string | number | { toString(): string }

/** O provedor de cobrança (Asaas) cobra em centavos: 2 casas decimais. */
const CENT_PLACES = 2

/**
 * Valor em centavos: 2 casas com ROUND_HALF_UP, a mesma regra do provedor. A
 * entrada passa por `String` (nunca por aritmética de float); valor não finito
 * é recusado.
 */
export function roundToCents(value: MoneyValue): Decimal {
  const amount = new Decimal(String(value))
  if (!amount.isFinite()) throw new RangeError('Valor monetário inválido')
  return amount.toDecimalPlaces(CENT_PLACES, Decimal.ROUND_HALF_UP)
}

/**
 * Saldo da obrigação em centavos: total em centavos menos o total pago em
 * centavos (a soma das cobranças pagas é feita em Decimal e arredondada uma
 * vez, então passar a lista ou a soma já agregada dá o mesmo saldo). É a
 * regra única de saldo e quitação: quem emite a cobrança cobra exatamente este
 * saldo (quando positivo) e quem verifica a quitação exige saldo <= 0. Assim um
 * total fracionário (ex.: 128.5714…) pago pelo valor cobrado (128.57) fica
 * quitado dos dois lados.
 */
export function obligationBalance(
  total: MoneyValue,
  paidAmounts: ReadonlyArray<MoneyValue>
): Decimal {
  const paid = paidAmounts.reduce<Decimal>(
    (sum, amount) => sum.plus(new Decimal(String(amount))),
    new Decimal(0)
  )
  return roundToCents(total).minus(roundToCents(paid))
}
