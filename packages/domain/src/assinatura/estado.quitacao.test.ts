import { describe, expect, it } from 'vitest'
import { derivarEstado, transicaoPermitida } from './estado'
import type { FatosDaAssinatura, FaturaDaAssinatura } from './estado'

/**
 * Quitação de dívida sem cobrança aberta (ADR de assinatura, B.5, decisões
 * padrão): chargeback e estorno involuntário deixam de ser dívida quando uma
 * fatura ADJUSTMENT vinculada é paga (`settlesInvoiceId`) ou quando a equipe
 * perdoa (`debtWaivedAt`).
 */

function emSaoPaulo(dia: string, hora = '12:00:00'): Date {
  return new Date(`${dia}T${hora}-03:00`)
}

function fatura(
  parcial: Partial<FaturaDaAssinatura> & { id: string }
): FaturaDaAssinatura {
  return {
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '149.90',
    dueDate: '2026-10-05',
    periodEnd: null,
    paidAt: null,
    chargebackAt: null,
    voluntaryRefund: false,
    settlesInvoiceId: null,
    debtWaivedAt: null,
    ...parcial,
  }
}

function fatos(parcial: Partial<FatosDaAssinatura> = {}): FatosDaAssinatura {
  return {
    billingMode: 'ASAAS',
    createdAt: emSaoPaulo('2026-08-01'),
    complimentaryUntil: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    invoices: [],
    ...parcial,
  }
}

/** Setembro pago e contestado em 01/10. */
const setembroContestada = fatura({
  id: 'set',
  status: 'CHARGEBACK',
  dueDate: '2026-09-05',
  paidAt: emSaoPaulo('2026-09-05'),
  chargebackAt: emSaoPaulo('2026-10-01'),
})
const outubroPaga = fatura({
  id: 'out',
  status: 'PAID',
  dueDate: '2026-10-05',
  paidAt: emSaoPaulo('2026-10-05'),
})
/** Ajuste emitido para quitar o chargeback de setembro. */
const ajuste = fatura({
  id: 'adj',
  kind: 'ADJUSTMENT',
  dueDate: '2026-10-03',
  settlesInvoiceId: 'set',
})
const ajustePago = {
  ...ajuste,
  status: 'PAID' as const,
  paidAt: emSaoPaulo('2026-10-03'),
}

describe('quitação de chargeback por fatura de ajuste', () => {
  it('ajuste vinculado e pago zera o atraso do chargeback: ACTIVE e nenhum encerramento', () => {
    const quitada = fatos({
      invoices: [setembroContestada, ajustePago, outubroPaga],
    })
    for (const dia of ['2026-10-03', '2026-10-08', '2026-11-06']) {
      expect(derivarEstado(quitada, emSaoPaulo(dia))).toMatchObject({
        estado: 'ACTIVE',
        regra: 'FATURA_PAGA',
        encerramentoDevido: null,
        divida: null,
      })
    }
  })

  it('PAST_DUE → ACTIVE quando o ajuste é pago, e a transição é permitida', () => {
    const antes = derivarEstado(
      fatos({ invoices: [setembroContestada, ajuste, outubroPaga] }),
      emSaoPaulo('2026-10-02')
    )
    expect(antes).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-01', diasEmAtraso: 2, faturas: ['set'] },
    })
    expect(antes.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
    const depois = derivarEstado(
      fatos({ invoices: [setembroContestada, ajustePago, outubroPaga] }),
      emSaoPaulo('2026-10-03')
    )
    expect(depois.estado).toBe('ACTIVE')
    expect(transicaoPermitida(antes.estado, depois.estado)).toBe(true)
  })

  it('ajuste vencido e não pago não conta o valor em dobro nem muda o início do atraso', () => {
    const vencido = { ...ajuste, status: 'OVERDUE' as const }
    const resultado = derivarEstado(
      fatos({ invoices: [setembroContestada, vencido, outubroPaga] }),
      emSaoPaulo('2026-10-05')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-01', diasEmAtraso: 5 },
    })
    expect([...(resultado.divida?.faturas ?? [])].sort()).toEqual([
      'adj',
      'set',
    ])
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
  })

  it('ajuste pago menor que a fatura contestada abate o valor e mantém a dívida; o segundo ajuste quita', () => {
    const parcial = { ...ajustePago, amount: '100.00' }
    const resto = fatura({
      id: 'adj-2',
      kind: 'ADJUSTMENT',
      status: 'PAID',
      amount: '49.90',
      dueDate: '2026-10-04',
      paidAt: emSaoPaulo('2026-10-04'),
      settlesInvoiceId: 'set',
    })
    const abatida = derivarEstado(
      fatos({ invoices: [setembroContestada, parcial, outubroPaga] }),
      emSaoPaulo('2026-10-04')
    )
    expect(abatida).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-01', faturas: ['set'] },
    })
    expect(abatida.divida?.valorEmAberto.toFixed(2)).toBe('49.90')
    expect(
      derivarEstado(
        fatos({ invoices: [setembroContestada, parcial, resto, outubroPaga] }),
        emSaoPaulo('2026-10-04')
      )
    ).toMatchObject({ estado: 'ACTIVE', divida: null })
  })

  it('só ajuste PAID, do tipo ADJUSTMENT e vinculado à própria fatura quita', () => {
    const agora = emSaoPaulo('2026-10-10')
    const naoQuitam: FaturaDaAssinatura[] = [
      ajuste,
      { ...ajuste, status: 'CANCELED' },
      { ...ajustePago, kind: 'CYCLE' },
      { ...ajustePago, settlesInvoiceId: 'outra' },
      { ...ajustePago, status: 'REFUNDED', voluntaryRefund: true },
    ]
    for (const tentativa of naoQuitam) {
      expect(
        derivarEstado(
          fatos({ invoices: [setembroContestada, tentativa, outubroPaga] }),
          agora
        ).divida?.desde
      ).toBe('2026-10-01')
    }
  })

  it('ajuste pago vinculado a fatura só vencida não a quita: a vencida se paga pela própria cobrança', () => {
    const outubroVencida = fatura({
      id: 'out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
    })
    const setembroPaga = fatura({
      id: 'set',
      status: 'PAID',
      dueDate: '2026-09-05',
      paidAt: emSaoPaulo('2026-09-05'),
    })
    const vinculado = { ...ajustePago, settlesInvoiceId: 'out' }
    expect(
      derivarEstado(
        fatos({ invoices: [setembroPaga, outubroVencida, vinculado] }),
        emSaoPaulo('2026-10-08')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-06', faturas: ['out'] },
    })
  })

  it('ajuste que quitou e depois foi contestado devolve a dívida da fatura original', () => {
    const ajusteContestado = {
      ...ajustePago,
      status: 'CHARGEBACK' as const,
      chargebackAt: emSaoPaulo('2026-10-20'),
    }
    const resultado = derivarEstado(
      fatos({ invoices: [setembroContestada, ajusteContestado, outubroPaga] }),
      emSaoPaulo('2026-10-20')
    )
    expect(resultado).toMatchObject({
      estado: 'SUSPENDED',
      divida: { desde: '2026-10-01', diasEmAtraso: 20 },
    })
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
  })
})

