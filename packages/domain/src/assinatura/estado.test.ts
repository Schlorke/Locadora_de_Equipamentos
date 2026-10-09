import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { derivarEstado, ESTADOS_DA_ASSINATURA, projetarAcesso } from './estado'
import type { FatosDaAssinatura, FaturaDaAssinatura } from './estado'

/** Instante em São Paulo (UTC−3), meio-dia por padrão. */
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
    createdAt: emSaoPaulo('2026-09-01'),
    complimentaryUntil: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    invoices: [],
    ...parcial,
  }
}

/** Fatura de setembro, paga: a locadora "já pagou alguma vez". */
const setembroPaga = fatura({
  id: 'inv-set',
  status: 'PAID',
  dueDate: '2026-09-05',
  paidAt: emSaoPaulo('2026-09-04'),
})
/** Fatura de outubro, vence em 2026-10-05 e está em aberto. */
const outubroAberta = fatura({
  id: 'inv-out',
  status: 'OVERDUE',
  dueDate: '2026-10-05',
})

describe('projetarAcesso', () => {
  it('projeta os seis estados no acesso da organização (D6)', () => {
    expect(
      ESTADOS_DA_ASSINATURA.map((estado) => [estado, projetarAcesso(estado)])
    ).toEqual([
      ['INCOMPLETE', 'SETUP'],
      ['TRIALING', 'FULL'],
      ['ACTIVE', 'FULL'],
      ['PAST_DUE', 'FULL'],
      ['SUSPENDED', 'RESTRICTED'],
      ['CANCELED', 'ARCHIVED'],
    ])
  })
})

describe('derivarEstado: regra 1 (encerrada)', () => {
  it('canceledAt definido vence qualquer outro fato: CANCELED e ARCHIVED', () => {
    const resultado = derivarEstado(
      fatos({
        billingMode: 'COMPLIMENTARY',
        canceledAt: emSaoPaulo('2026-10-01'),
        invoices: [setembroPaga, outubroAberta],
      }),
      emSaoPaulo('2026-11-30')
    )
    expect(resultado).toMatchObject({
      estado: 'CANCELED',
      acesso: 'ARCHIVED',
      regra: 'CANCELADA',
      encerramentoDevido: null,
      divida: null,
    })
  })
})

