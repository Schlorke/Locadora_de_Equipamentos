import { describe, expect, it } from 'vitest'
import { derivarEstado, transicaoPermitida } from './estado'
import type { FatosDaAssinatura, FaturaDaAssinatura } from './estado'

/**
 * Fim da cortesia (ADR de assinatura, B.5, decisões padrão): `fimDaCortesia + 1`
 * é o novo ponto de partida de toda contagem. Os dias da cortesia não contam
 * como atraso, mas ela não apaga dívida: fatura vencida, chargeback e estorno
 * involuntário anteriores continuam na dívida, contados a partir do dia
 * seguinte a ela. A locadora só fica ACTIVE se um ciclo pago cobrir os dias
 * seguintes e não houver dívida; sem ciclo pago, segue a régua do fim do teste.
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

const cortesiaAteOutubro = {
  billingMode: 'COMPLIMENTARY',
  complimentaryUntil: '2026-10-31',
} as const

/** Setembro pago antes da cortesia: período de 05/09 a 04/10. */
const setembroPaga = fatura({
  id: 'set',
  status: 'PAID',
  dueDate: '2026-09-05',
  periodEnd: '2026-10-04',
  paidAt: emSaoPaulo('2026-09-05'),
})

describe('fim da cortesia: ciclo pago anterior não mantém ACTIVE', () => {
  it('locadora que pagou antes da cortesia e não pagou depois segue a régua a partir de fimDaCortesia + 1', () => {
    const pagante = fatos({ ...cortesiaAteOutubro, invoices: [setembroPaga] })
    expect(derivarEstado(pagante, emSaoPaulo('2026-10-31'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
    })
    const depois = derivarEstado(pagante, emSaoPaulo('2026-11-01'))
    expect(depois).toMatchObject({
      estado: 'PAST_DUE',
      acesso: 'FULL',
      regra: 'DIVIDA',
      encerramentoDevido: null,
      divida: {
        desde: '2026-11-01',
        diasEmAtraso: 1,
        toleranciaAte: '2026-11-07',
        pausaEm: '2026-11-08',
        encerramentoEm: '2026-12-07',
        faturas: [],
      },
    })
    expect(depois.divida?.valorEmAberto.isZero()).toBe(true)
    expect(derivarEstado(pagante, emSaoPaulo('2026-11-08')).estado).toBe(
      'SUSPENDED'
    )
    expect(
      derivarEstado(pagante, emSaoPaulo('2026-12-06')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(pagante, emSaoPaulo('2026-12-07')).encerramentoDevido
    ).toBe('NON_PAYMENT')
    expect(derivarEstado(pagante, emSaoPaulo('2030-01-01'))).toMatchObject({
      estado: 'SUSPENDED',
      regra: 'DIVIDA',
      encerramentoDevido: 'NON_PAYMENT',
    })
  })

  it('a saída da cortesia sem pagamento é ACTIVE → PAST_DUE, permitida pela tabela', () => {
    const pagante = fatos({ ...cortesiaAteOutubro, invoices: [setembroPaga] })
    const ultimoDia = derivarEstado(pagante, emSaoPaulo('2026-10-31')).estado
    const primeiroDia = derivarEstado(pagante, emSaoPaulo('2026-11-01')).estado
    expect([ultimoDia, primeiroDia]).toEqual(['ACTIVE', 'PAST_DUE'])
    expect(transicaoPermitida(ultimoDia, primeiroDia)).toBe(true)
  })

  it('cortesia desde o cadastro, sem teste nem pagamento, também segue a régua (não fica INCOMPLETE)', () => {
    const cortesia = fatos({
      ...cortesiaAteOutubro,
      createdAt: emSaoPaulo('2026-01-10'),
    })
    expect(derivarEstado(cortesia, emSaoPaulo('2026-11-01'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-01', diasEmAtraso: 1 },
    })
    expect(
      derivarEstado(cortesia, emSaoPaulo('2026-12-06')).encerramentoDevido
    ).toBeNull()
    // Nunca pagou: o motivo é o do fim do teste sem pagamento.
    expect(derivarEstado(cortesia, emSaoPaulo('2026-12-07'))).toMatchObject({
      estado: 'SUSPENDED',
      encerramentoDevido: 'TRIAL_EXPIRED',
    })
  })
})

describe('fim da cortesia: ciclo pago que cobre os dias seguintes', () => {
  it('ciclo pago durante a cortesia cujo período passa do fim dela deixa ACTIVE; a fatura seguinte segue a régua normal', () => {
    const ativacao = fatura({
      id: 'ativ',
      status: 'PAID',
      dueDate: '2026-10-20',
      periodEnd: '2026-11-19',
      paidAt: emSaoPaulo('2026-10-20'),
    })
    const seguinte = fatura({
      id: 'nov',
      dueDate: '2026-11-20',
      periodEnd: '2026-12-19',
    })
    const pagou = fatos({
      ...cortesiaAteOutubro,
      invoices: [setembroPaga, ativacao, seguinte],
    })
    expect(derivarEstado(pagou, emSaoPaulo('2026-11-01'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'FATURA_PAGA',
      divida: null,
    })
    expect(derivarEstado(pagou, emSaoPaulo('2026-11-20')).estado).toBe('ACTIVE')
    expect(derivarEstado(pagou, emSaoPaulo('2026-11-21'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-21', diasEmAtraso: 1, faturas: ['nov'] },
    })
  })

  it('ciclo que só termina no último dia da cortesia não cobre o dia seguinte', () => {
    const ateOFim = fatura({
      id: 'out',
      status: 'PAID',
      dueDate: '2026-10-01',
      periodEnd: '2026-10-31',
      paidAt: emSaoPaulo('2026-10-01'),
    })
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [ateOFim] }),
        emSaoPaulo('2026-11-01')
      )
    ).toMatchObject({ estado: 'PAST_DUE', divida: { desde: '2026-11-01' } })
  })

  it('sem periodEnd vale o vencimento: ciclo com vencimento no último dia da cortesia ou depois cobre os dias seguintes', () => {
    const noUltimoDia = fatura({
      id: 'ult',
      status: 'PAID',
      dueDate: '2026-10-31',
      paidAt: emSaoPaulo('2026-10-30'),
    })
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [noUltimoDia] }),
        emSaoPaulo('2026-11-01')
      )
    ).toMatchObject({ estado: 'ACTIVE', regra: 'FATURA_PAGA' })
    const naVespera = { ...noUltimoDia, dueDate: '2026-10-30' }
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [naVespera] }),
        emSaoPaulo('2026-11-01')
      ).estado
    ).toBe('PAST_DUE')
  })

  it('pagar depois do fim da cortesia um ciclo que começa depois dela volta para ACTIVE', () => {
    const primeira = fatura({
      id: 'nov',
      dueDate: '2026-11-05',
      periodEnd: '2026-12-04',
    })
    const emAberto = fatos({ ...cortesiaAteOutubro, invoices: [primeira] })
    expect(derivarEstado(emAberto, emSaoPaulo('2026-11-03'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-01', diasEmAtraso: 3 },
    })
    const paga = {
      ...primeira,
      status: 'PAID' as const,
      paidAt: emSaoPaulo('2026-11-03'),
    }
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [paga] }),
        emSaoPaulo('2026-11-03')
      )
    ).toMatchObject({ estado: 'ACTIVE', regra: 'FATURA_PAGA', divida: null })
  })
})

