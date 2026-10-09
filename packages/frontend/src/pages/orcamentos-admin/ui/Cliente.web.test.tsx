import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Cartão do cliente no orçamento', () => {
  it('mostra empresa, documentos e o selo de código legado', () => {
    const source = readFileSync(
      new URL('./Cliente.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Empresa')
    expect(source).toContain('CPF')
    expect(source).toContain('CNPJ')
    expect(source).toContain('Telefone')
    expect(source).toContain('Código legado')
    expect(source).toContain('Referência')
    expect(source).toContain('bg-[#7b81f5]')
    expect(source).toContain('hover:bg-[#6a70dd]')
    expect(source).toContain('aria-label="Editar dados do cliente"')
    expect(source).toContain('getInitials(selectedQuote.name)')
    expect(source).toContain("from '../../../shared/lib/formatting'")
  })
})
