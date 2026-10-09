import Decimal from 'decimal.js'
import {
  compararDias,
  diaCivilEmSaoPaulo,
  diferencaEmDias,
  maiorDia,
  menorDia,
  somarDias,
  validarDiaCivil,
} from './dia-civil'
import type { DiaCivil } from './dia-civil'
import { paraDecimal } from './dinheiro'
import type { Dinheiro } from './dinheiro'
import { POLITICA_COMERCIAL_PADRAO, validarPolitica } from './politica'
import type { PoliticaDeCobranca } from './politica'

/** Os seis estados da assinatura (ADR de assinatura, D6). */
export type EstadoDaAssinatura =
  'INCOMPLETE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED'

export const ESTADOS_DA_ASSINATURA: readonly EstadoDaAssinatura[] =
  Object.freeze([
    'INCOMPLETE',
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
  ])

/** Projeção gravada em `Organization.access`. */
export type AcessoDaOrganizacao = 'SETUP' | 'FULL' | 'RESTRICTED' | 'ARCHIVED'

export type ModoDeCobranca = 'ASAAS' | 'COMPLIMENTARY'
export type TipoDeFatura = 'CYCLE' | 'ADJUSTMENT'
export type StatusDaFatura =
  'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'REFUNDED' | 'CHARGEBACK'

/** Motivo do sinal `CANCEL_DUE`, gravado em `Subscription.cancelReason` pelo job. */
export type MotivoDoEncerramento =
  'OWNER_REQUEST' | 'NON_PAYMENT' | 'TRIAL_EXPIRED' | 'ABANDONED'

/** Regra de `derivarEstado` que decidiu o estado (B.5, na ordem de avaliação). */
export type RegraDoEstado =
  'CANCELADA' | 'CORTESIA' | 'DIVIDA' | 'TESTE' | 'FATURA_PAGA' | 'INCOMPLETA'

/**
 * Fatos de uma `PlatformInvoice`. Os nomes são os das colunas; colunas
 * `@db.Date` chegam como `DiaCivil` (use `diaCivilDeColunaDate`), colunas
 * `DateTime` como `Date`.
 */
export interface FaturaDaAssinatura {
  readonly id: string
  readonly kind: TipoDeFatura
  readonly status: StatusDaFatura
  readonly amount: Dinheiro
  readonly dueDate: DiaCivil
  /**
   * Último dia do período que a fatura cobre. Decide se um ciclo cobre os dias
   * depois de uma cortesia; sem ele, vale o vencimento (a mensalidade é
   * cobrada adiantada).
   */
  readonly periodEnd: DiaCivil | null
  readonly paidAt: Date | null
  readonly chargebackAt: Date | null
  readonly voluntaryRefund: boolean
  /**
   * Só em fatura `ADJUSTMENT`: a fatura contestada (chargeback ou estorno
   * involuntário) que este ajuste quita quando pago.
   */
  readonly settlesInvoiceId: string | null
  /** Perdão explícito da equipe para a dívida de um chargeback ou estorno involuntário. */
  readonly debtWaivedAt: Date | null
}

/** Fatos de uma `Subscription` que decidem o estado. */
export interface FatosDaAssinatura {
  readonly billingMode: ModoDeCobranca
  readonly createdAt: Date
  readonly complimentaryUntil: DiaCivil | null
  readonly trialEndsAt: DiaCivil | null
  readonly currentPeriodEnd: DiaCivil | null
  readonly cancelAtPeriodEnd: boolean
  readonly canceledAt: Date | null
  readonly invoices: readonly FaturaDaAssinatura[]
}

/** Dívida que decidiu PAST_DUE ou SUSPENDED. Os dias são contados a partir de 1. */
export interface DividaDaAssinatura {
  /**
   * Primeiro dia em atraso (dia 1): vencimento + 1, dia do chargeback ou dia
   * seguinte ao fim do teste ou da cortesia; nunca antes do dia seguinte ao fim
   * de uma cortesia. Vai para `pastDueSince`.
   */
  readonly desde: DiaCivil
  /** Dia de atraso em que `hoje` está (1 no primeiro dia). */
  readonly diasEmAtraso: number
  /** Último dia de tolerância com tudo funcionando. Vai para `graceEndsAt`. */
  readonly toleranciaAte: DiaCivil
  /** Primeiro dia em pausa (SUSPENDED). */
  readonly pausaEm: DiaCivil
  /** Dia em que aparece o sinal de encerramento por falta de pagamento. */
  readonly encerramentoEm: DiaCivil
  /**
   * Soma das faturas que compõem a dívida. Numa fatura contestada, descontam-se
   * os ajustes vinculados já pagos ou já na dívida: o mesmo valor não conta duas
   * vezes.
   */
  readonly valorEmAberto: Decimal
  /** Faturas que compõem a dívida, na ordem recebida. */
  readonly faturas: readonly string[]
}

