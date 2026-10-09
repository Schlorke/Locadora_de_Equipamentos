import Decimal from 'decimal.js'
import {
  obligationBalance,
  roundToCents,
  type MoneyValue,
} from '../locacao/saldo'

/** Reajuste registrado no orçamento (histórico imutável). */
export type QuoteObligationAdjustment = {
  category: string
  amount: MoneyValue
}

/** Estado do orçamento que define quanto o cliente deve por ele. */
export type QuoteObligationState = {
  /** Total dos itens + frete (`quote.total`). */
  total: MoneyValue
  /** Reajustes vigentes. O de frete (TRAVEL) substitui o frete, que já está no total. */
  adjustments?: ReadonlyArray<QuoteObligationAdjustment>
  /** Multa por atraso calculada; só entra na obrigação quando aprovada. */
  lateFee?: MoneyValue | null
  lateFeeApproved?: boolean | null
}

const money = (value: MoneyValue | null | undefined) =>
  new Decimal(String(value ?? 0))

/**
 * Valor da obrigação do orçamento, em centavos (ROUND_HALF_UP, somado em
 * Decimal e arredondado uma vez): total dos itens + frete, mais os reajustes
 * vigentes, mais a multa aprovada (uma vez só). É a regra única: toda edição
 * que mexe no valor (itens, datas, frete, valor final manual, multa, reajuste)
 * recalcula a obrigação por aqui, a partir do estado atual — nunca somando
 * sobre um valor final que já contém a multa ou sobre um total antigo.
 */
export function quoteObligation(state: QuoteObligationState): Decimal {
  let sum = money(state.total)
  for (const adjustment of state.adjustments ?? [])
    if (adjustment.category !== 'TRAVEL')
      sum = sum.plus(money(adjustment.amount))
  if (state.lateFeeApproved === true) sum = sum.plus(money(state.lateFee))
  return roundToCents(sum)
}

/**
 * Quanto do valor final gravado (`finalTotal`) a regra única não explica a
 * partir de `state`, em centavos. É zero em todo orçamento gravado pela regra
 * única e sem valor final; só um valor final legado (manual sem reajuste
 * registrado, frete trocado sem atualizar o total, multa somada pela regra
 * antiga) deixa diferença. Quem edita registra essa diferença como reajuste
 * vigente antes de recalcular: o valor que o cliente deve nunca muda em
 * silêncio, só pelo que a própria edição mexe. Sem valor final a obrigação é o
 * `total`, que a edição recompõe (itens + frete): não há o que preservar.
 */
export function quoteObligationResidual(
  finalTotal: MoneyValue | null | undefined,
  state: QuoteObligationState
): Decimal {
  if (finalTotal === null || finalTotal === undefined) return new Decimal(0)
  return roundToCents(finalTotal).minus(quoteObligation(state))
}

/** Cobrança base viva (RENTAL/DEPOSIT, fora CANCELLED/REFUNDED) da obrigação. */
export type QuoteBaseCharge = {
  status: string
  amount: MoneyValue
  /** Já foi ao provedor: `transactionId`, `boletoIssuedAt`, `pixCode` ou tentativa. */
  issued: boolean
}

/**
 * Como as cobranças base acompanham uma nova obrigação:
 * - `refuse`: exige conciliação (409) — cobrança emitida ou vencida (o valor de
 *   um boleto/PIX vivo no provedor nunca muda por edição), mais de uma pendente
 *   nunca emitida (não há como dividir o saldo), obrigação abaixo do que já foi
 *   pago (estorno) ou saldo zerado com uma pendente ainda viva;
 * - `reprice`: a única cobrança PENDING nunca emitida (`index`) passa a cobrar o
 *   saldo, em centavos;
 * - `keep`: nada a mudar — cobrança paga nunca muda de valor; o saldo
 *   (obrigação − pago) é cobrado à parte.
 *
 * `repriceable: false` (orçamento convertido: a locação é dona das cobranças)
 * recusa também a pendente nunca emitida.
 */
export function planQuoteBaseCharges(
  obligation: MoneyValue,
  charges: ReadonlyArray<QuoteBaseCharge>,
  options: { repriceable: boolean } = { repriceable: true }
):
  | { kind: 'refuse' }
  | { kind: 'keep'; balance: Decimal }
  | { kind: 'reprice'; index: number; amount: Decimal } {
  const paid = charges.filter((charge) => charge.status === 'PAID')
  const pending = charges.flatMap((charge, index) =>
    charge.status === 'PAID' ? [] : [{ charge, index }]
  )
  if (
    pending.some(
      ({ charge }) => charge.status !== 'PENDING' || charge.issued
    ) ||
    pending.length > 1 ||
    (pending.length === 1 && !options.repriceable)
  )
    return { kind: 'refuse' }
  const balance = obligationBalance(
    obligation,
    paid.map((charge) => charge.amount)
  )
  if (paid.length > 0 && balance.lt(0)) return { kind: 'refuse' }
  const only = pending[0]
  if (!only) return { kind: 'keep', balance }
  if (!balance.gt(0)) return { kind: 'refuse' }
  return { kind: 'reprice', index: only.index, amount: balance }
}

/**
 * Total dos itens + frete (entrega e retirada) em centavos: o `total` do
 * orçamento, base da obrigação.
 */
export function quoteItemsAndFreight(input: {
  items: ReadonlyArray<{ total: MoneyValue }>
  deliveryFee?: MoneyValue | null
  pickupFee?: MoneyValue | null
}): Decimal {
  const items = input.items.reduce<Decimal>(
    (sum, item) => sum.plus(money(item.total)),
    new Decimal(0)
  )
  return roundToCents(
    items.plus(money(input.deliveryFee)).plus(money(input.pickupFee))
  )
}
