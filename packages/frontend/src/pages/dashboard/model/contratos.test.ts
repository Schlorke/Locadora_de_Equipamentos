import { describe, expect, it } from 'vitest'
import { getInitials } from './contratos'

describe('Iniciais do dashboard', () => {
  it.each(['', '   ', '-'])('não inventa iniciais para %j', (name) => {
    expect(getInitials(name)).toBeNull()
  })

  it('usa a primeira e a última palavra, sem mudar nomes de uma palavra', () => {
    expect(getInitials('  Maria da Silva  ')).toBe('MS')
    expect(getInitials('harry')).toBe('H')
  })
})