describe('fim da cortesia: a dívida anterior continua, com o relógio recomeçando no dia seguinte', () => {
  it('fatura vencida antes do fim da cortesia continua na dívida, mas os dias da cortesia não contam como atraso', () => {
    const outubroVencida = fatura({
      id: 'out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
    })
    const emAtraso = fatos({
      ...cortesiaAteOutubro,
      invoices: [setembroPaga, outubroVencida],
    })
    const primeiroDia = derivarEstado(emAtraso, emSaoPaulo('2026-11-01'))
    expect(primeiroDia).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-01', diasEmAtraso: 1, faturas: ['out'] },
    })
    expect(primeiroDia.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
    expect(derivarEstado(emAtraso, emSaoPaulo('2026-11-11'))).toMatchObject({
      estado: 'SUSPENDED',
      encerramentoDevido: null,
      divida: { diasEmAtraso: 11 },
    })
    expect(
      derivarEstado(emAtraso, emSaoPaulo('2026-12-07')).encerramentoDevido
    ).toBe('NON_PAYMENT')
  })

  it('fatura cujo período passa do fim da cortesia continua na dívida, contada só a partir de fimDaCortesia + 1', () => {
    const outubroVencida = fatura({
      id: 'out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
      periodEnd: '2026-11-04',
    })
    const resultado = derivarEstado(
      fatos({
        ...cortesiaAteOutubro,
        invoices: [setembroPaga, outubroVencida],
      }),
      emSaoPaulo('2026-11-01')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-01', diasEmAtraso: 1, faturas: ['out'] },
    })
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
  })

  it('chargeback durante a cortesia de ciclo que cobre os dias seguintes conta de fimDaCortesia + 1; chargeback depois dela conta do dia dele', () => {
    const ativacao = fatura({
      id: 'ativ',
      status: 'CHARGEBACK',
      dueDate: '2026-10-20',
      periodEnd: '2026-11-19',
      paidAt: emSaoPaulo('2026-10-20'),
      chargebackAt: emSaoPaulo('2026-10-25'),
    })
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [ativacao] }),
        emSaoPaulo('2026-11-01')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-01', diasEmAtraso: 1, faturas: ['ativ'] },
    })
    const depois = { ...ativacao, chargebackAt: emSaoPaulo('2026-11-10') }
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [depois] }),
        emSaoPaulo('2026-11-10')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-10', diasEmAtraso: 1, faturas: ['ativ'] },
    })
  })

  it('chargeback depois do fim da cortesia de fatura antiga conta do dia do chargeback', () => {
    const contestada = {
      ...setembroPaga,
      status: 'CHARGEBACK' as const,
      chargebackAt: emSaoPaulo('2026-11-10'),
    }
    const ativacao = fatura({
      id: 'ativ',
      status: 'PAID',
      dueDate: '2026-10-20',
      periodEnd: '2026-11-19',
      paidAt: emSaoPaulo('2026-10-20'),
    })
    expect(
      derivarEstado(
        fatos({ ...cortesiaAteOutubro, invoices: [contestada, ativacao] }),
        emSaoPaulo('2026-11-12')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-10', diasEmAtraso: 3, faturas: ['set'] },
    })
  })

  /** Ativação paga na cortesia (período até 19/11) e novembro pago: nada vence depois dela. */
  const ativacaoPaga = fatura({
    id: 'ativ',
    status: 'PAID',
    dueDate: '2026-10-20',
    periodEnd: '2026-11-19',
    paidAt: emSaoPaulo('2026-10-20'),
  })
  const novembroPaga = fatura({
    id: 'nov',
    status: 'PAID',
    dueDate: '2026-11-20',
    periodEnd: '2026-12-19',
    paidAt: emSaoPaulo('2026-11-20'),
  })

  it('chargeback registrado durante a cortesia, de ciclo anterior a ela, não é apagado: conta de fimDaCortesia + 1, como o registrado no dia seguinte', () => {
    const contestadaNaCortesia = {
      ...setembroPaga,
      status: 'CHARGEBACK' as const,
      chargebackAt: emSaoPaulo('2026-10-15'),
    }
    const contestadaDepois = {
      ...contestadaNaCortesia,
      chargebackAt: emSaoPaulo('2026-11-01'),
    }
    for (const contestada of [contestadaNaCortesia, contestadaDepois]) {
      const pagante = fatos({
        ...cortesiaAteOutubro,
        invoices: [contestada, ativacaoPaga, novembroPaga],
      })
      const primeiroDia = derivarEstado(pagante, emSaoPaulo('2026-11-01'))
      expect(primeiroDia).toMatchObject({
        estado: 'PAST_DUE',
        regra: 'DIVIDA',
        encerramentoDevido: null,
        divida: {
          desde: '2026-11-01',
          diasEmAtraso: 1,
          encerramentoEm: '2026-12-07',
          faturas: ['set'],
        },
      })
      expect(primeiroDia.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
      expect(derivarEstado(pagante, emSaoPaulo('2026-12-07'))).toMatchObject({
        estado: 'SUSPENDED',
        encerramentoDevido: 'NON_PAYMENT',
      })
    }
  })

  it('estorno involuntário e fatura vencida de antes da cortesia não somem com um ciclo pago que cubra os dias seguintes', () => {
    const agostoVencida = fatura({
      id: 'ago',
      status: 'OVERDUE',
      dueDate: '2026-08-05',
      periodEnd: '2026-09-04',
    })
    const setembroEstornada = {
      ...setembroPaga,
      status: 'REFUNDED' as const,
    }
    for (const antiga of [agostoVencida, setembroEstornada]) {
      const pagante = fatos({
        ...cortesiaAteOutubro,
        invoices: [antiga, ativacaoPaga, novembroPaga],
      })
      expect(derivarEstado(pagante, emSaoPaulo('2026-11-01'))).toMatchObject({
        estado: 'PAST_DUE',
        divida: { desde: '2026-11-01', diasEmAtraso: 1, faturas: [antiga.id] },
      })
      expect(
        derivarEstado(pagante, emSaoPaulo('2026-12-07')).encerramentoDevido
      ).toBe('NON_PAYMENT')
    }
  })

  it('várias dívidas anteriores à cortesia continuam somando o valor em aberto inteiro', () => {
    const cortesiaAteSetembro = {
      billingMode: 'COMPLIMENTARY',
      complimentaryUntil: '2026-09-30',
    } as const
    const junhoContestada = fatura({
      id: 'jun',
      status: 'CHARGEBACK',
      dueDate: '2026-06-05',
      periodEnd: '2026-07-04',
      paidAt: emSaoPaulo('2026-06-05'),
      chargebackAt: emSaoPaulo('2026-06-20'),
    })
    const julhoVencida = fatura({
      id: 'jul',
      status: 'OVERDUE',
      dueDate: '2026-07-05',
      periodEnd: '2026-08-04',
    })
    const agostoVencida = fatura({
      id: 'ago',
      status: 'OVERDUE',
      dueDate: '2026-08-05',
      periodEnd: '2026-09-04',
    })
    const setembroVencida = fatura({
      id: 'set',
      status: 'OVERDUE',
      dueDate: '2026-09-05',
      periodEnd: '2026-09-30',
    })
    const outubroPaga = fatura({
      id: 'out',
      status: 'PAID',
      dueDate: '2026-10-01',
      periodEnd: '2026-10-31',
      paidAt: emSaoPaulo('2026-09-28'),
    })
    const resultado = derivarEstado(
      fatos({
        ...cortesiaAteSetembro,
        invoices: [
          junhoContestada,
          julhoVencida,
          agostoVencida,
          setembroVencida,
          outubroPaga,
        ],
      }),
      emSaoPaulo('2026-10-01')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: {
        desde: '2026-10-01',
        diasEmAtraso: 1,
        faturas: ['jun', 'jul', 'ago', 'set'],
      },
    })
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('599.60')
  })

  it('só um fato auditado apaga a dívida anterior: fatura cancelada no provedor, ajuste de quitação pago ou perdão da equipe', () => {
    const agostoCancelada = fatura({
      id: 'ago',
      status: 'CANCELED',
      dueDate: '2026-08-05',
      periodEnd: '2026-09-04',
    })
    const contestada = {
      ...setembroPaga,
      status: 'CHARGEBACK' as const,
      chargebackAt: emSaoPaulo('2026-10-15'),
    }
    const perdoada = { ...contestada, debtWaivedAt: emSaoPaulo('2026-10-16') }
    const ajustePago = fatura({
      id: 'adj',
      kind: 'ADJUSTMENT',
      status: 'PAID',
      dueDate: '2026-10-16',
      paidAt: emSaoPaulo('2026-10-16'),
      settlesInvoiceId: 'set',
    })
    for (const quitacao of [
      [agostoCancelada],
      [perdoada],
      [contestada, ajustePago],
    ]) {
      expect(
        derivarEstado(
          fatos({
            ...cortesiaAteOutubro,
            invoices: [...quitacao, ativacaoPaga, novembroPaga],
          }),
          emSaoPaulo('2026-11-01')
        )
      ).toMatchObject({ estado: 'ACTIVE', regra: 'FATURA_PAGA', divida: null })
    }
  })

  it('com fatos incoerentes que caem em INCOMPLETE, o ciclo pago antes da cortesia não ativa e o abandono conta de fimDaCortesia + 1, e não da criação', () => {
    // Ciclo com pagamento registrado e depois excluído no provedor: não é
    // dívida nem ciclo quitado.
    const incoerente = fatura({
      id: 'nov',
      status: 'CANCELED',
      dueDate: '2026-11-01',
      paidAt: emSaoPaulo('2026-10-20'),
    })
    const cortesia = fatos({
      ...cortesiaAteOutubro,
      createdAt: emSaoPaulo('2026-01-10'),
      invoices: [setembroPaga, incoerente],
    })
    expect(derivarEstado(cortesia, emSaoPaulo('2026-11-30'))).toMatchObject({
      estado: 'INCOMPLETE',
      encerramentoDevido: null,
    })
    expect(
      derivarEstado(cortesia, emSaoPaulo('2026-12-01')).encerramentoDevido
    ).toBe('ABANDONED')
  })
})

