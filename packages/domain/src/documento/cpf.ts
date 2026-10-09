import { normalizarDocumento, todosCaracteresIguais } from './normalizacao'

/** CPF normalizado: 11 dígitos. */
export const FORMATO_CPF = /^\d{11}$/

const BASE_CPF = /^\d{9}$/

function digitoCpf(digitos: string, pesoInicial: number): number {
  let soma = 0
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos.charAt(i)) * (pesoInicial - i)
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/**
 * Dígitos verificadores de um CPF a partir dos 9 primeiros dígitos (módulo 11,
 * pesos 10..2 e 11..2). Lança `RangeError` se a base não tiver 9 dígitos.
 */
export function calcularDigitosCpf(base: string): string {
  if (!BASE_CPF.test(base)) {
    throw new RangeError('A base do CPF precisa ter 9 dígitos.')
  }
  const primeiro = digitoCpf(base, 10)
  const segundo = digitoCpf(`${base}${primeiro}`, 11)
  return `${primeiro}${segundo}`
}

/** CPF sem máscara (ver `normalizarDocumento`). Não valida. */
export function normalizarCpf(valor: string): string {
  return normalizarDocumento(valor)
}

/**
 * CPF válido: 11 dígitos depois de tirar a máscara, não todos iguais e com os
 * dois dígitos verificadores corretos. Letras ou símbolos fora da máscara
 * tornam o CPF inválido.
 */
export function validarCpf(valor: string): boolean {
  const cpf = normalizarCpf(valor)
  if (!FORMATO_CPF.test(cpf)) return false
  if (todosCaracteresIguais(cpf)) return false
  return calcularDigitosCpf(cpf.slice(0, 9)) === cpf.slice(9)
}

/**
 * `000.000.000-00` a partir de qualquer entrada com 11 dígitos depois da
 * normalização; `null` quando a forma não é de CPF. Só formata, não valida.
 */
export function formatarCpf(valor: string): string | null {
  const cpf = normalizarCpf(valor)
  if (!FORMATO_CPF.test(cpf)) return null
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`
}