export interface EstadoDerivado {
  readonly estado: EstadoDaAssinatura
  readonly acesso: AcessoDaOrganizacao
  readonly regra: RegraDoEstado
  /** Dia civil em São Paulo usado na derivação. */
  readonly hoje: DiaCivil
  /**
   * Sinal `CANCEL_DUE`: o job grava `canceledAt` com este motivo e desativa a
   * assinatura no provedor. Enquanto isso, o estado continua o dos fatos.
   */
  readonly encerramentoDevido: MotivoDoEncerramento | null
  readonly divida: DividaDaAssinatura | null
}

/** Projeção do estado no acesso da organização (D6). */
export function projetarAcesso(
  estado: EstadoDaAssinatura
): AcessoDaOrganizacao {
  switch (estado) {
    case 'INCOMPLETE':
      return 'SETUP'
    case 'TRIALING':
    case 'ACTIVE':
    case 'PAST_DUE':
      return 'FULL'
    case 'SUSPENDED':
      return 'RESTRICTED'
    case 'CANCELED':
      return 'ARCHIVED'
  }
}

/**
 * Transições do diagrama de estados (B.5): toda transição que `derivarEstado`
 * produz entre dois recomputes a partir de fatos legítimos, inclusive os saltos
 * de uma queda do cron (`ACTIVE → SUSPENDED`), de fatos que chegam juntos
 * (pagamento e chargeback antes do recompute: `INCOMPLETE → PAST_DUE`), da
 * quitação da dívida mais antiga (`SUSPENDED → PAST_DUE`) e do fim de uma
 * cortesia mais curta que o teste (`ACTIVE → TRIALING`). Nada volta para
 * `INCOMPLETE`, e `CANCELED` é terminal.
 */
export const TRANSICOES_DA_ASSINATURA: Readonly<
  Record<EstadoDaAssinatura, readonly EstadoDaAssinatura[]>
> = Object.freeze({
  INCOMPLETE: Object.freeze([
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
  ] as const),
  TRIALING: Object.freeze([
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
  ] as const),
  ACTIVE: Object.freeze([
    'TRIALING',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED',
  ] as const),
  PAST_DUE: Object.freeze([
    'TRIALING',
    'ACTIVE',
    'SUSPENDED',
    'CANCELED',
  ] as const),
  SUSPENDED: Object.freeze([
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
  ] as const),
  CANCELED: Object.freeze([] as const),
})

/** Estados em que uma assinatura nasce (setas saindo de `[*]`). */
export const ESTADOS_INICIAIS: readonly EstadoDaAssinatura[] = Object.freeze([
  'TRIALING',
  'INCOMPLETE',
  'ACTIVE',
])

/**
 * Verdadeiro se o diagrama permite ir de `de` para `para`. `de = null` é a
 * criação da assinatura. Permanecer no mesmo estado não é transição e é
 * permitido. Uma transição proibida não deve ser aplicada: vira alerta.
 */
export function transicaoPermitida(
  de: EstadoDaAssinatura | null,
  para: EstadoDaAssinatura
): boolean {
  if (de === null) return ESTADOS_INICIAIS.includes(para)
  if (de === para) return true
  return TRANSICOES_DA_ASSINATURA[de].includes(para)
}

function mesmoInstante(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null)
}

function mesmosFatos(a: FaturaDaAssinatura, b: FaturaDaAssinatura): boolean {
  return (
    a.kind === b.kind &&
    a.status === b.status &&
    paraDecimal(a.amount).equals(paraDecimal(b.amount)) &&
    a.dueDate === b.dueDate &&
    a.periodEnd === b.periodEnd &&
    mesmoInstante(a.paidAt, b.paidAt) &&
    mesmoInstante(a.chargebackAt, b.chargebackAt) &&
    a.voluntaryRefund === b.voluntaryRefund &&
    a.settlesInvoiceId === b.settlesInvoiceId &&
    mesmoInstante(a.debtWaivedAt, b.debtWaivedAt)
  )
}

