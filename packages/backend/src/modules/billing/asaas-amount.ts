import { Prisma } from '@prisma/client'
import { BillingProviderError } from './asaas-http'

/**
 * Dinheiro no módulo de cobrança (ADR SaaS D21 e B.6): sempre `Prisma.Decimal` (decimal.js).
 * `number` só existe na borda HTTP do Asaas — `toAsaasAmount` ao enviar e `fromAsaasAmount` ao
 * receber — e nenhuma comparação de valor usa `number`.
 */
export type Money = Prisma.Decimal
/**
 * Entrada aceita na borda do módulo. `number` continua aceito só por compatibilidade com chamadores
 * que ainda convertem o Decimal do Prisma; prefira passar o `Prisma.Decimal` (ou a string decimal).
 */
export type MoneyInput = Prisma.Decimal | string | number

const ASAAS_SCALE = 2
const DECIMAL_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

function invalidAmount(): never {
  throw new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' })
}

function invalidRemoteAmount(): never {
  throw new BillingProviderError('INVALID_RESPONSE', { reason: 'UNEXPECTED_SHAPE' })
}

/** Converte a entrada em Decimal finito; texto e número passam por `String`, nunca por aritmética. */
export function toMoney(value: MoneyInput): Money {
  let text: string
  if (value instanceof Prisma.Decimal) {
    if (!value.isFinite()) invalidAmount()
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalidAmount()
    text = String(value)
  } else if (typeof value === 'string') {
    text = value.trim()
  } else if (value !== null && typeof value === 'object') {
    // Outra instância de decimal.js (ex.: `import Decimal from 'decimal.js'`).
    text = String(value)
  } else {
    return invalidAmount()
  }
  if (!DECIMAL_TEXT.test(text)) invalidAmount()
  const amount = new Prisma.Decimal(text)
  if (!amount.isFinite()) invalidAmount()
  return amount
}

/**
 * Valor enviado ao Asaas: `Number(d.toFixed(2))`. Recusa mais de 2 casas decimais, valor negativo
 * e qualquer valor que o `number` não represente exatamente.
 */
export function toAsaasAmount(amount: Money): number {
  const decimal = toMoney(amount)
  if (decimal.isNegative() && !decimal.isZero()) invalidAmount()
  if (decimal.decimalPlaces() > ASAAS_SCALE) invalidAmount()
  const value = Number(decimal.toFixed(ASAAS_SCALE))
  if (!Number.isFinite(value) || !new Prisma.Decimal(String(value)).equals(decimal)) invalidAmount()
  return value
}

/** Valor devolvido pelo Asaas (número JSON) como Decimal; mais de 2 casas não é valor monetário do Asaas. */
export function fromAsaasAmount(value: unknown): Money {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidRemoteAmount()
  const amount = new Prisma.Decimal(String(value))
  if (amount.decimalPlaces() > ASAAS_SCALE) invalidRemoteAmount()
  return amount
}

/**
 * Compara o valor remoto com o esperado em Decimal, com 2 casas: `new Decimal(String(remote))`
 * contra `expected`. Qualquer valor inválido, ou com mais de 2 casas, não confere.
 */
export function sameAmount(remote: unknown, expected: MoneyInput): boolean {
  let actual: Money
  let wanted: Money
  try {
    actual = typeof remote === 'number' ? fromAsaasAmount(remote) : toMoney(remote as MoneyInput)
    wanted = toMoney(expected)
  } catch {
    return false
  }
  if (actual.decimalPlaces() > ASAAS_SCALE || wanted.decimalPlaces() > ASAAS_SCALE) return false
  return actual.toFixed(ASAAS_SCALE) === wanted.toFixed(ASAAS_SCALE)
}
