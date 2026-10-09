import { describe, expect, it } from 'vitest'
import {
  formatAddress,
  formatCNPJ,
  formatCPF,
  formatDocument,
  validateCNPJ,
  validateCPF,
} from './documento'

describe('documentos do orçamento (delegam a packages/domain/src/documento)', () => {
  it('mantém o contrato anterior para CPF e CNPJ numéricos', () => {
    expect(validateCPF('529.982.247-25')).toBe(true)
    expect(validateCPF('111.111.111-11')).toBe(false)
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true)
    expect(validateCNPJ('11222333000180')).toBe(false)
    expect(formatCPF('52998224725')).toBe('529.982.247-25')
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatDocument('')).toBe('-')
    expect(formatDocument('123')).toBe('123')
  })

  it('aceita e formata o CNPJ alfanumérico sem apagar as letras', () => {
    expect(validateCNPJ('12.ABC.345/01DE-35')).toBe(true)
    expect(validateCNPJ('12ABC34501DE36')).toBe(false)
    expect(formatCNPJ('12abc34501de35')).toBe('12.ABC.345/01DE-35')
    expect(formatDocument('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('não descarta letras para aprovar um documento', () => {
    // Antes, letras eram apagadas e "11222333000181X" virava um CNPJ válido.
    expect(validateCNPJ('11222333000181X')).toBe(false)
    expect(validateCPF('52998224725X')).toBe(false)
  })

  it('devolve a entrada sem forma de documento como veio', () => {
    expect(formatCPF('123')).toBe('123')
    expect(formatCNPJ('12ABC')).toBe('12ABC')
  })

  it('junta o endereço e omite complemento vazio', () => {
    expect(
      formatAddress({
        street: 'Rua A',
        number: '10',
        complement: '',
        neighborhood: 'Centro',
        city: 'Porto Alegre',
        state: 'RS',
        zipCode: '90000-000',
      })
    ).toBe('Rua A, 10 - Centro - Porto Alegre/RS - 90000-000')
  })
})
