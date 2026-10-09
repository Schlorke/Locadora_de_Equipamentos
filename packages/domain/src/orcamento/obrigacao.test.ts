import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  planQuoteBaseCharges,
  quoteItemsAndFreight,
  quoteObligation,
  quoteObligationResidual,
  type QuoteBaseCharge,
} from './obrigacao'

describe('quoteObligation', () => {
  it('soma total (itens + frete), reajustes vigentes e a multa aprovada, em centavos', () => {
    expect(
      quoteObligation({
        total: '50',
        adjustments: [{ category: 'LABOR', amount: '10' }],
        lateFee: '7.71',
        lateFeeApproved: true,
      }).toFixed(2)
    ).toBe('67.71')
  })

  it('conta a multa aprovada uma vez só e ignora a multa não aprovada', () => {
    const approved = { total: 30, lateFee: 10, lateFeeApproved: true }
    expect(quoteObligation(approved).toFixed(2)).toBe('40.00')
    // Calcular de novo sobre o mesmo estado (retry, clique duplo) não soma outra vez.
    expect(quoteObligation(approved).toFixed(2)).toBe('40.00')
    expect(
      quoteObligation({ ...approved, lateFeeApproved: false }).toFixed(2)
    ).toBe('30.00')
    expect(
      quoteObligation({
        total: 30,
        lateFee: null,
        lateFeeApproved: true,
      }).toFixed(2)
    ).toBe('30.00')
  })

  it('o reajuste de frete (TRAVEL) já está no total: não soma de novo', () => {
    expect(
      quoteObligation({
        total: 33,
        adjustments: [
          { category: 'TRAVEL', amount: 8 },
          { category: 'OTHER', amount: '-2.5' },
        ],
      }).toFixed(2)
    ).toBe('30.50')
  })

  it('arredonda uma vez, com ROUND_HALF_UP, somando em Decimal (nunca float)', () => {
    // 0.1 + 0.2 em float é 0.30000000000000004; em Decimal é 0.3.
    expect(
      quoteObligation({
        total: '0.1',
        adjustments: [{ category: 'LABOR', amount: '0.2' }],
      }).toFixed()
    ).toBe('0.3')
    expect(quoteObligation({ total: '128.5714285' }).toFixed()).toBe('128.57')
    expect(
      quoteObligation({
        total: '10.004',
        adjustments: [{ category: 'LABOR', amount: '0.001' }],
      }).toFixed()
    ).toBe('10.01')
  })

  it('não depende da configuração global de arredondamento do decimal.js', () => {
    const previous = Decimal.rounding
    Decimal.set({ rounding: Decimal.ROUND_DOWN })
    try {
      expect(quoteObligation({ total: '45.045' }).toFixed()).toBe('45.05')
    } finally {
      Decimal.set({ rounding: previous })
    }
  })
})

describe('quoteItemsAndFreight', () => {
  it('é a soma dos itens com entrega e retirada, em centavos', () => {
    expect(
      quoteItemsAndFreight({
        items: [{ total: '30' }, { total: 20 }],
        deliveryFee: '12.5',
        pickupFee: 7.5,
      }).toFixed(2)
    ).toBe('70.00')
    expect(
      quoteItemsAndFreight({
        items: [{ total: 30 }],
        deliveryFee: null,
      }).toFixed(2)
    ).toBe('30.00')
    expect(
      quoteItemsAndFreight({
        items: [{ total: '42.855' }],
        deliveryFee: '0.001',
      }).toFixed()
    ).toBe('42.86')
  })
})

describe('quoteObligationResidual', () => {
  it('é zero sem valor final e em orçamento gravado pela regra única', () => {
    expect(quoteObligationResidual(null, { total: 30 }).toFixed(2)).toBe('0.00')
    expect(
      quoteObligationResidual('40', {
        total: 30,
        lateFee: 10,
        lateFeeApproved: true,
      }).toFixed(2)
    ).toBe('0.00')
  })

  it('mede o valor final legado que a regra não explica (acréscimo ou desconto), em centavos', () => {
    expect(quoteObligationResidual('45.5', { total: 30 }).toFixed(2)).toBe(
      '15.50'
    )
    expect(quoteObligationResidual(25, { total: 30 }).toFixed(2)).toBe('-5.00')
    // Frete trocado pela regra antiga sem atualizar o total (TRAVEL fica fora da soma).
    expect(
      quoteObligationResidual('75', {
        total: 60,
        adjustments: [{ category: 'TRAVEL', amount: 25 }],
      }).toFixed(2)
    ).toBe('15.00')
  })
})

describe('planQuoteBaseCharges', () => {
  const pending = (amount: number, issued = false): QuoteBaseCharge => ({
    status: 'PENDING',
    amount,
    issued,
  })
  const paid = (amount: number, issued = true): QuoteBaseCharge => ({
    status: 'PAID',
    amount,
    issued,
  })
  const plan = (
    obligation: number | string,
    charges: QuoteBaseCharge[],
    repriceable = true
  ) => {
    const result = planQuoteBaseCharges(obligation, charges, { repriceable })
    return result.kind === 'refuse'
      ? ['refuse']
      : result.kind === 'keep'
        ? ['keep', result.balance.toFixed(2)]
        : ['reprice', result.index, result.amount.toFixed(2)]
  }

  it('a única pendente nunca emitida passa a cobrar a obrigação (em centavos)', () => {
    expect(plan('45.505', [pending(30)])).toEqual(['reprice', 0, '45.51'])
    expect(plan(40, [])).toEqual(['keep', '40.00'])
  })

  it('cobrança emitida, vencida ou em outro estado exige conciliação; mais de uma pendente também', () => {
    expect(plan(40, [pending(30, true)])).toEqual(['refuse'])
    expect(
      plan(40, [{ status: 'OVERDUE', amount: 30, issued: false }])
    ).toEqual(['refuse'])
    expect(plan(40, [pending(30), pending(10)])).toEqual(['refuse'])
  })

  it('cobrança paga (emitida ou importada) nunca muda: a obrigação pode crescer e o saldo é cobrado à parte', () => {
    for (const charge of [paid(30), paid(30, false)]) {
      expect(plan(40, [charge])).toEqual(['keep', '10.00'])
      // Voltar ao valor pago quita, sem sinal negativo no zero.
      expect(plan(30, [charge])).toEqual(['keep', '0.00'])
      // Abaixo do que foi pago é estorno: conciliação.
      expect(plan('29.99', [charge])).toEqual(['refuse'])
    }
  })

  it('paga + pendente nunca emitida: a pendente cobra o saldo; saldo zerado com pendente viva é conciliação', () => {
    expect(plan(60, [paid(30), pending(20)])).toEqual(['reprice', 1, '30.00'])
    expect(plan(30, [paid(30), pending(20)])).toEqual(['refuse'])
  })

  it('orçamento convertido (a locação é dona): pendente, mesmo nunca emitida, é conciliação; paga fica', () => {
    expect(plan(40, [pending(30)], false)).toEqual(['refuse'])
    expect(plan(40, [paid(30)], false)).toEqual(['keep', '10.00'])
    expect(plan(40, [], false)).toEqual(['keep', '40.00'])
  })
})
