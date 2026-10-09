import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Utilidades de logística', () => {
  it('preserva textos de data, endereço e status', () => {
    const source =
      readFileSync(new URL('./Utilidades.tsx', import.meta.url), 'utf8') +
      readFileSync(new URL('../model/display.ts', import.meta.url), 'utf8')
    expect(source).toContain('Não definido')
    expect(source).toContain('Data inválida')
    expect(source).toContain('Endereço não informado')
    expect(source).toContain("from './contracts'")
    expect(source).not.toContain('components/admin/logistics')
  })

  it('tipos preservam rótulos Agendada e Entrega', () => {
    const tipos = readFileSync(
      new URL('../model/contracts.ts', import.meta.url),
      'utf8'
    )
    expect(tipos).toContain('Agendada')
    expect(tipos).toContain('Em Trânsito')
    expect(tipos).toContain('Entrega')
    expect(tipos).toContain('Coleta')
  })
})
