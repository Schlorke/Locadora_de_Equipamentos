/**
 * Dígitos verificadores de CPF e CNPJ usados pelo dublê do Asaas para recusar documentos como o
 * Asaas recusa (`invalid_cpfCnpj`). O CNPJ segue o cálculo alfanumérico da Receita (valor do
 * caractere = código ASCII − 48), que também vale para o CNPJ só numérico.
 */
export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false
  const digits = [...value].map(Number)
  for (const length of [9, 10]) {
    let sum = 0
    for (let index = 0; index < length; index++) sum += digits[index]! * (length + 1 - index)
    if (((sum * 10) % 11) % 10 !== digits[length]) return false
  }
  return true
}

export function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false
  const values = [...value].map((char) => char.charCodeAt(0) - 48)
  for (const length of [12, 13]) {
    let sum = 0
    let weight = length - 7
    for (let index = 0; index < length; index++) {
      sum += values[index]! * weight
      weight = weight === 2 ? 9 : weight - 1
    }
    const rest = sum % 11
    if ((rest < 2 ? 0 : 11 - rest) !== values[length]) return false
  }
  return true
}

function cnpjCheckDigit(values: readonly number[]): number {
  let sum = 0
  let weight = values.length - 7
  for (const value of values) {
    sum += value * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

/**
 * CNPJ alfanumérico válido e determinístico a partir de uma semente (ex.: sufixo da execução),
 * para que execuções repetidas no sandbox não encontrem clientes umas das outras.
 */
export function alphanumericCnpjFor(seed: string): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let hash = 2166136261
  let base = ''
  for (let index = 0; index < 12; index++) {
    for (const char of seed + ':' + index) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
    base += alphabet[index < 2 ? hash % 10 : hash % alphabet.length]
  }
  if (!/[A-Z]/.test(base)) base = base.slice(0, 2) + 'A' + base.slice(3)
  const values = [...base].map((char) => char.charCodeAt(0) - 48)
  const first = cnpjCheckDigit(values)
  const second = cnpjCheckDigit([...values, first])
  return base + String(first) + String(second)
}

export function isAlphanumericCnpj(value: string): boolean {
  return /^[0-9A-Z]{14}$/.test(value) && /[A-Z]/.test(value)
}

/** Documentos públicos de exemplo (nenhum pertence a uma pessoa ou empresa real conhecida). */
export const SAMPLE_DOCUMENTS = Object.freeze({
  cpf: '12345678909',
  cnpj: '11222333000181',
  /** Exemplo oficial de CNPJ alfanumérico da Receita Federal. */
  alphanumericCnpj: '12ABC34501DE35',
  alphanumericCnpjMasked: '12.ABC.345/01DE-35',
})
