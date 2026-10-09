// Região de entrega do detalhe (achado 143): a cidade do cartão da própria locadora ou texto neutro. A entrega no mesmo
// dia virou compromisso da locadora (onda 134; entities/configuracao/model/compromissos.test.ts).
import { describe, expect, it } from 'vitest'
import { entregaNaRegiao } from './regiao'

describe('região de entrega do detalhe', () => {
  it('cidade da própria locadora', () => {
    expect(entregaNaRegiao('Curitiba')).toBe('Entrega em Curitiba e região')
    expect(entregaNaRegiao(' Curitiba ')).toBe('Entrega em Curitiba e região')
  })

  it('sem cidade: texto neutro, nunca a região de outra locadora', () => {
    for (const vazio of [null, undefined, '', '   '])
      expect(entregaNaRegiao(vazio)).toBe('Entrega na região')
  })

  it('a locadora de Porto Alegre vê o mesmo texto de antes (vem da cidade do cartão dela)', () => {
    expect(entregaNaRegiao('Porto Alegre')).toBe(
      'Entrega em Porto Alegre e região'
    )
  })
})
