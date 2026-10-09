// Nota de avaliações do detalhe (onda 134, decisão D-A): só com a nota, a quantidade e o link da fonte que a própria
// locadora declarou no painel. Sem fonte, nenhuma nota (a da produção era fixa e sem fonte).
import { describe, expect, it } from 'vitest'
import { anosNoMercado, notaDaLocadora } from './avaliacoes'

const GOOGLE = {
  rating: 4.8,
  count: 127,
  sourceName: 'Google',
  sourceUrl: 'https://g.example.test/locadora',
}

describe('notaDaLocadora', () => {
  it('com a fonte declarada: nota com uma casa, estrelas cheias e a quantidade com a fonte', () => {
    expect(notaDaLocadora({ reviews: GOOGLE })).toEqual({
      nota: '4.8',
      estrelasCheias: 5,
      quantidade: '127 avaliações',
      fonte: 'Google',
      url: 'https://g.example.test/locadora',
    })
    expect(
      notaDaLocadora({ reviews: { ...GOOGLE, rating: 4.2, count: 1 } })
    ).toMatchObject({
      nota: '4.2',
      estrelasCheias: 4,
      quantidade: '1 avaliação',
    })
    expect(
      notaDaLocadora({ reviews: { ...GOOGLE, rating: 5, count: 1530 } })
    ).toMatchObject({ nota: '5.0', quantidade: '1.530 avaliações' })
  })

  it('sem a nota declarada (ou fora do contrato), nenhuma nota', () => {
    expect(notaDaLocadora({})).toBeNull()
    expect(notaDaLocadora(null)).toBeNull()
    expect(notaDaLocadora(undefined)).toBeNull()
  })
})

describe('anosNoMercado', () => {
  it('subtítulo do "Por que escolher" do detalhe só com os anos da própria locadora', () => {
    expect(anosNoMercado(10)).toBe('Mais de 10 anos de experiência no mercado')
    expect(anosNoMercado(1)).toBe('Mais de 1 ano de experiência no mercado')
    expect(anosNoMercado(undefined)).toBeNull()
  })
})