describe('derivarEstado: regra 2 (cortesia)', () => {
  it('cortesia sem prazo fica ACTIVE mesmo com fatura vencida', () => {
    const resultado = derivarEstado(
      fatos({
        billingMode: 'COMPLIMENTARY',
        invoices: [setembroPaga, outubroAberta],
      }),
      emSaoPaulo('2027-01-01')
    )
    expect(resultado).toMatchObject({
      estado: 'ACTIVE',
      acesso: 'FULL',
      regra: 'CORTESIA',
    })
  })

  it('cortesia com prazo vale até o último dia, inclusive; no dia seguinte, sem ciclo pago, começa a régua', () => {
    const cortesia = fatos({
      billingMode: 'COMPLIMENTARY',
      complimentaryUntil: '2026-10-31',
    })
    expect(
      derivarEstado(cortesia, emSaoPaulo('2026-10-31', '23:59:59')).regra
    ).toBe('CORTESIA')
    const depois = derivarEstado(cortesia, emSaoPaulo('2026-11-01', '00:00:00'))
    expect(depois).toMatchObject({
      estado: 'PAST_DUE',
      acesso: 'FULL',
      regra: 'DIVIDA',
      divida: { desde: '2026-11-01', diasEmAtraso: 1 },
    })
  })

  it('cortesia vencida conta os prazos a partir do dia seguinte ao fim da cortesia, e não da criação', () => {
    const cortesia = fatos({
      billingMode: 'COMPLIMENTARY',
      createdAt: emSaoPaulo('2026-01-10'),
      complimentaryUntil: '2026-10-31',
    })
    // 2026-11-01 + 35 dias: ainda não encerrou, embora criada há quase 1 ano.
    expect(
      derivarEstado(cortesia, emSaoPaulo('2026-12-06')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(cortesia, emSaoPaulo('2026-12-07')).encerramentoDevido
    ).toBe('TRIAL_EXPIRED')
  })

  it('complimentaryUntil é ignorado quando o modo é ASAAS', () => {
    const resultado = derivarEstado(
      fatos({ complimentaryUntil: '2027-12-31', invoices: [setembroPaga] }),
      emSaoPaulo('2026-10-01')
    )
    expect(resultado.regra).toBe('FATURA_PAGA')
  })
})

describe('derivarEstado: regra 3 (cancelamento pedido pelo dono)', () => {
  const pedido = {
    cancelAtPeriodEnd: true,
    currentPeriodEnd: '2026-10-04',
    invoices: [setembroPaga],
  }

  it('antes do fim do período não há sinal; no dia do fim, sinal OWNER_REQUEST com o estado dos fatos', () => {
    expect(
      derivarEstado(fatos(pedido), emSaoPaulo('2026-10-03')).encerramentoDevido
    ).toBeNull()
    expect(
      derivarEstado(fatos(pedido), emSaoPaulo('2026-10-04'))
    ).toMatchObject({
      estado: 'ACTIVE',
      acesso: 'FULL',
      encerramentoDevido: 'OWNER_REQUEST',
    })
  })

  it('sem período em curso o sinal é imediato', () => {
    const resultado = derivarEstado(
      fatos({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: null,
        trialEndsAt: '2026-10-14',
      }),
      emSaoPaulo('2026-10-01')
    )
    expect(resultado).toMatchObject({
      estado: 'TRIALING',
      encerramentoDevido: 'OWNER_REQUEST',
    })
  })

  it('o pedido do dono tem prioridade sobre o encerramento por falta de pagamento e por abandono', () => {
    const emDivida = derivarEstado(
      fatos({ ...pedido, invoices: [setembroPaga, outubroAberta] }),
      emSaoPaulo('2026-11-20')
    )
    expect(emDivida).toMatchObject({
      estado: 'SUSPENDED',
      encerramentoDevido: 'OWNER_REQUEST',
    })
    const incompleta = derivarEstado(
      fatos({ cancelAtPeriodEnd: true, currentPeriodEnd: '2026-09-15' }),
      emSaoPaulo('2026-12-31')
    )
    expect(incompleta).toMatchObject({
      estado: 'INCOMPLETE',
      encerramentoDevido: 'OWNER_REQUEST',
    })
  })

  it('sem cancelAtPeriodEnd, o fim do período não gera sinal', () => {
    const resultado = derivarEstado(
      fatos({ currentPeriodEnd: '2026-10-04', invoices: [setembroPaga] }),
      emSaoPaulo('2026-10-04')
    )
    expect(resultado.encerramentoDevido).toBeNull()
  })
})

describe('derivarEstado: regra 4 (dívida)', () => {
  it('INCOMPLETE nunca vira PAST_DUE: quem nunca pagou nem teve teste fica INCOMPLETE e é abandonado', () => {
    const nuncaPagou = fatos({ invoices: [outubroAberta] })
    const noDia8 = derivarEstado(nuncaPagou, emSaoPaulo('2026-10-13'))
    expect(noDia8).toMatchObject({
      estado: 'INCOMPLETE',
      acesso: 'SETUP',
      regra: 'INCOMPLETA',
      divida: null,
    })
    expect(noDia8.encerramentoDevido).toBe('ABANDONED')
  })

  it('fatura PENDING vencida conta mesmo que o provedor ainda não a tenha marcado OVERDUE', () => {
    const pendente = fatura({
      id: 'inv-out',
      status: 'PENDING',
      dueDate: '2026-10-05',
    })
    expect(
      derivarEstado(
        fatos({ invoices: [setembroPaga, pendente] }),
        emSaoPaulo('2026-10-05')
      ).estado
    ).toBe('ACTIVE')
    expect(
      derivarEstado(
        fatos({ invoices: [setembroPaga, pendente] }),
        emSaoPaulo('2026-10-06')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-06', diasEmAtraso: 1 },
    })
  })

  it('OVERDUE à frente do relógio conta a partir de hoje', () => {
    const adiantada = fatura({
      id: 'inv-out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
    })
    const resultado = derivarEstado(
      fatos({ invoices: [setembroPaga, adiantada] }),
      emSaoPaulo('2026-10-05')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-05', diasEmAtraso: 1 },
    })
  })

  it('chargeback conta a partir do dia de chargebackAt em São Paulo, mesmo em fatura antiga', () => {
    const contestada = fatura({
      id: 'inv-set',
      status: 'CHARGEBACK',
      dueDate: '2026-09-05',
      paidAt: emSaoPaulo('2026-09-04'),
      // 01:30 UTC de 20/10 ainda é 19/10 em São Paulo.
      chargebackAt: new Date('2026-10-20T01:30:00Z'),
    })
    const resultado = derivarEstado(
      fatos({ invoices: [contestada] }),
      emSaoPaulo('2026-10-19')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: {
        desde: '2026-10-19',
        diasEmAtraso: 1,
        toleranciaAte: '2026-10-25',
        pausaEm: '2026-10-26',
      },
    })
  })

  it('chargeback sem data conta do dia seguinte ao vencimento; chargeback com data futura conta de hoje', () => {
    const semData = fatura({
      id: 'a',
      status: 'CHARGEBACK',
      dueDate: '2026-10-05',
      paidAt: emSaoPaulo('2026-10-05'),
    })
    expect(
      derivarEstado(fatos({ invoices: [semData] }), emSaoPaulo('2026-10-10'))
        .divida?.desde
    ).toBe('2026-10-06')
    const futura = fatura({
      id: 'b',
      status: 'CHARGEBACK',
      dueDate: '2026-10-05',
      paidAt: emSaoPaulo('2026-10-05'),
      chargebackAt: emSaoPaulo('2026-10-12'),
    })
    expect(
      derivarEstado(fatos({ invoices: [futura] }), emSaoPaulo('2026-10-10'))
        .divida?.desde
    ).toBe('2026-10-10')
  })

  it('estorno involuntário vira dívida; estorno voluntário não vira dívida e conta como quitado', () => {
    const involuntario = fatura({
      id: 'inv-set',
      status: 'REFUNDED',
      dueDate: '2026-09-05',
      paidAt: emSaoPaulo('2026-09-04'),
    })
    expect(
      derivarEstado(
        fatos({ invoices: [involuntario] }),
        emSaoPaulo('2026-09-10')
      )
    ).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-09-06', diasEmAtraso: 5 },
    })
    const voluntario = { ...involuntario, voluntaryRefund: true }
    expect(
      derivarEstado(fatos({ invoices: [voluntario] }), emSaoPaulo('2026-09-10'))
    ).toMatchObject({
      estado: 'ACTIVE',
      regra: 'FATURA_PAGA',
      divida: null,
    })
  })

  it('teste vencido sem fatura paga é dívida desde o dia seguinte ao fim do teste, mesmo sem fatura emitida', () => {
    const teste = fatos({ trialEndsAt: '2026-10-14' })
    expect(derivarEstado(teste, emSaoPaulo('2026-10-14')).estado).toBe(
      'TRIALING'
    )
    const vencido = derivarEstado(teste, emSaoPaulo('2026-10-15'))
    expect(vencido).toMatchObject({
      estado: 'PAST_DUE',
      regra: 'DIVIDA',
      divida: { desde: '2026-10-15', diasEmAtraso: 1, faturas: [] },
    })
    expect(vencido.divida?.valorEmAberto.isZero()).toBe(true)
  })

  it('teste vencido junto com fatura em aberto: vale o mais antigo dos dois', () => {
    const primeira = fatura({
      id: 'inv-1',
      status: 'OVERDUE',
      dueDate: '2026-10-20',
      amount: '149.90',
    })
    const resultado = derivarEstado(
      fatos({ trialEndsAt: '2026-10-14', invoices: [primeira] }),
      emSaoPaulo('2026-10-22')
    )
    expect(resultado).toMatchObject({
      estado: 'SUSPENDED',
      divida: { desde: '2026-10-15', diasEmAtraso: 8, faturas: ['inv-1'] },
    })
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('149.90')
    const antiga = fatura({
      id: 'inv-0',
      kind: 'ADJUSTMENT',
      status: 'OVERDUE',
      dueDate: '2026-10-10',
    })
    expect(
      derivarEstado(
        fatos({ trialEndsAt: '2026-10-14', invoices: [antiga] }),
        emSaoPaulo('2026-10-22')
      ).divida?.desde
    ).toBe('2026-10-11')
  })

  it('teste vencido com fatura CYCLE paga depois contestada conta só do chargeback, não do fim do teste', () => {
    const contestada = fatura({
      id: 'inv-1',
      status: 'CHARGEBACK',
      dueDate: '2026-10-14',
      paidAt: emSaoPaulo('2026-10-13'),
      chargebackAt: emSaoPaulo('2026-11-20'),
    })
    const resultado = derivarEstado(
      fatos({ trialEndsAt: '2026-10-14', invoices: [contestada] }),
      emSaoPaulo('2026-11-20')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-11-20', diasEmAtraso: 1 },
    })
  })

  it('teste vencido com só uma fatura de ajuste paga continua devendo o ciclo', () => {
    const ajustePago = fatura({
      id: 'adj',
      kind: 'ADJUSTMENT',
      status: 'PAID',
      dueDate: '2026-10-01',
      paidAt: emSaoPaulo('2026-10-01'),
    })
    const resultado = derivarEstado(
      fatos({ trialEndsAt: '2026-10-14', invoices: [ajustePago] }),
      emSaoPaulo('2026-10-20')
    )
    expect(resultado).toMatchObject({
      estado: 'PAST_DUE',
      divida: { desde: '2026-10-15', diasEmAtraso: 6 },
    })
  })

  it('usa a dívida mais antiga, soma o valor em aberto em Decimal e lista as faturas', () => {
    const outubro = fatura({
      id: 'inv-out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
      amount: '149.90',
    })
    const ajuste = fatura({
      id: 'inv-adj',
      kind: 'ADJUSTMENT',
      status: 'OVERDUE',
      dueDate: '2026-09-20',
      amount: '0.20',
    })
    const resultado = derivarEstado(
      fatos({ invoices: [setembroPaga, outubro, ajuste] }),
      emSaoPaulo('2026-10-06')
    )
    expect(resultado.divida?.desde).toBe('2026-09-21')
    expect(resultado.divida?.diasEmAtraso).toBe(16)
    expect(resultado.estado).toBe('SUSPENDED')
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('150.10')
    expect(resultado.divida?.faturas).toEqual(['inv-out', 'inv-adj'])
  })

  it('faturas pagas, canceladas e pendentes a vencer não são dívida', () => {
    const cancelada = fatura({
      id: 'c',
      status: 'CANCELED',
      dueDate: '2026-08-01',
    })
    const aVencer = fatura({
      id: 'p',
      status: 'PENDING',
      dueDate: '2026-10-05',
    })
    const resultado = derivarEstado(
      fatos({ invoices: [setembroPaga, cancelada, aVencer] }),
      emSaoPaulo('2026-10-01')
    )
    expect(resultado).toMatchObject({ estado: 'ACTIVE', divida: null })
  })

  it('já pagou mas não deve nada segue para as regras seguintes', () => {
    expect(
      derivarEstado(
        fatos({ invoices: [setembroPaga] }),
        emSaoPaulo('2026-09-30')
      ).regra
    ).toBe('FATURA_PAGA')
  })
})

