import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Confirmação de remover item do orçamento', () => {
  it('recalcula o total e confirma a remoção no botão padrão', () => {
    const source = readFileSync(
      new URL('./RemoverItem.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Remover equipamento do orçamento?')
    expect(source).toContain('O total será recalculado')
    expect(source).toContain('adicionando o equipamento novamente')
    expect(source).toContain('aria-label="Fechar confirmação"')
    expect(source).toContain('Cancelar')
    expect(source).toContain(
      "isRemoving ? 'Removendo...' : 'Confirmar remoção'"
    )
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
  })
})
