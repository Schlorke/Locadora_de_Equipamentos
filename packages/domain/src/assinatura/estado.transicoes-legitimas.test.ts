import { describe, expect, it } from 'vitest'
import { compararDias, somarDias } from './dia-civil'
import type { DiaCivil } from './dia-civil'
import {
  ESTADOS_DA_ASSINATURA,
  derivarEstado,
  transicaoPermitida,
} from './estado'
import type {
  EstadoDaAssinatura,
  FatosDaAssinatura,
  FaturaDaAssinatura,
  MotivoDoEncerramento,
} from './estado'

/**
 * Propriedade da tabela de transições (ADR de assinatura, B.5): toda
 * transição que `derivarEstado` produz entre dois recomputes consecutivos, a
 * partir de fatos legítimos, é aceita por `transicaoPermitida`. Senão a
 * transição vira só alerta e a locadora fica presa no estado anterior.
 *
 * Nos mesmos fatos valem também as propriedades dos sinais e da dívida: o
 * pedido de cancelamento respeita o período pago e a cortesia, um sinal de
 * encerramento não some com o passar dos dias (o job age no primeiro) e a
 * cortesia vencida só adia o relógio da dívida, sem apagá-la.
 *
 * Fatos legítimos: os que webhooks, jobs e ações da ADR gravam — faturas
 * emitidas, vencidas, pagas, estornadas, contestadas (inclusive com data
 * anterior ao registro: fato tardio), excluídas no provedor, ajustes de
 * quitação, perdão da equipe, cortesia com e sem prazo, pedido e desistência
 * de cancelamento e o job de encerramento. O relógio avança de 1 a 45 dias por
 * passo (queda do cron) e às vezes vários fatos chegam entre dois recomputes.
 *
 * O gerador é determinístico (mulberry32 com semente fixa): uma falha se
 * reproduz com a semente e o rastro impressos.
 */

interface Gerador {
  inteiro(minimo: number, maximo: number): number
  chance(probabilidade: number): boolean
  escolher<T>(lista: readonly T[]): T
}

function gerador(semente: number): Gerador {
  let a = semente >>> 0
  const proximo = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
  return {
    inteiro: (minimo, maximo) =>
      minimo + Math.floor(proximo() * (maximo - minimo + 1)),
    chance: (probabilidade) => proximo() < probabilidade,
    escolher: (lista) => {
      const item = lista[Math.floor(proximo() * lista.length)]
      if (item === undefined) throw new Error('lista vazia')
      return item
    },
  }
}

function meioDia(dia: DiaCivil): Date {
  return new Date(`${dia}T12:00:00-03:00`)
}

interface Mundo {
  fatos: FatosDaAssinatura
  hoje: DiaCivil
  proximoId: number
  rastro: string[]
}

function emitir(mundo: Mundo, parcial: Partial<FaturaDaAssinatura>): string {
  const id = `f${mundo.proximoId++}`
  const nova: FaturaDaAssinatura = {
    id,
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '149.90',
    dueDate: mundo.hoje,
    periodEnd: null,
    paidAt: null,
    chargebackAt: null,
    voluntaryRefund: false,
    settlesInvoiceId: null,
    debtWaivedAt: null,
    ...parcial,
  }
  mundo.fatos = { ...mundo.fatos, invoices: [...mundo.fatos.invoices, nova] }
  return id
}

function alterar(
  mundo: Mundo,
  id: string,
  mudanca: Partial<FaturaDaAssinatura>
): void {
  mundo.fatos = {
    ...mundo.fatos,
    invoices: mundo.fatos.invoices.map((fatura) =>
      fatura.id === id ? { ...fatura, ...mudanca } : fatura
    ),
  }
}

function contestada(fatura: FaturaDaAssinatura): boolean {
  return (
    fatura.status === 'CHARGEBACK' ||
    (fatura.status === 'REFUNDED' && !fatura.voluntaryRefund)
  )
}

type Evento = (mundo: Mundo, r: Gerador) => string | null

