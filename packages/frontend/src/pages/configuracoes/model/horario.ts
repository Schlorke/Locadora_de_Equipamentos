// Horário de funcionamento no painel (onda 134, lote vitrine-conteúdo, B10). O formulário trabalha com texto por dia e
// grava no campo `businessHours` das configurações, no formato que a leitura pública aceita
// (`PublicBusinessDaySchema`): dia fechado, ou aberto com abertura e fechamento HH:MM. Dia sem horário fica ausente
// (a vitrine não inventa horário). Horário antigo fora do formato é descartado ao carregar.
import {
  BUSINESS_DAYS,
  BUSINESS_TIME_FORMAT,
  PublicBusinessDaySchema,
  type BusinessDay,
  type PublicBusinessHours,
} from '@gb-locacoes/contracts/settings'

export interface DiaDoFormulario {
  readonly fechado: boolean
  readonly abre: string
  readonly fecha: string
}

export type HorarioDoFormulario = Record<BusinessDay, DiaDoFormulario>

export const DIAS_DO_HORARIO: ReadonlyArray<{
  chave: BusinessDay
  rotulo: string
}> = [
  { chave: 'monday', rotulo: 'Segunda-feira' },
  { chave: 'tuesday', rotulo: 'Terça-feira' },
  { chave: 'wednesday', rotulo: 'Quarta-feira' },
  { chave: 'thursday', rotulo: 'Quinta-feira' },
  { chave: 'friday', rotulo: 'Sexta-feira' },
  { chave: 'saturday', rotulo: 'Sábado' },
  { chave: 'sunday', rotulo: 'Domingo' },
]

const VAZIO: DiaDoFormulario = { fechado: false, abre: '', fecha: '' }

/** Horário gravado → formulário; dia fora do formato vira dia sem horário. */
export function horarioDoFormulario(raw: unknown): HorarioDoFormulario {
  const lido =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return Object.fromEntries(
    BUSINESS_DAYS.map((dia) => {
      const parsed = PublicBusinessDaySchema.safeParse(lido[dia])
      if (!parsed.success) return [dia, VAZIO]
      return [
        dia,
        parsed.data.closed
          ? { fechado: true, abre: '', fecha: '' }
          : {
              fechado: false,
              abre: parsed.data.open,
              fecha: parsed.data.close,
            },
      ]
    })
  ) as HorarioDoFormulario
}

/** Formulário → `businessHours` (só os dias informados) e o erro de cada dia inválido. */
export function horarioParaSalvar(form: HorarioDoFormulario): {
  horario: PublicBusinessHours
  erros: Partial<Record<BusinessDay, string>>
} {
  const horario: Record<string, unknown> = {}
  const erros: Partial<Record<BusinessDay, string>> = {}
  for (const dia of BUSINESS_DAYS) {
    const { fechado, abre, fecha } = form[dia]
    if (fechado) {
      horario[dia] = { closed: true }
      continue
    }
    const abertura = abre.trim()
    const fechamento = fecha.trim()
    if (!abertura && !fechamento) continue
    if (!abertura || !fechamento) {
      erros[dia] = 'Informe a abertura e o fechamento.'
      continue
    }
    if (
      !BUSINESS_TIME_FORMAT.test(abertura) ||
      !BUSINESS_TIME_FORMAT.test(fechamento)
    ) {
      erros[dia] = 'Use o formato HH:MM (00:00 a 23:59).'
      continue
    }
    if (fechamento <= abertura) {
      erros[dia] = 'O fechamento precisa ser depois da abertura.'
      continue
    }
    horario[dia] = { closed: false, open: abertura, close: fechamento }
  }
  return { horario: horario as PublicBusinessHours, erros }
}

/** Copia o horário de um dia para segunda a sexta (o fim de semana fica como está). */
export function copiarParaDiasUteis(
  form: HorarioDoFormulario,
  origem: BusinessDay
): HorarioDoFormulario {
  const copia = { ...form[origem] }
  return {
    ...form,
    monday: copia,
    tuesday: copia,
    wednesday: copia,
    thursday: copia,
    friday: copia,
  }
}
