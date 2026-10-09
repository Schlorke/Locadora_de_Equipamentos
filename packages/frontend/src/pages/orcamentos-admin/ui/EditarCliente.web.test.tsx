import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de editar cliente do orçamento', () => {
  it('formata CPF e CNPJ e salva no botão padrão', () => {
    const source = readFileSync(
      new URL('./EditarCliente.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Editar dados do cliente')
    expect(source).toContain('Empresa')
    expect(source).toContain('CPF')
    expect(source).toContain('CNPJ')
    expect(source).toContain('Telefone')
    expect(source).toContain('Email')
    expect(source).toContain('000.000.000-00')
    expect(source).toContain('00.000.000/0000-00')
    expect(source).toContain('(00) 00000-0000')
    expect(source).toContain('formatCPFInput')
    expect(source).toContain('formatCNPJInput')
    expect(source).toContain('includeWeekends: boolean')
    expect(source).toContain('Cancelar')
    expect(source).toContain("isSaving ? 'Salvando...' : 'Salvar'")
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
  })
})
