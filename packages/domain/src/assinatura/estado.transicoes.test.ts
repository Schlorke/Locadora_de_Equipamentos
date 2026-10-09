import { describe, expect, it } from 'vitest'
import {
  ESTADOS_DA_ASSINATURA,
  ESTADOS_INICIAIS,
  TRANSICOES_DA_ASSINATURA,
  derivarEstado,
  transicaoPermitida,
} from './estado'
import type {
  EstadoDaAssinatura,
  FatosDaAssinatura,
  FaturaDaAssinatura,
} from './estado'

/**
 * Tabela completa do diagrama de estados do ADR de assinatura (B.5), escrita à
 * mão: linha = de, coluna = para, na ordem INCOMPLETE, TRIALING, ACTIVE,
 * PAST_DUE, SUSPENDED, CANCELED. `null` é a criação.
 */
const ESPERADO: ReadonlyArray<[EstadoDaAssinatura | null, readonly boolean[]]> =
  [
    [null, [true, true, true, false, false, false]],
    ['INCOMPLETE', [true, false, true, true, true, true]],
    ['TRIALING', [false, true, true, true, true, true]],
    ['ACTIVE', [false, true, true, true, true, true]],
    ['PAST_DUE', [false, true, true, true, true, true]],
    ['SUSPENDED', [false, true, true, true, true, true]],
    ['CANCELED', [false, false, false, false, false, true]],
  ]

describe('transicaoPermitida', () => {
  it.each(ESPERADO)('de %s', (de, linha) => {
    expect(
      ESTADOS_DA_ASSINATURA.map((para) => transicaoPermitida(de, para))
    ).toEqual(linha)
  })

  it('CANCELED é terminal: não sai para nenhum outro estado', () => {
    expect(TRANSICOES_DA_ASSINATURA.CANCELED).toEqual([])
    for (const para of ESTADOS_DA_ASSINATURA.filter(
      (estado) => estado !== 'CANCELED'
    )) {
      expect(transicaoPermitida('CANCELED', para)).toBe(false)
    }
  })

  it('nada volta para INCOMPLETE, e INCOMPLETE não vai para TRIALING', () => {
    for (const de of ESTADOS_DA_ASSINATURA.filter(
      (estado) => estado !== 'INCOMPLETE'
    )) {
      expect(transicaoPermitida(de, 'INCOMPLETE')).toBe(false)
    }
    expect(transicaoPermitida('INCOMPLETE', 'TRIALING')).toBe(false)
  })

  it('uma assinatura nasce só em TRIALING, INCOMPLETE ou ACTIVE', () => {
    expect(transicaoPermitida(null, 'PAST_DUE')).toBe(false)
    expect(transicaoPermitida(null, 'SUSPENDED')).toBe(false)
    expect(transicaoPermitida(null, 'CANCELED')).toBe(false)
  })

  it('as tabelas exportadas não podem ser alteradas em tempo de execução', () => {
    expect(Object.isFrozen(TRANSICOES_DA_ASSINATURA)).toBe(true)
    expect(Object.isFrozen(TRANSICOES_DA_ASSINATURA.ACTIVE)).toBe(true)
    expect(Object.isFrozen(ESTADOS_INICIAIS)).toBe(true)
    expect(Object.isFrozen(ESTADOS_DA_ASSINATURA)).toBe(true)
  })
})

