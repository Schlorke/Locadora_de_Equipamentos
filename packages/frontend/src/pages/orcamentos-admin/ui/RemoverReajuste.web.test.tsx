import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Confirmação de remover reajuste', () => {
  it('recalcula o valor final e confirma a remoção no botão padrão', () => {
    const source = readFileSync(
      new URL('./RemoverReajuste.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Remover reajuste do orçamento?')
    expect(source).toContain('O valor final do orçamento será')
    expect(source).toContain('recalculado')
    expect(source).toContain('aria-label="Fechar confirmação"')
    expect(source).toContain('Cancelar')
    expect(source).toContain(
      "isRemoving ? 'Removendo...' : 'Confirmar remoção'"
    )
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
  })
})