const EVENTOS: ReadonlyArray<readonly [string, number, Evento]> = [
  [
    'relogio',
    6,
    (m, r) => {
      const dias = r.escolher([1, 1, 1, 1, 2, 3, 5, 7, 8, 10, 15, 30, 37, 45])
      m.hoje = somarDias(m.hoje, dias)
      return `+${dias}d`
    },
  ],
  [
    'ciclo',
    3,
    (m, r) => {
      // Um ciclo por vez, como o provedor. O primeiro vence no fim do teste
      // ("Assinar agora" a qualquer momento do teste, B.6) ou em até 10 dias;
      // os seguintes, 30 dias depois do anterior, emitidos até 10 dias antes.
      const ciclos = m.fatos.invoices.filter((f) => f.kind === 'CYCLE')
      const ultimo = ciclos[ciclos.length - 1]
      const fimDoTeste = m.fatos.trialEndsAt
      let dueDate: DiaCivil
      if (ultimo !== undefined) {
        dueDate = somarDias(ultimo.dueDate, 30)
        if (compararDias(dueDate, somarDias(m.hoje, 10)) > 0) return null
      } else if (fimDoTeste !== null && compararDias(fimDoTeste, m.hoje) >= 0) {
        dueDate = fimDoTeste
      } else {
        dueDate = somarDias(m.hoje, r.inteiro(0, 10))
      }
      const periodEnd = r.chance(0.8) ? somarDias(dueDate, 29) : null
      return `ciclo ${emitir(m, { dueDate, periodEnd })} vence ${dueDate}`
    },
  ],
  [
    'vencer',
    3,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter(
        (f) => f.status === 'PENDING' && compararDias(f.dueDate, m.hoje) < 0
      )
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      alterar(m, alvo.id, { status: 'OVERDUE' })
      return `vencida ${alvo.id}`
    },
  ],
  [
    'pagar',
    4,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter(
        (f) => f.status === 'PENDING' || f.status === 'OVERDUE'
      )
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      alterar(m, alvo.id, { status: 'PAID', paidAt: meioDia(m.hoje) })
      if (alvo.kind === 'CYCLE' && alvo.periodEnd !== null) {
        m.fatos = { ...m.fatos, currentPeriodEnd: alvo.periodEnd }
      }
      return `paga ${alvo.id}`
    },
  ],
  [
    'estornar',
    1,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter((f) => f.status === 'PAID')
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      const voluntaryRefund = r.chance(0.5)
      alterar(m, alvo.id, { status: 'REFUNDED', voluntaryRefund })
      return `estorno ${voluntaryRefund ? 'voluntário' : 'involuntário'} ${alvo.id}`
    },
  ],
  [
    'contestar',
    2,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter((f) => f.status === 'PAID')
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      // Fato tardio: o chargeback pode ter acontecido dias antes do registro.
      const dia = somarDias(m.hoje, -r.inteiro(0, 20))
      const chargebackAt = meioDia(dia)
      const inicio =
        alvo.paidAt !== null && alvo.paidAt > chargebackAt
          ? alvo.paidAt
          : chargebackAt
      alterar(m, alvo.id, { status: 'CHARGEBACK', chargebackAt: inicio })
      return `chargeback ${alvo.id}`
    },
  ],
  [
    'excluir',
    1,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter(
        (f) => f.status === 'PENDING' || f.status === 'OVERDUE'
      )
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      alterar(m, alvo.id, { status: 'CANCELED' })
      return `excluída ${alvo.id}`
    },
  ],
  [
    'ajuste',
    2,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter(
        (f) => contestada(f) && f.debtWaivedAt === null
      )
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      const id = emitir(m, {
        kind: 'ADJUSTMENT',
        amount: alvo.amount,
        dueDate: somarDias(m.hoje, r.inteiro(0, 5)),
        settlesInvoiceId: alvo.id,
      })
      return `ajuste ${id} para ${alvo.id}`
    },
  ],
  [
    'perdoar',
    1,
    (m, r) => {
      const candidatas = m.fatos.invoices.filter(
        (f) => contestada(f) && f.debtWaivedAt === null
      )
      if (candidatas.length === 0) return null
      const alvo = r.escolher(candidatas)
      alterar(m, alvo.id, { debtWaivedAt: meioDia(m.hoje) })
      return `perdão ${alvo.id}`
    },
  ],
  [
    'cortesia',
    1,
    (m, r) => {
      const complimentaryUntil = r.chance(0.3)
        ? null
        : somarDias(m.hoje, r.inteiro(0, 60))
      m.fatos = {
        ...m.fatos,
        billingMode: 'COMPLIMENTARY',
        complimentaryUntil,
      }
      return `cortesia até ${complimentaryUntil ?? 'sem prazo'}`
    },
  ],
  [
    'cancelamento',
    1,
    (m) => {
      const cancelAtPeriodEnd = !m.fatos.cancelAtPeriodEnd
      m.fatos = { ...m.fatos, cancelAtPeriodEnd }
      return cancelAtPeriodEnd ? 'dono pede cancelamento' : 'dono desiste'
    },
  ],
  [
    'job',
    2,
    (m) => {
      const sinal = derivarEstado(m.fatos, meioDia(m.hoje)).encerramentoDevido
      if (sinal === null || m.fatos.canceledAt !== null) return null
      m.fatos = { ...m.fatos, canceledAt: meioDia(m.hoje) }
      return `job encerra (${sinal})`
    },
  ],
]

