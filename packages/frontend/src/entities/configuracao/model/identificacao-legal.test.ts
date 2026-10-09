import { describe, expect, it } from 'vitest'
import { linhaLegal } from './identificacao-legal'

// Achado 147: o CNPJ volta à vitrine a partir da organização da própria locadora (Decreto 7.962/2013, art. 2º, I).
describe('linhaLegal', () => {
  it('só o CNPJ quando o nome empresarial falta ou é o próprio nome da vitrine (a linha da produção)', () => {
    expect(
      linhaLegal(
        { legalName: null, cnpj: '11.222.333/0001-81' },
        'Locadora Nova'
      )
    ).toBe('CNPJ: 11.222.333/0001-81')
    expect(
      linhaLegal(
        { legalName: ' locadora  nova ', cnpj: '11.222.333/0001-81' },
        'Locadora Nova'
      )
    ).toBe('CNPJ: 11.222.333/0001-81')
  })

  it('nome empresarial diferente do nome da vitrine entra antes do CNPJ', () => {
    expect(
      linhaLegal(
        { legalName: 'Nova Equipamentos Ltda', cnpj: '11.222.333/0001-81' },
        'Locadora Nova'
      )
    ).toBe('Nova Equipamentos Ltda · CNPJ: 11.222.333/0001-81')
    expect(
      linhaLegal(
        { legalName: 'Nova Equipamentos Ltda', cnpj: null },
        'Locadora Nova'
      )
    ).toBe('Nova Equipamentos Ltda')
  })

  it('sem identificação: nenhuma linha', () => {
    expect(linhaLegal(null, 'Locadora Nova')).toBeNull()
    expect(linhaLegal(undefined, null)).toBeNull()
    expect(
      linhaLegal({ legalName: null, cnpj: null }, 'Locadora Nova')
    ).toBeNull()
    expect(
      linhaLegal({ legalName: 'Locadora Nova', cnpj: null }, 'Locadora Nova')
    ).toBeNull()
  })
})
