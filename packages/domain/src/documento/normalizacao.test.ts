import { describe, expect, it } from 'vitest'
import { normalizarDocumento, todosCaracteresIguais } from './normalizacao'

describe('normalizarDocumento', () => {
  it('tira ponto, barra, hífen e espaços (inclusive tabulação e espaço não separável)', () => {
    expect(normalizarDocumento('12.ABC.345/01DE-35')).toBe('12ABC34501DE35')
    expect(normalizarDocumento('\t529 982 247-25\n')).toBe('52998224725')
  })

  it('passa só letras ASCII para maiúsculas e mantém qualquer outro caractere', () => {
    expect(normalizarDocumento('ab.cd')).toBe('ABCD')
    expect(normalizarDocumento('ç_#ß')).toBe('ç_#ß')
  })
})

describe('todosCaracteresIguais', () => {
  it('só é verdadeiro para texto não vazio com um único caractere repetido', () => {
    expect(todosCaracteresIguais('0000')).toBe(true)
    expect(todosCaracteresIguais('A')).toBe(true)
    expect(todosCaracteresIguais('0001')).toBe(false)
    expect(todosCaracteresIguais('')).toBe(false)
  })
})