const PESO_TOTAL = EVENTOS.reduce((soma, [, peso]) => soma + peso, 0)

function sortearEvento(r: Gerador): Evento {
  let alvo = r.inteiro(1, PESO_TOTAL)
  for (const [, peso, evento] of EVENTOS) {
    alvo -= peso
    if (alvo <= 0) return evento
  }
  throw new Error('peso inválido')
}

interface Transicao {
  readonly de: EstadoDaAssinatura | null
  readonly para: EstadoDaAssinatura
  readonly semente: number
  readonly rastro: readonly string[]
  /** Fatos e dia do recompute que produziu `para`. */
  readonly fatos: FatosDaAssinatura
  readonly hoje: DiaCivil
}

function simular(semente: number, passos: number): Transicao[] {
  const r = gerador(semente)
  const inicio = somarDias('2026-01-01', r.inteiro(0, 700))
  const mundo: Mundo = {
    hoje: inicio,
    proximoId: 1,
    rastro: [`semente ${semente}, início ${inicio}`],
    fatos: {
      billingMode: 'ASAAS',
      createdAt: meioDia(inicio),
      complimentaryUntil: null,
      trialEndsAt: r.chance(0.5)
        ? somarDias(inicio, r.escolher([7, 14, 30]))
        : null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      invoices: [],
    },
  }
  if (r.chance(0.15)) {
    const complimentaryUntil = r.chance(0.3)
      ? null
      : somarDias(inicio, r.inteiro(0, 90))
    mundo.fatos = {
      ...mundo.fatos,
      billingMode: 'COMPLIMENTARY',
      complimentaryUntil,
    }
    mundo.rastro.push(
      `nasce com cortesia até ${complimentaryUntil ?? 'sem prazo'}`
    )
  }
  if (mundo.fatos.trialEndsAt !== null) {
    mundo.rastro.push(`teste até ${mundo.fatos.trialEndsAt}`)
  }

  const transicoes: Transicao[] = []
  let anterior: EstadoDaAssinatura | null = null
  const recompute = (): void => {
    const { estado } = derivarEstado(mundo.fatos, meioDia(mundo.hoje))
    mundo.rastro.push(`${mundo.hoje}: ${estado}`)
    transicoes.push({
      de: anterior,
      para: estado,
      semente,
      rastro: [...mundo.rastro],
      fatos: mundo.fatos,
      hoje: mundo.hoje,
    })
    anterior = estado
  }

  recompute()
  for (let passo = 0; passo < passos; passo++) {
    const descricao = sortearEvento(r)(mundo, r)
    if (descricao === null) continue
    mundo.rastro.push(descricao)
    // Às vezes vários fatos chegam antes do próximo recompute.
    if (r.chance(0.75)) recompute()
  }
  recompute()
  return transicoes
}

function simularTudo(): Transicao[] {
  const todas: Transicao[] = []
  for (let semente = 1; semente <= 2500; semente++) {
    todas.push(...simular(semente, 80))
  }
  return todas
}

/** Uma simulação para todas as propriedades: os mesmos fatos, sementes fixas. */
const transicoes = simularTudo()

const chave = (de: EstadoDaAssinatura | null, para: EstadoDaAssinatura) =>
  `${de ?? '[*]'} → ${para}`

describe('transições produzidas por fatos legítimos', () => {
  it('toda transição entre dois recomputes consecutivos é permitida pela tabela (2500 sequências de 80 fatos, sementes fixas)', () => {
    const proibidas = transicoes.filter(
      (t) => !transicaoPermitida(t.de, t.para)
    )
    const exemplo = proibidas[0]
    expect(
      proibidas.map((t) => chave(t.de, t.para)),
      exemplo === undefined
        ? ''
        : `primeira proibida: ${chave(exemplo.de, exemplo.para)}\n${exemplo.rastro.join('\n')}`
    ).toEqual([])
  })

  it('o gerador exercita toda aresta da tabela e nenhuma aresta fica sem fato que a produza', () => {
    const vistas = new Set(
      transicoes.filter((t) => t.de !== t.para).map((t) => chave(t.de, t.para))
    )
    const permitidas = new Set<string>()
    for (const de of [null, ...ESTADOS_DA_ASSINATURA]) {
      for (const para of ESTADOS_DA_ASSINATURA) {
        if (de !== para && transicaoPermitida(de, para)) {
          permitidas.add(chave(de, para))
        }
      }
    }
    expect([...vistas].sort()).toEqual([...permitidas].sort())
  })
})

/**
 * Dias depois do recompute em que os mesmos fatos são derivados de novo, em
 * ordem crescente: o job age no primeiro sinal, então um sinal que some depois
 * de aparecer já encerrou a locadora cedo demais.
 */
