import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de excluir aprovação', () => {
  it('devolve o orçamento para pendente e confirma no botão padrão', () => {
    const source = readFileSync(
      new URL('./RemoverAprovacao.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Excluir Aprovação?')
    expect(source).toContain('voltará ao status pendente')
    expect(source).toContain('Esta ação não pode ser desfeita')
    expect(source).toContain('Cancelar')
    expect(source).toContain(
      "isRemovingApproval ? 'Removendo...' : 'Confirmar'"
    )
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain('disabled={isRemovingApproval}')
  })
})