/**
 * A mesma fatura repetida (evento duplicado) conta uma vez. Duas versões
 * diferentes da mesma fatura são fatos contraditórios: lança erro, e o
 * `recompute` vira alerta em vez de gravar um estado errado.
 */
function faturasUnicas(
  faturas: readonly FaturaDaAssinatura[]
): FaturaDaAssinatura[] {
  const porId = new Map<string, FaturaDaAssinatura>()
  const unicas: FaturaDaAssinatura[] = []
  for (const fatura of faturas) {
    validarDiaCivil(fatura.dueDate)
    if (fatura.periodEnd !== null) validarDiaCivil(fatura.periodEnd)
    paraDecimal(fatura.amount)
    const anterior = porId.get(fatura.id)
    if (anterior === undefined) {
      porId.set(fatura.id, fatura)
      unicas.push(fatura)
    } else if (!mesmosFatos(anterior, fatura)) {
      throw new Error(`Fatos contraditórios para a fatura ${fatura.id}.`)
    }
  }
  return unicas
}

/** A fatura foi paga em algum momento, mesmo que depois estornada ou contestada. */
function foiPagaAlgumaVez(fatura: FaturaDaAssinatura): boolean {
  return (
    fatura.paidAt !== null ||
    fatura.status === 'PAID' ||
    fatura.status === 'REFUNDED' ||
    fatura.status === 'CHARGEBACK'
  )
}

/** Chargeback ou estorno involuntário: dívida sem cobrança aberta no provedor. */
function contestada(fatura: FaturaDaAssinatura): boolean {
  return (
    fatura.status === 'CHARGEBACK' ||
    (fatura.status === 'REFUNDED' && !fatura.voluntaryRefund)
  )
}

/** Fatos de quitação das faturas contestadas (B.5, decisões padrão). */
interface Quitacoes {
  /** Soma dos ajustes `ADJUSTMENT` pagos, por fatura vinculada (`settlesInvoiceId`). */
  readonly pagoPorAjustes: ReadonlyMap<string, Decimal>
  /** Faturas contestadas quitadas: perdão da equipe ou ajustes pagos que cobrem o valor. */
  readonly quitadas: ReadonlySet<string>
}

function apurarQuitacoes(faturas: readonly FaturaDaAssinatura[]): Quitacoes {
  const pagoPorAjustes = new Map<string, Decimal>()
  for (const fatura of faturas) {
    if (
      fatura.kind !== 'ADJUSTMENT' ||
      fatura.status !== 'PAID' ||
      fatura.settlesInvoiceId === null
    ) {
      continue
    }
    const anterior = pagoPorAjustes.get(fatura.settlesInvoiceId)
    const valor = paraDecimal(fatura.amount)
    pagoPorAjustes.set(
      fatura.settlesInvoiceId,
      anterior === undefined ? valor : anterior.plus(valor)
    )
  }
  const quitadas = new Set<string>()
  for (const fatura of faturas) {
    if (!contestada(fatura)) continue
    const pago = pagoPorAjustes.get(fatura.id)
    if (
      fatura.debtWaivedAt !== null ||
      (pago !== undefined && pago.gte(paraDecimal(fatura.amount)))
    ) {
      quitadas.add(fatura.id)
    }
  }
  return { pagoPorAjustes, quitadas }
}

/**
 * Paga hoje: `PAID`, estornada por decisão da plataforma (estorno voluntário
 * não vira dívida) ou contestada e depois quitada.
 */
function quitada(fatura: FaturaDaAssinatura, quitacoes: Quitacoes): boolean {
  return (
    fatura.status === 'PAID' ||
    (fatura.status === 'REFUNDED' && fatura.voluntaryRefund) ||
    quitacoes.quitadas.has(fatura.id)
  )
}

/**
 * A fatura cobre dias depois do último dia da cortesia: período que termina
 * depois dele ou, sem `periodEnd`, vencimento no último dia da cortesia ou
 * depois (a mensalidade é cobrada adiantada).
 */
function passaDoFimDaCortesia(
  fatura: FaturaDaAssinatura,
  fimDaCortesia: DiaCivil
): boolean {
  return fatura.periodEnd === null
    ? compararDias(fatura.dueDate, fimDaCortesia) >= 0
    : compararDias(fatura.periodEnd, fimDaCortesia) > 0
}

