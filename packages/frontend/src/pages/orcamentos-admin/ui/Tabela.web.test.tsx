import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tabela de orçamentos', () => {
  it('lista cliente, valor e status com o formatador do admin', () => {
    const source = readFileSync(
      new URL('./Tabela.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Cliente')
    expect(source).toContain('Equipamentos')
    expect(source).toContain('Período')
    expect(source).toContain('Valor Total')
    expect(source).toContain('Status')
    expect(source).toContain('Ações')
    expect(source).toContain("normalizeStatus(status) || 'pending'")
    expect(source).toContain('getInitials(quote.name)')
    expect(source).toContain('finalTotal ??')
    expect(source).toContain('originalTotal ??')
    expect(source).toContain('totalPrice ??')
    expect(source).toContain("from '../../../shared/lib/formatting'")
    expect(source).toContain('toLocaleDateString(')
    expect(source).toContain("'pt-BR'")
    expect(source).toContain('Não definido')
    expect(source).toContain('Nenhum orçamento encontrado')
    expect(source).toContain('colSpan={100}')
    expect(source).toContain("dia' : 'dias'")
  })
})