describe('derivarEstado: regras 5, 6 e 7', () => {
  it('em teste até o último dia (trialEndsAt ≥ hoje), mesmo com a primeira fatura já paga', () => {
    const paga = fatura({
      id: 'inv-1',
      status: 'PAID',
      dueDate: '2026-10-14',
      paidAt: emSaoPaulo('2026-10-02'),
    })
    expect(
      derivarEstado(
        fatos({ trialEndsAt: '2026-10-14', invoices: [paga] }),
        emSaoPaulo('2026-10-14')
      )
    ).toMatchObject({
      estado: 'TRIALING',
      acesso: 'FULL',
      regra: 'TESTE',
    })
    expect(
      derivarEstado(
        fatos({ trialEndsAt: '2026-10-14', invoices: [paga] }),
        emSaoPaulo('2026-10-15')
      )
    ).toMatchObject({
      estado: 'ACTIVE',
      regra: 'FATURA_PAGA',
    })
  })

  it('só fatura de ajuste paga não ativa a assinatura', () => {
    const ajustePago = fatura({
      id: 'adj',
      kind: 'ADJUSTMENT',
      status: 'PAID',
      dueDate: '2026-09-10',
      paidAt: emSaoPaulo('2026-09-10'),
    })
    expect(
      derivarEstado(fatos({ invoices: [ajustePago] }), emSaoPaulo('2026-09-12'))
    ).toMatchObject({
      estado: 'INCOMPLETE',
      regra: 'INCOMPLETA',
    })
  })

  it('INCOMPLETE vira sinal ABANDONED depois de incompleteDays contados do dia da criação em São Paulo', () => {
    // 01:00 UTC de 01/09 é 31/08 em São Paulo: o prazo conta de 31/08.
    const criada = fatos({ createdAt: new Date('2026-09-01T01:00:00Z') })
    expect(
      derivarEstado(criada, emSaoPaulo('2026-09-29')).encerramentoDevido
    ).toBeNull()
    expect(derivarEstado(criada, emSaoPaulo('2026-09-30'))).toMatchObject({
      estado: 'INCOMPLETE',
      encerramentoDevido: 'ABANDONED',
    })
    const politica = { graceDays: 7, suspendDays: 30, incompleteDays: 10 }
    expect(
      derivarEstado(criada, emSaoPaulo('2026-09-10'), politica)
        .encerramentoDevido
    ).toBe('ABANDONED')
  })
})