/**
 * Último dia do período que a locadora já tem ao pedir o cancelamento: o maior
 * entre o período pago (`currentPeriodEnd`) e a cortesia (`complimentaryUntil`,
 * só com `billingMode = COMPLIMENTARY`). Cortesia sem prazo não marca fim.
 * `null` sem nenhum dos dois: o pedido vale na hora.
 */
function fimDoPeriodoEmCurso(fatos: FatosDaAssinatura): DiaCivil | null {
  const fimDaCortesia =
    fatos.billingMode === 'COMPLIMENTARY' ? fatos.complimentaryUntil : null
  if (fimDaCortesia === null) return fatos.currentPeriodEnd
  if (fatos.currentPeriodEnd === null) return fimDaCortesia
  return maiorDia(fimDaCortesia, fatos.currentPeriodEnd)
}

/**
 * Primeiro dia em atraso de uma fatura, ou `null` se ela não é dívida hoje.
 * Um status do provedor à frente do relógio (OVERDUE antes do dia seguinte ao
 * vencimento, chargeback com data futura) conta a partir de hoje. Chargeback e
 * estorno involuntário quitados deixam de ser dívida.
 */
function inicioDoAtraso(
  fatura: FaturaDaAssinatura,
  hoje: DiaCivil,
  quitacoes: Quitacoes
): DiaCivil | null {
  const diaSeguinteAoVencimento = somarDias(fatura.dueDate, 1)
  switch (fatura.status) {
    case 'OVERDUE':
      return menorDia(diaSeguinteAoVencimento, hoje)
    case 'PENDING':
      return compararDias(diaSeguinteAoVencimento, hoje) <= 0
        ? diaSeguinteAoVencimento
        : null
    case 'CHARGEBACK':
      if (quitacoes.quitadas.has(fatura.id)) return null
      return menorDia(
        fatura.chargebackAt === null
          ? diaSeguinteAoVencimento
          : diaCivilEmSaoPaulo(fatura.chargebackAt),
        hoje
      )
    case 'REFUNDED':
      return fatura.voluntaryRefund || quitacoes.quitadas.has(fatura.id)
        ? null
        : menorDia(diaSeguinteAoVencimento, hoje)
    case 'PAID':
    case 'CANCELED':
      return null
  }
}

function derivarDivida(
  fatos: FatosDaAssinatura,
  faturas: readonly FaturaDaAssinatura[],
  hoje: DiaCivil,
  politica: PoliticaDeCobranca,
  quitacoes: Quitacoes,
  fimDaCortesia: DiaCivil | null
): DividaDaAssinatura | null {
  // Depois de uma cortesia vencida, toda contagem recomeça no dia seguinte a
  // ela: os dias da cortesia não são atraso. A cortesia não apaga dívida; só
  // fato auditado a apaga (fatura cancelada no provedor, ajuste pago, perdão).
  const retomada = fimDaCortesia === null ? null : somarDias(fimDaCortesia, 1)
  const naDivida: { fatura: FaturaDaAssinatura; inicio: DiaCivil }[] = []
  for (const fatura of faturas) {
    const inicio = inicioDoAtraso(fatura, hoje, quitacoes)
    if (inicio === null) continue
    naDivida.push({
      fatura,
      inicio: retomada === null ? inicio : maiorDia(inicio, retomada),
    })
  }

  // Ajustes vinculados já na dívida carregam parte do valor da fatura contestada.
  const vinculadosNaDivida = new Map<string, Decimal>()
  for (const { fatura } of naDivida) {
    if (fatura.kind !== 'ADJUSTMENT' || fatura.settlesInvoiceId === null) {
      continue
    }
    const anterior = vinculadosNaDivida.get(fatura.settlesInvoiceId)
    const valor = paraDecimal(fatura.amount)
    vinculadosNaDivida.set(
      fatura.settlesInvoiceId,
      anterior === undefined ? valor : anterior.plus(valor)
    )
  }

  let desde: DiaCivil | null = null
  let valorEmAberto = new Decimal(0)
  const idsDaDivida: string[] = []
  for (const { fatura, inicio } of naDivida) {
    desde = desde === null ? inicio : menorDia(desde, inicio)
    let valor = paraDecimal(fatura.amount)
    if (contestada(fatura)) {
      const abatido = (
        quitacoes.pagoPorAjustes.get(fatura.id) ?? new Decimal(0)
      ).plus(vinculadosNaDivida.get(fatura.id) ?? new Decimal(0))
      valor = Decimal.max(0, valor.minus(abatido))
    }
    valorEmAberto = valorEmAberto.plus(valor)
    idsDaDivida.push(fatura.id)
  }

  // Fim do acesso gratuito sem ciclo pago: o teste, ou a cortesia vencida. Um
  // teste que terminou até o fim da cortesia foi coberto por ela.
  const fimDoTeste = fatos.trialEndsAt
  const fimDoAcessoGratuito =
    fimDoTeste !== null &&
    (fimDaCortesia === null || compararDias(fimDoTeste, fimDaCortesia) > 0)
      ? fimDoTeste
      : fimDaCortesia
  if (
    fimDoAcessoGratuito !== null &&
    compararDias(fimDoAcessoGratuito, hoje) < 0 &&
    !faturas.some(
      (fatura) =>
        fatura.kind === 'CYCLE' &&
        foiPagaAlgumaVez(fatura) &&
        (fimDaCortesia === null || passaDoFimDaCortesia(fatura, fimDaCortesia))
    )
  ) {
    const inicio = somarDias(fimDoAcessoGratuito, 1)
    desde = desde === null ? inicio : menorDia(desde, inicio)
  }

  if (desde === null) return null
  return {
    desde,
    diasEmAtraso: diferencaEmDias(hoje, desde) + 1,
    toleranciaAte: somarDias(desde, politica.graceDays - 1),
    pausaEm: somarDias(desde, politica.graceDays),
    encerramentoEm: somarDias(
      desde,
      politica.graceDays + politica.suspendDays - 1
    ),
    valorEmAberto,
    faturas: idsDaDivida,
  }
}

