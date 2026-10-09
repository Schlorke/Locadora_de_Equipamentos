// Horário de funcionamento da locadora em texto da vitrine (achado 147). Funções puras: os dias seguidos com o mesmo
// horário formam uma faixa ("Segunda a Sexta: 8h às 18h", "Seg-Sex: 8h às 18h"); o dia sem dado fica de fora.
import {
  BUSINESS_DAYS,
  type BusinessDay,
  type PublicBusinessDay,
  type PublicBusinessHours,
} from '@gb-locacoes/contracts/settings'

const NOMES: Readonly<Record<BusinessDay, readonly [string, string]>> = {
  monday: ['Segunda', 'Seg'],
  tuesday: ['Terça', 'Ter'],
  wednesday: ['Quarta', 'Qua'],
  thursday: ['Quinta', 'Qui'],
  friday: ['Sexta', 'Sex'],
  saturday: ['Sábado', 'Sáb'],
  sunday: ['Domingo', 'Dom'],
}

export interface FaixaDoHorario {
  /** "Segunda a Sexta", "Sábado e Domingo", "Sábado". */
  readonly dias: string
  /** "Seg-Sex", "Sáb-Dom", "Sáb". */
  readonly diasCurto: string
  /** "8h às 18h"; `null` quando a locadora fica fechada nesses dias. */
  readonly horario: string | null
}

/** "08:00" → "8h"; "08:30" → "8h30". */
export function horaDaVitrine(valor: string): string {
  const [hora = '0', minuto = '00'] = valor.split(':')
  return `${Number(hora)}h${minuto === '00' ? '' : minuto}`
}

const horarioDoDia = (dia: PublicBusinessDay): string | null =>
  dia.closed
    ? null
    : `${horaDaVitrine(dia.open)} às ${horaDaVitrine(dia.close)}`

/** Faixas de segunda a domingo; sem horário informado, nenhuma. */
export function faixasDoHorario(
  horario: PublicBusinessHours | null | undefined
): FaixaDoHorario[] {
  if (!horario) return []
  const grupos: Array<{ dias: BusinessDay[]; horario: string | null }> = []
  let anterior: BusinessDay | null = null
  for (const dia of BUSINESS_DAYS) {
    const valor = horario[dia]
    if (!valor) {
      anterior = null
      continue
    }
    const texto = horarioDoDia(valor)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && anterior && ultimo.horario === texto) ultimo.dias.push(dia)
    else grupos.push({ dias: [dia], horario: texto })
    anterior = dia
  }
  return grupos.map(({ dias, horario: texto }) => {
    const [primeiro, ultimo] = [dias[0]!, dias[dias.length - 1]!]
    const [longoInicio, curtoInicio] = NOMES[primeiro]
    const [longoFim, curtoFim] = NOMES[ultimo]
    return {
      dias:
        dias.length === 1
          ? longoInicio
          : `${longoInicio} ${dias.length === 2 ? 'e' : 'a'} ${longoFim}`,
      diasCurto: dias.length === 1 ? curtoInicio : `${curtoInicio}-${curtoFim}`,
      horario: texto,
    }
  })
}

/** Linha de uma faixa: "Segunda a Sexta: 8h às 18h" (longo), "Seg-Sex: 8h às 18h" (curto), "Domingo: Fechado". */
export function linhaDaFaixa(
  faixa: FaixaDoHorario,
  formato: 'longo' | 'curto'
): string {
  return `${formato === 'curto' ? faixa.diasCurto : faixa.dias}: ${faixa.horario ?? 'Fechado'}`
}
