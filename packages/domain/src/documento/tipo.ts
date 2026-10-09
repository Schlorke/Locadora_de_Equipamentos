import { formatarCnpj, validarCnpj } from './cnpj'
import { formatarCpf, validarCpf } from './cpf'
import { normalizarDocumento } from './normalizacao'

export type TipoDeDocumento = 'CPF' | 'CNPJ'

export interface DocumentoIdentificado {
  readonly tipo: TipoDeDocumento
  /** Documento sem máscara e com letras em maiúsculas. */
  readonly normalizado: string
}

/**
 * Identifica um CPF ou CNPJ **válido** (dígitos verificadores conferidos).
 * `null` quando não é nenhum dos dois.
 */
export function identificarDocumento(
  valor: string
): DocumentoIdentificado | null {
  const normalizado = normalizarDocumento(valor)
  if (validarCpf(normalizado)) return { tipo: 'CPF', normalizado }
  if (validarCnpj(normalizado)) return { tipo: 'CNPJ', normalizado }
  return null
}

/**
 * Formata pela forma do documento: 11 dígitos como CPF, 14 posições no
 * formato do CNPJ (numérico ou alfanumérico) como CNPJ. `null` quando a
 * forma não é de nenhum dos dois. Só formata, não valida.
 */
export function formatarDocumento(valor: string): string | null {
  return formatarCpf(valor) ?? formatarCnpj(valor)
}
