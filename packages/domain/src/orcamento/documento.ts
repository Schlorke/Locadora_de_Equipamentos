import {
  formatarCnpj,
  formatarCpf,
  formatarDocumento,
  validarCnpj,
  validarCpf,
} from '../documento'

/**
 * API do orçamento para documentos. A regra de CPF e CNPJ (inclusive o CNPJ
 * alfanumérico) mora em `packages/domain/src/documento`; aqui só se mantêm os
 * nomes e o contrato de retorno que o orçamento já usava.
 */
export function validateCPF(cpf: string): boolean {
  return validarCpf(cpf)
}

export function validateCNPJ(cnpj: string): boolean {
  return validarCnpj(cnpj)
}

/** Formata um CPF com 11 dígitos; qualquer outra entrada volta como veio. */
export function formatCPF(cpf: string): string {
  return formatarCpf(cpf) ?? cpf
}

/** Formata um CNPJ (numérico ou alfanumérico); qualquer outra entrada volta como veio. */
export function formatCNPJ(cnpj: string): string {
  return formatarCnpj(cnpj) ?? cnpj
}

/** Formata CPF ou CNPJ pela forma; outra entrada volta como veio, e vazio vira `-`. */
export function formatDocument(document: string): string {
  return formatarDocumento(document) ?? (document || '-')
}

export function formatAddress(address: {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
}): string {
  const parts = [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    address.zipCode,
  ].filter(Boolean)

  return parts.join(' - ')
}
