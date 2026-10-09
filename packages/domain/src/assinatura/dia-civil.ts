/**
 * Dia civil `AAAA-MM-DD`, sem hora nem fuso. É a unidade de todas as regras de
 * prazo da assinatura (vencimento, teste, tolerância, pausa, encerramento).
 */
export type DiaCivil = string

/** Fuso em que a plataforma conta os dias (ADR de assinatura, B.5). */
export const FUSO_DA_PLATAFORMA = 'America/Sao_Paulo'

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_POR_DIA = 86_400_000

let formatadorDoFuso: Intl.DateTimeFormat | undefined

function formatador(): Intl.DateTimeFormat {
  formatadorDoFuso ??= new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_DA_PLATAFORMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatadorDoFuso
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0')
}

function montarDia(ano: number, mes: number, dia: number): DiaCivil {
  return `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`
}

function instanteValido(instante: Date): void {
  if (Number.isNaN(instante.getTime())) {
    throw new RangeError('Data inválida.')
  }
}

/** Número de dias desde 1970-01-01 (UTC). Lança `RangeError` para dia inexistente ou fora do formato. */
function paraNumeroDoDia(dia: DiaCivil): number {
  const partes = FORMATO_DIA.exec(dia)
  if (partes === null) {
    throw new RangeError(`Dia civil fora do formato AAAA-MM-DD: "${dia}".`)
  }
  const ano = Number(partes[1])
  const mes = Number(partes[2])
  const diaDoMes = Number(partes[3])
  const data = new Date(Date.UTC(ano, mes - 1, diaDoMes))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== diaDoMes
  ) {
    throw new RangeError(`Dia civil inexistente: "${dia}".`)
  }
  return data.getTime() / MS_POR_DIA
}

function deNumeroDoDia(numero: number): DiaCivil {
  const data = new Date(numero * MS_POR_DIA)
  return montarDia(
    data.getUTCFullYear(),
    data.getUTCMonth() + 1,
    data.getUTCDate()
  )
}

/** Confere o formato e a existência do dia; devolve o próprio dia. */
export function validarDiaCivil(dia: DiaCivil): DiaCivil {
  paraNumeroDoDia(dia)
  return dia
}

/**
 * Dia civil de um instante em America/Sao_Paulo. Use para colunas `DateTime`
 * (`createdAt`, `canceledAt`, `paidAt`, `chargebackAt`) e para o relógio.
 */
export function diaCivilEmSaoPaulo(instante: Date): DiaCivil {
  instanteValido(instante)
  let ano = 0
  let mes = 0
  let dia = 0
  for (const parte of formatador().formatToParts(instante)) {
    if (parte.type === 'year') ano = Number(parte.value)
    else if (parte.type === 'month') mes = Number(parte.value)
    else if (parte.type === 'day') dia = Number(parte.value)
  }
  return montarDia(ano, mes, dia)
}

/**
 * Dia civil de uma coluna `@db.Date` lida pelo Prisma, que chega como
 * meia-noite UTC. **Não** use `diaCivilEmSaoPaulo` nesses valores: em
 * São Paulo a meia-noite UTC ainda é o dia anterior.
 */
export function diaCivilDeColunaDate(valor: Date): DiaCivil {
  instanteValido(valor)
  return montarDia(
    valor.getUTCFullYear(),
    valor.getUTCMonth() + 1,
    valor.getUTCDate()
  )
}

export function somarDias(dia: DiaCivil, dias: number): DiaCivil {
  if (!Number.isInteger(dias)) {
    throw new RangeError('A quantidade de dias precisa ser inteira.')
  }
  return deNumeroDoDia(paraNumeroDoDia(dia) + dias)
}

/** `ate − desde` em dias civis (negativo quando `ate` vem antes). */
export function diferencaEmDias(ate: DiaCivil, desde: DiaCivil): number {
  return paraNumeroDoDia(ate) - paraNumeroDoDia(desde)
}

/** Negativo, zero ou positivo, como em `Array.prototype.sort`. */
export function compararDias(a: DiaCivil, b: DiaCivil): number {
  return diferencaEmDias(a, b)
}

export function menorDia(a: DiaCivil, b: DiaCivil): DiaCivil {
  return compararDias(a, b) <= 0 ? a : b
}

export function maiorDia(a: DiaCivil, b: DiaCivil): DiaCivil {
  return compararDias(a, b) >= 0 ? a : b
}