describe('derivarEstado: virada de dia em São Paulo', () => {
  const emAtraso = fatos({ invoices: [setembroPaga, outubroAberta] })

  it('23:59:59 em São Paulo ainda é o 7º dia de atraso; 00:00 já é o 8º', () => {
    const ultimoInstante = derivarEstado(
      emAtraso,
      new Date('2026-10-13T02:59:59.999Z')
    )
    expect(ultimoInstante).toMatchObject({
      hoje: '2026-10-12',
      estado: 'PAST_DUE',
      divida: { diasEmAtraso: 7 },
    })
    const meiaNoite = derivarEstado(
      emAtraso,
      new Date('2026-10-13T03:00:00.000Z')
    )
    expect(meiaNoite).toMatchObject({
      hoje: '2026-10-13',
      estado: 'SUSPENDED',
      acesso: 'RESTRICTED',
      divida: { diasEmAtraso: 8 },
    })
  })
})

describe('derivarEstado: eventos duplicados ou fora de ordem', () => {
  const faturas = [
    setembroPaga,
    fatura({
      id: 'inv-out',
      status: 'OVERDUE',
      dueDate: '2026-10-05',
      amount: '149.90',
    }),
    fatura({
      id: 'inv-adj',
      kind: 'ADJUSTMENT',
      status: 'OVERDUE',
      dueDate: '2026-10-08',
      amount: '10.00',
    }),
    fatura({ id: 'inv-c', status: 'CANCELED', dueDate: '2026-08-05' }),
  ]

  function permutacoes<T>(lista: readonly T[]): T[][] {
    if (lista.length <= 1) return [[...lista]]
    return lista.flatMap((item, i) =>
      permutacoes([...lista.slice(0, i), ...lista.slice(i + 1)]).map(
        (resto) => [item, ...resto]
      )
    )
  }

  it('o resultado não depende da ordem das faturas (24 permutações)', () => {
    const agora = emSaoPaulo('2026-10-20')
    const referencia = derivarEstado(fatos({ invoices: faturas }), agora)
    for (const ordem of permutacoes(faturas)) {
      const resultado = derivarEstado(fatos({ invoices: ordem }), agora)
      expect(resultado.estado).toBe(referencia.estado)
      expect(resultado.encerramentoDevido).toBe(referencia.encerramentoDevido)
      expect(resultado.divida?.desde).toBe(referencia.divida?.desde)
      expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('159.90')
      expect([...(resultado.divida?.faturas ?? [])].sort()).toEqual([
        'inv-adj',
        'inv-out',
      ])
    }
  })

  it('a mesma fatura repetida (webhook duplicado) conta uma vez', () => {
    const repetidas = [...faturas, ...faturas, { ...faturas[1]! }]
    const resultado = derivarEstado(
      fatos({ invoices: repetidas }),
      emSaoPaulo('2026-10-20')
    )
    expect(resultado.divida?.valorEmAberto.toFixed(2)).toBe('159.90')
    expect(resultado.divida?.faturas).toEqual(['inv-out', 'inv-adj'])
    const comDatas = fatura({
      id: 'x',
      status: 'CHARGEBACK',
      paidAt: emSaoPaulo('2026-10-05'),
      chargebackAt: emSaoPaulo('2026-10-06'),
    })
    const copia = {
      ...comDatas,
      paidAt: new Date(comDatas.paidAt!.getTime()),
      amount: new Decimal('149.9'),
    }
    expect(
      derivarEstado(
        fatos({ invoices: [comDatas, copia] }),
        emSaoPaulo('2026-10-07')
      ).divida?.faturas
    ).toEqual(['x'])
  })

  it('pagamento que chega depois do cálculo de SUSPENDED devolve ACTIVE (só os fatos contam)', () => {
    const agora = emSaoPaulo('2026-10-20')
    expect(
      derivarEstado(fatos({ invoices: [setembroPaga, outubroAberta] }), agora)
        .estado
    ).toBe('SUSPENDED')
    const paga = {
      ...outubroAberta,
      status: 'PAID' as const,
      paidAt: emSaoPaulo('2026-10-20'),
    }
    expect(
      derivarEstado(fatos({ invoices: [setembroPaga, paga] }), agora)
    ).toMatchObject({ estado: 'ACTIVE', divida: null })
  })

  it.each([
    ['status', { status: 'PAID' as const }],
    ['tipo', { kind: 'ADJUSTMENT' as const }],
    ['valor', { amount: '149.91' }],
    ['vencimento', { dueDate: '2026-10-06' }],
    ['pagamento', { paidAt: emSaoPaulo('2026-10-06') }],
    ['chargeback', { chargebackAt: emSaoPaulo('2026-10-06') }],
    ['estorno voluntário', { voluntaryRefund: true }],
    ['fim do período', { periodEnd: '2026-11-04' }],
    ['fatura quitada pelo ajuste', { settlesInvoiceId: 'inv-set' }],
    ['perdão', { debtWaivedAt: emSaoPaulo('2026-10-06') }],
  ])(
    'versões contraditórias da mesma fatura (%s) são recusadas',
    (_campo, diferenca) => {
      const original = fatura({ id: 'inv-out', status: 'OVERDUE' })
      expect(() =>
        derivarEstado(
          fatos({ invoices: [original, { ...original, ...diferenca }] }),
          emSaoPaulo('2026-10-20')
        )
      ).toThrow('Fatos contraditórios para a fatura inv-out.')
    }
  )
})

