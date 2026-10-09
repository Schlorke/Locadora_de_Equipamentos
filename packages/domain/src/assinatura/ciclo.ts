import { somarDias, validarDiaCivil } from './dia-civil'

/** Monthly cycles are civil dates; the end is the day before the next anniversary. */
export function periodoMensal(vencimento: string) {
  validarDiaCivil(vencimento)
  const start = new Date(vencimento + 'T00:00:00Z')
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)
  )
  const next = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      Math.min(start.getUTCDate(), last.getUTCDate())
    )
  )
  return {
    periodStart: vencimento,
    periodEnd: somarDias(next.toISOString().slice(0, 10), -1),
  }
}