const DIAS_A_FRENTE = [0, 1, 10, 20, 45] as const

/** Varrer todos os fatos gerados leva alguns segundos; folga para máquina ocupada. */
const PRAZO_DAS_PROPRIEDADES = 30_000

interface Serie {
  readonly transicao: Transicao
  readonly dias: readonly DiaCivil[]
  readonly sinais: readonly (MotivoDoEncerramento | null)[]
}

function relatar(violacoes: readonly string[][]): string {
  return violacoes[0]?.join('\n') ?? ''
}

describe('sinais e dívida com fatos legítimos', () => {
  const series: Serie[] = transicoes
    .filter((t) => t.fatos.canceledAt === null)
    .map((transicao) => {
      const dias = DIAS_A_FRENTE.map((n) => somarDias(transicao.hoje, n))
      const sinais = dias.map(
        (dia) => derivarEstado(transicao.fatos, meioDia(dia)).encerramentoDevido
      )
      return { transicao, dias, sinais }
    })

  it(
    'o sinal OWNER_REQUEST nunca sai antes do fim do período pago nem do fim da cortesia',
    () => {
      const violacoes: string[][] = []
      for (const { transicao, dias, sinais } of series) {
        const { currentPeriodEnd, complimentaryUntil, billingMode } =
          transicao.fatos
        dias.forEach((dia, i) => {
          if (sinais[i] !== 'OWNER_REQUEST') return
          const antesDoPeriodo =
            currentPeriodEnd !== null && compararDias(dia, currentPeriodEnd) < 0
          const antesDaCortesia =
            billingMode === 'COMPLIMENTARY' &&
            complimentaryUntil !== null &&
            compararDias(dia, complimentaryUntil) < 0
          if (antesDoPeriodo || antesDaCortesia) {
            violacoes.push([...transicao.rastro, `OWNER_REQUEST em ${dia}`])
          }
        })
      }
      expect(violacoes.length, relatar(violacoes)).toBe(0)
    },
    PRAZO_DAS_PROPRIEDADES
  )

  it(
    'com os mesmos fatos, um sinal de encerramento não some nos dias seguintes',
    () => {
      const violacoes: string[][] = []
      for (const { transicao, dias, sinais } of series) {
        const primeiro = sinais.findIndex((sinal) => sinal !== null)
        if (primeiro === -1) continue
        const sumiu = sinais.findIndex((s, i) => i > primeiro && s === null)
        if (sumiu !== -1) {
          violacoes.push([
            ...transicao.rastro,
            `${sinais[primeiro]} em ${dias[primeiro]}, nada em ${dias[sumiu]}`,
          ])
        }
      }
      expect(violacoes.length, relatar(violacoes)).toBe(0)
    },
    PRAZO_DAS_PROPRIEDADES
  )

  it(
    'a cortesia vencida não apaga dívida: mesmas faturas e mesmo valor em aberto que sem ela, com o atraso contado do dia seguinte a ela',
    () => {
      const violacoes: string[][] = []
      let comparadas = 0
      for (const { transicao } of series) {
        const { complimentaryUntil, billingMode } = transicao.fatos
        if (billingMode !== 'COMPLIMENTARY' || complimentaryUntil === null) {
          continue
        }
        const semCortesia: FatosDaAssinatura = {
          ...transicao.fatos,
          billingMode: 'ASAAS',
          complimentaryUntil: null,
        }
        for (const aFrente of [0, 10, 45]) {
          const dia = somarDias(transicao.hoje, aFrente)
          if (compararDias(dia, complimentaryUntil) <= 0) continue
          const sem = derivarEstado(semCortesia, meioDia(dia)).divida
          if (sem === null) continue
          comparadas++
          const com = derivarEstado(transicao.fatos, meioDia(dia)).divida
          const coerente =
            com !== null &&
            com.faturas.join() === sem.faturas.join() &&
            com.valorEmAberto.equals(sem.valorEmAberto) &&
            compararDias(com.desde, complimentaryUntil) > 0
          if (!coerente) {
            const obtido =
              com === null
                ? 'sem dívida'
                : `[${com.faturas.join()}] ${com.valorEmAberto.toFixed(2)} desde ${com.desde}`
            violacoes.push([
              ...transicao.rastro,
              `${dia}: sem a cortesia [${sem.faturas.join()}] ${sem.valorEmAberto.toFixed(2)}; com ela ${obtido}`,
            ])
          }
        }
      }
      expect(comparadas).toBeGreaterThan(1000)
      expect(violacoes.length, relatar(violacoes)).toBe(0)
    },
    PRAZO_DAS_PROPRIEDADES
  )
})
