import Decimal from 'decimal.js'
import { compararDias, diaCivilEmSaoPaulo, validarDiaCivil } from './dia-civil'
import { paraDecimal } from './dinheiro'
import type { EstadoDaAssinatura, FaturaDaAssinatura } from './estado'

export interface AssinaturaEncerrada {
  readonly estado: EstadoDaAssinatura
  readonly invoices: readonly FaturaDaAssinatura[]
}

export type Reativacao =
  | { readonly reativavel: false; readonly motivo: 'ASSINATURA_NAO_ENCERRADA' }
  | {
      readonly reativavel: true
      /** A nova assinatura nasce sem teste e, sem fatura paga, em INCOMPLETE. */
      readonly estadoInicial: 'INCOMPLETE'
      /** Faturas vencidas da assinatura anterior: excluir no provedor e marcar CANCELED com `REACTIVATION_WAIVER`. */
      readonly faturasPerdoadas: readonly string[]
      readonly valorPerdoado: Decimal
    }

function vencida(fatura: FaturaDaAssinatura, hoje: string): boolean {
  if (fatura.status === 'OVERDUE') return true
  return fatura.status === 'PENDING' && compararDias(fatura.dueDate, hoje) < 0
}

/**
 * Reativação depois de CANCELED (ADR de assinatura, B.6): cria-se uma **nova**
 * assinatura, sem teste, e as faturas vencidas da anterior **não são cobradas**
 * (atraso perdoado). Vencida = OVERDUE ou PENDING com vencimento antes de hoje.
 * Estornos e chargebacks não entram: não podem ser excluídos no provedor.
 *
 * Só uma assinatura CANCELED é reativável.
 */
export function planejarReativacao(
  anterior: AssinaturaEncerrada,
  agora: Date
): Reativacao {
  if (anterior.estado !== 'CANCELED') {
    return { reativavel: false, motivo: 'ASSINATURA_NAO_ENCERRADA' }
  }
  const hoje = diaCivilEmSaoPaulo(agora)
  const perdoadas: string[] = []
  let valorPerdoado = new Decimal(0)
  const vistas = new Set<string>()
  for (const fatura of anterior.invoices) {
    validarDiaCivil(fatura.dueDate)
    if (vistas.has(fatura.id) || !vencida(fatura, hoje)) continue
    vistas.add(fatura.id)
    perdoadas.push(fatura.id)
    valorPerdoado = valorPerdoado.plus(paraDecimal(fatura.amount))
  }
  return {
    reativavel: true,
    estadoInicial: 'INCOMPLETE',
    faturasPerdoadas: perdoadas,
    valorPerdoado,
  }
}
