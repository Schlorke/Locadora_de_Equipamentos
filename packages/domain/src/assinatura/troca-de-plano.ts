import Decimal from 'decimal.js'
import { compararDias, diaCivilEmSaoPaulo, validarDiaCivil } from './dia-civil'
import type { DiaCivil } from './dia-civil'
import { paraDecimal } from './dinheiro'
import type { Dinheiro } from './dinheiro'
import type { EstadoDaAssinatura } from './estado'

/** Sentido da troca, decidido pelo catálogo de planos. */
export type SentidoDaTroca = 'UPGRADE' | 'DOWNGRADE'

export type MotivoDeTrocaRecusada =
  /** INCOMPLETE: a assinatura ainda não foi ativada; o plano é escolhido no cadastro. */
  | 'ASSINATURA_NAO_ATIVADA'
  /** Upgrade em PAST_DUE ou qualquer troca em SUSPENDED: quitar antes. */
  | 'DIVIDA_EM_ABERTO'
  /** CANCELED: reativar cria uma nova assinatura. */
  | 'ASSINATURA_ENCERRADA'

export interface PedidoDeTrocaDePlano {
  readonly estado: EstadoDaAssinatura
  readonly sentido: SentidoDaTroca
  /** Preço da versão de plano escolhida. */
  readonly valorNovo: Dinheiro
  /** `Subscription.currentPeriodEnd`; `null` sem período em curso. */
  readonly currentPeriodEnd: DiaCivil | null
}

export type TrocaDePlano =
  | { readonly permitida: false; readonly motivo: MotivoDeTrocaRecusada }
  | {
      readonly permitida: true
      readonly sentido: SentidoDaTroca
      /** Dia em que os limites e módulos do plano novo passam a valer. */
      readonly limitesNovosValemEm: DiaCivil
      /** Downgrade com período em curso: grava `scheduledPlanVersionId` e `scheduledChangeAt`. */
      readonly agendada: boolean
      /** A próxima fatura já sai com o preço cheio do plano novo. */
      readonly valorDaProximaFatura: Decimal
      /** Sem pró-rata: nenhuma cobrança nem crédito proporcional, sempre zero. */
      readonly ajusteProporcional: Decimal
    }

const ESTADOS_DO_UPGRADE: readonly EstadoDaAssinatura[] = ['TRIALING', 'ACTIVE']
const ESTADOS_DO_DOWNGRADE: readonly EstadoDaAssinatura[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
]

function motivoDaRecusa(estado: EstadoDaAssinatura): MotivoDeTrocaRecusada {
  if (estado === 'INCOMPLETE') return 'ASSINATURA_NAO_ATIVADA'
  if (estado === 'CANCELED') return 'ASSINATURA_ENCERRADA'
  return 'DIVIDA_EM_ABERTO'
}

/**
 * Troca de plano **sem pró-rata** (ADR de assinatura, D14 e B.6):
 *
 * - upgrade só em TRIALING ou ACTIVE; limites novos na hora e preço novo a
 *   partir da próxima fatura;
 * - downgrade vale no fim do período (`currentPeriodEnd`); sem período em
 *   curso, vale na hora; o preço novo vai para a fatura do próximo período;
 * - em SUSPENDED, a troca só depois de quitar; CANCELED reativa com nova
 *   assinatura;
 * - nunca há cobrança nem crédito proporcional.
 *
 * Pura: `agora` é convertido para o dia civil de São Paulo.
 */
export function planejarTrocaDePlano(
  pedido: PedidoDeTrocaDePlano,
  agora: Date
): TrocaDePlano {
  const hoje = diaCivilEmSaoPaulo(agora)
  const valorNovo = paraDecimal(pedido.valorNovo)
  if (valorNovo.isNegative()) {
    throw new RangeError('O preço do plano não pode ser negativo.')
  }
  if (pedido.currentPeriodEnd !== null) validarDiaCivil(pedido.currentPeriodEnd)

  const permitidos =
    pedido.sentido === 'UPGRADE' ? ESTADOS_DO_UPGRADE : ESTADOS_DO_DOWNGRADE
  if (!permitidos.includes(pedido.estado)) {
    return { permitida: false, motivo: motivoDaRecusa(pedido.estado) }
  }

  const fimDoPeriodo = pedido.currentPeriodEnd
  let limitesNovosValemEm = hoje
  if (
    pedido.sentido === 'DOWNGRADE' &&
    fimDoPeriodo !== null &&
    compararDias(fimDoPeriodo, hoje) > 0
  ) {
    limitesNovosValemEm = fimDoPeriodo
  }
  return {
    permitida: true,
    sentido: pedido.sentido,
    limitesNovosValemEm,
    agendada: limitesNovosValemEm !== hoje,
    valorDaProximaFatura: valorNovo,
    ajusteProporcional: new Decimal(0),
  }
}
