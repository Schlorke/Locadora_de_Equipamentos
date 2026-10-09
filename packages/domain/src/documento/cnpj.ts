import { normalizarDocumento, todosCaracteresIguais } from './normalizacao'

/**
 * CNPJ normalizado (numérico ou alfanumérico): 12 posições com dígitos ou
 * letras maiúsculas (raiz e ordem) e 2 dígitos verificadores numéricos. É o
 * mesmo formato de `Organization.documentNormalized` no ADR de assinatura.
 */
export const FORMATO_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/

const BASE_CNPJ = /^[0-9A-Z]{12}$/

/** Pesos do módulo 11: o 1º dígito usa os 12 últimos, o 2º usa os 13. */
const PESOS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

/** Regra da Receita Federal: valor do caractere = código ASCII − 48. */
const VALOR_BASE_ASCII = 48

/**
 * Valor de um caractere no cálculo do dígito verificador: código ASCII menos
 * 48. `0`..`9` valem 0..9 e `A`..`Z` valem 17..42, o que mantém o resultado
 * dos CNPJs numéricos antigos.
 */
export function valorDoCaractereCnpj(caractere: string): number {
  return caractere.charCodeAt(0) - VALOR_BASE_ASCII
}

function digitoCnpj(caracteres: string): number {
  const deslocamento = PESOS.length - caracteres.length
  let soma = 0
  for (let i = 0; i < caracteres.length; i++) {
    soma +=
      valorDoCaractereCnpj(caracteres.charAt(i)) * PESOS[deslocamento + i]!
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/**
 * Dígitos verificadores de um CNPJ a partir das 12 primeiras posições
 * (dígitos ou letras maiúsculas), pela regra oficial do CNPJ alfanumérico.
 * Lança `RangeError` se a base não tiver essa forma.
 */
export function calcularDigitosCnpj(base: string): string {
  if (!BASE_CNPJ.test(base)) {
    throw new RangeError(
      'A base do CNPJ precisa ter 12 posições com dígitos ou letras maiúsculas.'
    )
  }
  const primeiro = digitoCnpj(base)
  const segundo = digitoCnpj(`${base}${primeiro}`)
  return `${primeiro}${segundo}`
}

/** CNPJ sem máscara e com letras em maiúsculas (ver `normalizarDocumento`). Não valida. */
export function normalizarCnpj(valor: string): string {
  return normalizarDocumento(valor)
}

/**
 * CNPJ válido, numérico ou alfanumérico: forma `FORMATO_CNPJ` depois da
 * normalização, não todos os caracteres iguais e dígitos verificadores
 * corretos.
 */
export function validarCnpj(valor: string): boolean {
  const cnpj = normalizarCnpj(valor)
  if (!FORMATO_CNPJ.test(cnpj)) return false
  if (todosCaracteresIguais(cnpj)) return false
  return calcularDigitosCnpj(cnpj.slice(0, 12)) === cnpj.slice(12)
}

/**
 * `00.000.000/0000-00` (letras incluídas, em maiúsculas) a partir de qualquer
 * entrada com a forma de CNPJ depois da normalização; `null` quando a forma
 * não é de CNPJ. Só formata, não valida.
 */
export function formatarCnpj(valor: string): string | null {
  const cnpj = normalizarCnpj(valor)
  if (!FORMATO_CNPJ.test(cnpj)) return null
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`
}