/**
 * Deriva o estado da assinatura a partir dos fatos (ADR de assinatura, B.5).
 * Pura: o relógio é injetado (`agora`) e convertido para o dia civil de
 * America/Sao_Paulo. Regras, nesta ordem:
 *
 * 1. `canceledAt` definido → CANCELED.
 * 2. Cortesia sem prazo ou com `complimentaryUntil` ≥ hoje → ACTIVE, com o
 *    sinal da regra 3.
 * 3. `cancelAtPeriodEnd` e hoje ≥ fim do período em curso → sinal
 *    `OWNER_REQUEST`; o estado segue as regras até o job encerrar. O fim do
 *    período é o maior entre `currentPeriodEnd` e o fim da cortesia; cortesia
 *    sem prazo não marca fim; sem nenhum dos dois, o sinal é imediato.
 * 4. Dívida, só para quem já pagou alguma vez, teve teste ou teve cortesia.
 *    Entram fatura OVERDUE, PENDING vencida, CHARGEBACK (desde `chargebackAt`)
 *    e REFUNDED involuntário não quitados (ajuste vinculado pago ou perdão da
 *    equipe), e o fim do teste ou da cortesia sem fatura CYCLE paga que cubra
 *    os dias seguintes. Depois de uma cortesia vencida, a contagem recomeça em
 *    `complimentaryUntil + 1`: os dias dela não são atraso, mas a dívida
 *    anterior continua inteira. Com o dia de atraso `n` (1 no primeiro dia):
 *    `n ≤ graceDays` → PAST_DUE; depois → SUSPENDED;
 *    `n ≥ graceDays + suspendDays` → sinal `NON_PAYMENT` (ou `TRIAL_EXPIRED`
 *    se nunca pagou). Padrão: tolerância até o 7º dia, pausa no 8º,
 *    encerramento no 37º.
 * 5. `trialEndsAt` ≥ hoje → TRIALING.
 * 6. Alguma fatura CYCLE quitada (depois de uma cortesia, que cubra os dias
 *    seguintes a ela) → ACTIVE.
 * 7. Senão INCOMPLETE; depois de `incompleteDays` dias (contados da criação,
 *    ou do fim de uma cortesia vencida) → sinal `ABANDONED`.
 *
 * O resultado não depende da ordem das faturas, e a mesma fatura repetida
 * conta uma vez. Lança erro para fatos inválidos (dia inexistente, valor não
 * decimal, política fora dos limites, versões contraditórias da mesma fatura).
 */
