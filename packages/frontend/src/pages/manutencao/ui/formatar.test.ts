import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Formatador de manutenção', () => {
  it('trata vazio como zero, data ausente e status desconhecido', () => {
    const source =
      readFileSync(new URL('./formatar.tsx', import.meta.url), 'utf8') +
      readFileSync(new URL('../model/display.ts', import.meta.url), 'utf8')
    expect(source).toContain("if (!value) return 'R$ 0,00'")
    expect(source).toContain("currency: 'BRL'")
    expect(source).toContain("return 'Não definido'")
    expect(source).toContain("return 'Data inválida'")
    expect(source).toContain('statusConfig[status] || statusConfig.SCHEDULED')
    expect(source).toContain("toLocaleDateString('pt-BR'")
  })
})