function emSaoPaulo(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`)
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

const setembroPaga = fatura({
  id: 'set',
  status: 'PAID',
  dueDate: '2026-09-05',
  paidAt: emSaoPaulo('2026-09-05'),
})
const outubro = fatura({ id: 'out', dueDate: '2026-10-05' })
const outubroVencida = { ...outubro, status: 'OVERDUE' as const }
const outubroContestada = (chargebackAt: string): FaturaDaAssinatura => ({
  ...outubro,
  status: 'CHARGEBACK',
  paidAt: emSaoPaulo('2026-10-05'),
  chargebackAt: emSaoPaulo(chargebackAt),
})
/** Teste de 30 dias; o dono clicou "Assinar agora" e pagou a 1ª fatura cedo. */
const testeLongo = { trialEndsAt: '2026-10-30' }
const primeiraContestada = fatura({
  id: 'p1',
  status: 'CHARGEBACK',
  dueDate: '2026-10-30',
  periodEnd: '2026-11-28',
  paidAt: emSaoPaulo('2026-10-01'),
  chargebackAt: emSaoPaulo('2026-10-03'),
})
const primeiraPerdoadaEm = (dia: string): FaturaDaAssinatura => ({
  ...primeiraContestada,
  debtWaivedAt: emSaoPaulo(dia),
})

type Salto = [
  rotulo: string,
  antes: [FatosDaAssinatura, string],
  depois: [FatosDaAssinatura, string],
  de: EstadoDaAssinatura,
  para: EstadoDaAssinatura,
]

/** Cada aresta que a tabela passou a aceitar, com os fatos legítimos que a produzem. */
const SALTOS_LEGITIMOS: Salto[] = [
  [
    'queda do cron por 8 dias depois do vencimento',
    [fatos({ invoices: [setembroPaga, outubro] }), '2026-10-05'],
    [fatos({ invoices: [setembroPaga, outubroVencida] }), '2026-10-13'],
    'ACTIVE',
    'SUSPENDED',
  ],
  [
    'queda do cron por 8 dias depois do fim do teste',
    [fatos({ trialEndsAt: '2026-10-14' }), '2026-10-14'],
    [fatos({ trialEndsAt: '2026-10-14' }), '2026-10-22'],
    'TRIALING',
    'SUSPENDED',
  ],
  [
    'pagamento e chargeback chegam antes do recompute',
    [fatos({ invoices: [outubro] }), '2026-10-05'],
    [fatos({ invoices: [outubroContestada('2026-10-06')] }), '2026-10-06'],
    'INCOMPLETE',
    'PAST_DUE',
  ],
  [
    'pagamento e chargeback antes do recompute, com o cron parado',
    [fatos({ invoices: [outubro] }), '2026-10-05'],
    [fatos({ invoices: [outubroContestada('2026-10-06')] }), '2026-10-14'],
    'INCOMPLETE',
    'SUSPENDED',
  ],
  [
    'a dívida mais antiga é quitada e a mais nova ainda está na tolerância',
    [
      fatos({
        invoices: [
          setembroPaga,
          fatura({
            id: 'adj',
            kind: 'ADJUSTMENT',
            status: 'OVERDUE',
            dueDate: '2026-09-20',
          }),
          outubroVencida,
        ],
      }),
      '2026-10-08',
    ],
    [
      fatos({
        invoices: [
          setembroPaga,
          fatura({
            id: 'adj',
            kind: 'ADJUSTMENT',
            status: 'PAID',
            dueDate: '2026-09-20',
            paidAt: emSaoPaulo('2026-10-08'),
          }),
          outubroVencida,
        ],
      }),
      '2026-10-08',
    ],
    'SUSPENDED',
    'PAST_DUE',
  ],
  [
    'cortesia mais curta que o teste termina',
    [
      fatos({
        billingMode: 'COMPLIMENTARY',
        complimentaryUntil: '2026-10-31',
        trialEndsAt: '2026-11-14',
      }),
      '2026-10-31',
    ],
    [
      fatos({
        billingMode: 'COMPLIMENTARY',
        complimentaryUntil: '2026-10-31',
        trialEndsAt: '2026-11-14',
      }),
      '2026-11-01',
    ],
    'ACTIVE',
    'TRIALING',
  ],
  [
    'chargeback no teste, perdoado pela equipe ainda na tolerância',
    [fatos({ ...testeLongo, invoices: [primeiraContestada] }), '2026-10-05'],
    [
      fatos({ ...testeLongo, invoices: [primeiraPerdoadaEm('2026-10-05')] }),
      '2026-10-05',
    ],
    'PAST_DUE',
    'TRIALING',
  ],
  [
    'chargeback no teste, perdoado pela equipe já na pausa',
    [fatos({ ...testeLongo, invoices: [primeiraContestada] }), '2026-10-13'],
    [
      fatos({ ...testeLongo, invoices: [primeiraPerdoadaEm('2026-10-13')] }),
      '2026-10-13',
    ],
    'SUSPENDED',
    'TRIALING',
  ],
]

describe('saltos legítimos que a tabela aceita (B.5)', () => {
  it.each(SALTOS_LEGITIMOS)(
    '%s',
    (_rotulo, [fatosAntes, diaAntes], [fatosDepois, diaDepois], de, para) => {
      expect(derivarEstado(fatosAntes, emSaoPaulo(diaAntes)).estado).toBe(de)
      expect(derivarEstado(fatosDepois, emSaoPaulo(diaDepois)).estado).toBe(
        para
      )
      expect(transicaoPermitida(de, para)).toBe(true)
    }
  )

  it('cada aresta nova da tabela tem um salto legítimo documentado', () => {
    const documentados = new Set(
      SALTOS_LEGITIMOS.map(([, , , de, para]) => `${de}→${para}`)
    )
    const doDiagramaOriginal = new Set([
      'INCOMPLETE→ACTIVE',
      'INCOMPLETE→CANCELED',
      'TRIALING→ACTIVE',
      'TRIALING→PAST_DUE',
      'TRIALING→CANCELED',
      'ACTIVE→PAST_DUE',
      'ACTIVE→CANCELED',
      'PAST_DUE→ACTIVE',
      'PAST_DUE→SUSPENDED',
      'PAST_DUE→CANCELED',
      'SUSPENDED→ACTIVE',
      'SUSPENDED→CANCELED',
    ])
    for (const de of ESTADOS_DA_ASSINATURA) {
      for (const para of TRANSICOES_DA_ASSINATURA[de]) {
        const aresta = `${de}→${para}`
        expect(
          doDiagramaOriginal.has(aresta) || documentados.has(aresta),
          aresta
        ).toBe(true)
      }
    }
  })
})