export function derivarEstado(
  fatos: FatosDaAssinatura,
  agora: Date,
  politica: PoliticaDeCobranca = POLITICA_COMERCIAL_PADRAO
): EstadoDerivado {
  validarPolitica(politica)
  const hoje = diaCivilEmSaoPaulo(agora)
  const faturas = faturasUnicas(fatos.invoices)
  for (const dia of [
    fatos.complimentaryUntil,
    fatos.trialEndsAt,
    fatos.currentPeriodEnd,
  ]) {
    if (dia !== null) validarDiaCivil(dia)
  }

  const resultado = (
    estado: EstadoDaAssinatura,
    regra: RegraDoEstado,
    encerramentoDevido: MotivoDoEncerramento | null,
    divida: DividaDaAssinatura | null
  ): EstadoDerivado => ({
    estado,
    acesso: projetarAcesso(estado),
    regra,
    hoje,
    encerramentoDevido,
    divida,
  })

  // 1. Encerrada é terminal.
  if (fatos.canceledAt !== null)
    return resultado('CANCELED', 'CANCELADA', null, null)

  // 3. Cancelamento pedido pelo dono, no fim do período que ele já tem (pago
  // ou de cortesia). Vale também na cortesia vigente (regra 2).
  const fimDoPeriodo = fimDoPeriodoEmCurso(fatos)
  const pedidoDoDono: MotivoDoEncerramento | null =
    fatos.cancelAtPeriodEnd &&
    (fimDoPeriodo === null || compararDias(hoje, fimDoPeriodo) >= 0)
      ? 'OWNER_REQUEST'
      : null

  // 2. Cortesia vigente.
  if (
    fatos.billingMode === 'COMPLIMENTARY' &&
    (fatos.complimentaryUntil === null ||
      compararDias(fatos.complimentaryUntil, hoje) >= 0)
  ) {
    return resultado('ACTIVE', 'CORTESIA', pedidoDoDono, null)
  }

  // Daqui em diante, uma cortesia sempre tem prazo vencido: o dia seguinte ao
  // fim dela é o novo ponto de partida de toda contagem.
  const fimDaCortesia =
    fatos.billingMode === 'COMPLIMENTARY' ? fatos.complimentaryUntil : null

  // 4. Dívida: só para quem já pagou alguma vez, teve teste ou teve cortesia.
  const quitacoes = apurarQuitacoes(faturas)
  const jaPagou = faturas.some(foiPagaAlgumaVez)
  if (jaPagou || fatos.trialEndsAt !== null || fimDaCortesia !== null) {
    const divida = derivarDivida(
      fatos,
      faturas,
      hoje,
      politica,
      quitacoes,
      fimDaCortesia
    )
    if (divida !== null) {
      const estado =
        divida.diasEmAtraso <= politica.graceDays ? 'PAST_DUE' : 'SUSPENDED'
      const venceuOPrazo =
        divida.diasEmAtraso >= politica.graceDays + politica.suspendDays
      const falta: MotivoDoEncerramento | null = venceuOPrazo
        ? jaPagou
          ? 'NON_PAYMENT'
          : 'TRIAL_EXPIRED'
        : null
      return resultado(estado, 'DIVIDA', pedidoDoDono ?? falta, divida)
    }
  }

  // 5. Em teste.
  if (
    fatos.trialEndsAt !== null &&
    compararDias(fatos.trialEndsAt, hoje) >= 0
  ) {
    return resultado('TRIALING', 'TESTE', pedidoDoDono, null)
  }

  // 6. Paga: ciclo quitado que, depois de uma cortesia, cobre os dias seguintes a ela.
  if (
    faturas.some(
      (fatura) =>
        fatura.kind === 'CYCLE' &&
        quitada(fatura, quitacoes) &&
        (fimDaCortesia === null || passaDoFimDaCortesia(fatura, fimDaCortesia))
    )
  ) {
    return resultado('ACTIVE', 'FATURA_PAGA', pedidoDoDono, null)
  }

  // 7. Incompleta; abandono depois de incompleteDays.
  const criadaEm = diaCivilEmSaoPaulo(fatos.createdAt)
  const inicio =
    fimDaCortesia === null
      ? criadaEm
      : maiorDia(criadaEm, somarDias(fimDaCortesia, 1))
  const abandonada = diferencaEmDias(hoje, inicio) >= politica.incompleteDays
  return resultado(
    'INCOMPLETE',
    'INCOMPLETA',
    pedidoDoDono ?? (abandonada ? 'ABANDONED' : null),
    null
  )
}