describe('derivarEstado: fatos inválidos', () => {
  it('recusa relógio inválido, dia inexistente, valor não decimal ou em number e política fora dos limites', () => {
    const agora = emSaoPaulo('2026-10-20')
    expect(() => derivarEstado(fatos(), new Date('x'))).toThrow(RangeError)
    expect(() =>
      derivarEstado(fatos({ trialEndsAt: '2026-02-30' }), agora)
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(fatos({ currentPeriodEnd: '20261020' }), agora)
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(
        fatos({ invoices: [fatura({ id: 'a', dueDate: '2026-13-01' })] }),
        agora
      )
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(
        fatos({ invoices: [fatura({ id: 'a', periodEnd: '2026-02-30' })] }),
        agora
      )
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(
        fatos({ invoices: [fatura({ id: 'a', amount: 'abc' })] }),
        agora
      )
    ).toThrow()
    expect(() =>
      derivarEstado(
        fatos({ invoices: [fatura({ id: 'a', amount: 'Infinity' })] }),
        agora
      )
    ).toThrow(RangeError)
    const emNumber = fatura({ id: 'a', amount: 149.9 as unknown as string })
    expect(() => derivarEstado(fatos({ invoices: [emNumber] }), agora)).toThrow(
      TypeError
    )
    expect(() =>
      derivarEstado(fatos(), agora, {
        graceDays: 16,
        suspendDays: 30,
        incompleteDays: 30,
      })
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(fatos(), agora, {
        graceDays: 7,
        suspendDays: 6,
        incompleteDays: 30,
      })
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(fatos(), agora, {
        graceDays: 7,
        suspendDays: 30,
        incompleteDays: 0,
      })
    ).toThrow(RangeError)
    expect(() =>
      derivarEstado(fatos(), agora, {
        graceDays: 7.5,
        suspendDays: 30,
        incompleteDays: 30,
      })
    ).toThrow(RangeError)
  })
})
