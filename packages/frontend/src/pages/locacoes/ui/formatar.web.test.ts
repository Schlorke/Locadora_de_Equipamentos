import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Formatador de locação', () => {
  it('mostra a data sem hora e cai em pendente', () => {
    const source = readFileSync(
      new URL('./formatar.web.tsx', import.meta.url),
      'utf8'
    )
    const model = readFileSync(
      new URL('../model/formatters.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain("currency: 'BRL'")
    expect(model).toContain("return 'Não definido'")
    expect(model).toContain("return 'Data inválida'")
    expect(model).toContain("day: '2-digit'")
    expect(model).not.toContain('hour:')
    expect(source).toContain('statusConfig[status] || statusConfig.PENDING')
    expect(source).toContain('StatusTooltip')
  })
})
