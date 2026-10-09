import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de rejeitar orçamento', () => {
  it('pergunta a rejeição, oferece motivo e confirma no botão padrão', () => {
    const source = readFileSync(
      new URL('./Rejeitar.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Rejeitar Orçamento?')
    expect(source).toContain('enviará um email ao')
    expect(source).toContain('id="reject-with-reason"')
    expect(source).toContain('checked === true')
    expect(source).toContain('Adicionar motivo da rejeição')
    expect(source).toContain('Digite o motivo da rejeição do orçamento...')
    expect(source).toContain("updatingAction === 'rejected'")
    expect(source).toContain('Rejeitando...')
    expect(source).toContain('Confirmar Rejeição')
    expect(source).toContain('Cancelar')
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain('rejectWithReason && !rejectionReason.trim()')
  })
})
