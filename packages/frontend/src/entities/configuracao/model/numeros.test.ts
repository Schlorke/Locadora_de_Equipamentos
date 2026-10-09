import { describe, expect, it } from 'vitest'
import { anos, comMais, decadas, maisAntes, numeroDaVitrine } from './numeros'

// Números do conteúdo institucional da própria locadora (onda 134): o modelo só escreve o número declarado no painel.
describe('números da vitrine', () => {
  it('separador de milhar do pt-BR, sem depender de Intl', () => {
    expect(numeroDaVitrine(7)).toBe('7')
    expect(numeroDaVitrine(500)).toBe('500')
    expect(numeroDaVitrine(1200)).toBe('1.200')
    expect(numeroDaVitrine(1_000_000)).toBe('1.000.000')
  })

  it('"N+" e "+N", como nos selos e números da produção', () => {
    expect(comMais(10)).toBe('10+')
    expect(comMais(1500)).toBe('1.500+')
    expect(maisAntes(200)).toBe('+200')
    expect(maisAntes(2500)).toBe('+2.500')
  })

  it('anos com singular', () => {
    expect(anos(1)).toBe('1 ano')
    expect(anos(2)).toBe('2 anos')
    expect(anos(10)).toBe('10 anos')
  })

  it('"Mais de uma década" a partir de 10 anos; abaixo, "Há N anos"', () => {
    expect(decadas(10)).toBe('Mais de uma década')
    expect(decadas(25)).toBe('Mais de uma década')
    expect(decadas(9)).toBe('Há 9 anos')
    expect(decadas(1)).toBe('Há 1 ano')
  })
})