describe('fim da cortesia: teste', () => {
  it('teste que terminou antes da cortesia não encerra no dia seguinte a ela: régua completa a partir de fimDaCortesia + 1', () => {
    const teste = fatos({
      billingMode: 'COMPLIMENTARY',
      complimentaryUntil: '2026-12-31',
      createdAt: emSaoPaulo('2026-09-01'),
      trialEndsAt: '2026-09-15',
    })
    expect(derivarEstado(teste, emSaoPaulo('2026-12-31')).regra).toBe(
      'CORTESIA'
    )
    expect(derivarEstado(teste, emSaoPaulo('2027-01-01'))).toMatchObject({
      estado: 'PAST_DUE',
      encerramentoDevido: null,
      divida: {
        desde: '2027-01-01',
        diasEmAtraso: 1,
        encerramentoEm: '2027-02-06',
      },
    })
    expect(derivarEstado(teste, emSaoPaulo('2027-01-08')).estado).toBe(
      'SUSPENDED'
    )
    expect(
      derivarEstado(teste, emSaoPaulo('2027-02-05')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(teste, emSaoPaulo('2027-02-06')).encerramentoDevido
    ).toBe('TRIAL_EXPIRED')
  })

  it('teste que termina depois da cortesia continua: TRIALING até o fim dele, depois a régua do teste', () => {
    const teste = fatos({
      ...cortesiaAteOutubro,
      createdAt: emSaoPaulo('2026-10-20'),
      trialEndsAt: '2026-11-14',
    })
    const primeiroDia = derivarEstado(teste, emSaoPaulo('2026-11-01'))
    expect(primeiroDia).toMatchObject({ estado: 'TRIALING', regra: 'TESTE' })
    expect(transicaoPermitida('ACTIVE', primeiroDia.estado)).toBe(true)
    expect(derivarEstado(teste, emSaoPaulo('2026-11-15'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-15', diasEmAtraso: 1 },
    })
    const paga = fatura({
      id: 'nov',
      status: 'PAID',
      dueDate: '2026-11-14',
      periodEnd: '2026-12-13',
      paidAt: emSaoPaulo('2026-11-10'),
    })
    expect(
      derivarEstado({ ...teste, invoices: [paga] }, emSaoPaulo('2026-11-15'))
    ).toMatchObject({ estado: 'ACTIVE', regra: 'FATURA_PAGA' })
  })
})

describe('cancelamento pedido pelo dono durante a cortesia', () => {
  it('cortesia com prazo: o sinal OWNER_REQUEST sai no último dia da cortesia, e não no fim de um período anterior', () => {
    const pedido = fatos({
      ...cortesiaAteOutubro,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-10-04',
      invoices: [setembroPaga],
    })
    expect(derivarEstado(pedido, emSaoPaulo('2026-10-10'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
      encerramentoDevido: null,
    })
    expect(derivarEstado(pedido, emSaoPaulo('2026-10-31'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
      encerramentoDevido: 'OWNER_REQUEST',
    })
    // Job atrasado: depois da cortesia o pedido continua valendo.
    expect(derivarEstado(pedido, emSaoPaulo('2026-11-03'))).toMatchObject({
      estado: 'PAST_DUE',
      encerramentoDevido: 'OWNER_REQUEST',
    })
  })

  it('ciclo pago que passa do fim da cortesia: o sinal OWNER_REQUEST só sai no fim do período pago e não some depois de aparecer', () => {
    const ativacao = fatura({
      id: 'ativ',
      status: 'PAID',
      dueDate: '2026-10-20',
      periodEnd: '2026-11-19',
      paidAt: emSaoPaulo('2026-10-20'),
    })
    const pedido = fatos({
      ...cortesiaAteOutubro,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-11-19',
      invoices: [ativacao],
    })
    for (const dia of ['2026-10-31', '2026-11-01', '2026-11-18']) {
      expect(derivarEstado(pedido, emSaoPaulo(dia))).toMatchObject({
        estado: 'ACTIVE',
        encerramentoDevido: null,
      })
    }
    for (const dia of ['2026-11-19', '2026-11-20', '2027-01-10']) {
      expect(
        derivarEstado(pedido, emSaoPaulo(dia)).encerramentoDevido,
        dia
      ).toBe('OWNER_REQUEST')
    }
  })

  it('cortesia sem prazo com período pago em curso: o sinal OWNER_REQUEST sai no fim do período pago', () => {
    const pedido = fatos({
      billingMode: 'COMPLIMENTARY',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-11-19',
      invoices: [
        fatura({
          id: 'ativ',
          status: 'PAID',
          dueDate: '2026-10-20',
          periodEnd: '2026-11-19',
          paidAt: emSaoPaulo('2026-10-20'),
        }),
      ],
    })
    expect(derivarEstado(pedido, emSaoPaulo('2026-10-25'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
      encerramentoDevido: null,
    })
    expect(
      derivarEstado(pedido, emSaoPaulo('2026-11-18')).encerramentoDevido
    ).toBeNull()
    expect(derivarEstado(pedido, emSaoPaulo('2026-11-19'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
      encerramentoDevido: 'OWNER_REQUEST',
    })
  })

  it('o pedido espera o maior entre o período pago e a cortesia, e a cortesia só conta com billingMode COMPLIMENTARY', () => {
    const semPeriodoPago = fatos({
      ...cortesiaAteOutubro,
      cancelAtPeriodEnd: true,
    })
    expect(
      derivarEstado(semPeriodoPago, emSaoPaulo('2026-10-30')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(semPeriodoPago, emSaoPaulo('2026-10-31')).encerramentoDevido
    ).toBe('OWNER_REQUEST')
    // Prazo de cortesia antigo guardado depois de voltar a cobrar: não adia.
    const deVoltaAoAsaas = fatos({
      billingMode: 'ASAAS',
      complimentaryUntil: '2026-10-31',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-10-04',
      invoices: [setembroPaga],
    })
    expect(
      derivarEstado(deVoltaAoAsaas, emSaoPaulo('2026-10-03')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(deVoltaAoAsaas, emSaoPaulo('2026-10-04')).encerramentoDevido
    ).toBe('OWNER_REQUEST')
  })

  it('cortesia sem prazo: o sinal OWNER_REQUEST é imediato, como sem período em curso', () => {
    const semPrazo = fatos({
      billingMode: 'COMPLIMENTARY',
      cancelAtPeriodEnd: true,
      invoices: [setembroPaga],
    })
    expect(derivarEstado(semPrazo, emSaoPaulo('2027-01-01'))).toMatchObject({
      estado: 'ACTIVE',
      regra: 'CORTESIA',
      encerramentoDevido: 'OWNER_REQUEST',
    })
    expect(
      derivarEstado(
        { ...semPrazo, cancelAtPeriodEnd: false },
        emSaoPaulo('2027-01-01')
      ).encerramentoDevido
    ).toBeNull()
  })
})
