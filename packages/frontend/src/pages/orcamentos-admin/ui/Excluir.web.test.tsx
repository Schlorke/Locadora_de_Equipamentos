import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de excluir orçamento', () => {
  it('avisa que a exclusão é permanente e confirma no botão padrão', () => {
    const source = readFileSync(
      new URL('./Excluir.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Excluir Orçamento Permanentemente?')
    expect(source).toContain('Esta ação não pode ser desfeita')
    expect(source).toContain('itens e registros associados')
    expect(source).toContain('Cancelar')
    expect(source).toContain("isDeleting ? 'Excluindo...' : 'Confirmar'")
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain('disabled={isDeleting}')
  })
})