describe('perdão explícito da equipe', () => {
  it('chargeback perdoado deixa de ser dívida', () => {
    const perdoada = {
      ...setembroContestada,
      debtWaivedAt: emSaoPaulo('2026-10-04'),
    }
    expect(
      derivarEstado(
        fatos({ invoices: [perdoada, outubroPaga] }),
        emSaoPaulo('2026-11-06')
      )
    ).toMatchObject({
      estado: 'ACTIVE',
      encerramentoDevido: null,
      divida: null,
    })
  })

  it('estorno involuntário perdoado deixa de ser dívida', () => {
    const estornada = fatura({
      id: 'set',
      status: 'REFUNDED',
      dueDate: '2026-09-05',
      paidAt: emSaoPaulo('2026-09-05'),
    })
    const agora = emSaoPaulo('2026-09-20')
    expect(derivarEstado(fatos({ invoices: [estornada] }), agora).estado).toBe(
      'SUSPENDED'
    )
    expect(
      derivarEstado(
        fatos({
          invoices: [{ ...estornada, debtWaivedAt: emSaoPaulo('2026-09-20') }],
        }),
        agora
      )
    ).toMatchObject({ estado: 'ACTIVE', divida: null })
  })

  it('o único ciclo, contestado e quitado, conta como pago: ACTIVE, e não INCOMPLETE', () => {
    const agora = emSaoPaulo('2026-10-10')
    const perdoada = {
      ...setembroContestada,
      debtWaivedAt: emSaoPaulo('2026-10-09'),
    }
    expect(derivarEstado(fatos({ invoices: [perdoada] }), agora)).toMatchObject(
      { estado: 'ACTIVE', regra: 'FATURA_PAGA' }
    )
    expect(
      derivarEstado(
        fatos({ invoices: [setembroContestada, ajustePago] }),
        agora
      )
    ).toMatchObject({ estado: 'ACTIVE', regra: 'FATURA_PAGA' })
  })

  it('perdão numa fatura só vencida não a quita: a vencida é cancelada no provedor', () => {
    const setembroPaga = fatura({
      id: 'set',
      status: 'PAID',
      dueDate: '2026-09-05',
      paidAt: emSaoPaulo('2026-09-05'),
    })
    const vencidaPerdoada = fatura({
      id: 'out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
      debtWaivedAt: emSaoPaulo('2026-10-07'),
    })
    expect(
      derivarEstado(
        fatos({ invoices: [setembroPaga, vencidaPerdoada] }),
        emSaoPaulo('2026-10-08')
      ).divida?.faturas
    ).toEqual(['out'])
  })
})
