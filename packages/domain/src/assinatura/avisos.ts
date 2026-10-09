import { derivarEstado, type FatosDaAssinatura } from './estado'
import { compararDias, diaCivilEmSaoPaulo, diferencaEmDias } from './dia-civil'
import { paraDecimal } from './dinheiro'
import type { PoliticaDeCobranca } from './politica'

export type AvisoDaAssinatura = {
  tipo: 'TESTE' | 'FATURA'
  passo: string
  dia: string
  faturaId: string | null
  vencimento: string
  valor: string | null
  pausaEm: string | null
  encerramentoEm: string | null
}

/** Reminders never derive a second state machine or alter the underlying debt. */
export function planejarAvisos(
  fatos: FatosDaAssinatura,
  agora: Date,
  politica?: PoliticaDeCobranca
): readonly AvisoDaAssinatura[] {
  if (fatos.canceledAt || fatos.billingMode === 'COMPLIMENTARY') return []
  const estado = derivarEstado(fatos, agora, politica)
  if (estado.encerramentoDevido) return []
  const dia = diaCivilEmSaoPaulo(agora)
  const avisos: AvisoDaAssinatura[] = []
  const cicloPagoAposTeste =
    fatos.trialEndsAt !== null &&
    fatos.invoices.some(
      (fatura) =>
        fatura.kind === 'CYCLE' &&
        fatura.status === 'PAID' &&
        fatura.periodEnd !== null &&
        compararDias(fatura.periodEnd, fatos.trialEndsAt!) >= 0
    )
  if (
    estado.estado === 'TRIALING' &&
    fatos.trialEndsAt &&
    !cicloPagoAposTeste
  ) {
    const faltam = diferencaEmDias(fatos.trialEndsAt, dia)
    if ([7, 3, 1, 0].includes(faltam))
      avisos.push({
        tipo: 'TESTE',
        passo: faltam ? 'D-' + faltam : 'D0',
        dia,
        faturaId: null,
        vencimento: fatos.trialEndsAt,
        valor: null,
        pausaEm: null,
        encerramentoEm: null,
      })
  }
  for (const fatura of fatos.invoices) {
    if (!['PENDING', 'OVERDUE'].includes(fatura.status)) continue
    const atraso = diferencaEmDias(dia, fatura.dueDate)
    if (![-5, 0, 1, 3, 6, 14, 21, 30].includes(atraso)) continue
    if (atraso > 0 && !estado.divida?.faturas.includes(fatura.id)) continue
    avisos.push({
      tipo: 'FATURA',
      passo: atraso > 0 ? 'D+' + atraso : 'D' + atraso,
      dia,
      faturaId: fatura.id,
      vencimento: fatura.dueDate,
      valor: paraDecimal(fatura.amount).toFixed(2),
      pausaEm: estado.divida?.pausaEm ?? null,
      encerramentoEm: estado.divida?.encerramentoEm ?? null,
    })
  }
  return avisos
}
