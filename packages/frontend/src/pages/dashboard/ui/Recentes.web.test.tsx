import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Orçamentos recentes do dashboard', () => {
  it('mantém o vazio, o valor com ponto e as iniciais do dashboard', () => {
    const source = readFileSync(
      new URL('./Recentes.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Orçamentos Recentes')
    expect(source).toContain('Ver Todos')
    expect(source).toContain('href="/admin/orcamentos"')
    expect(source).toContain('Nenhum orçamento recente')
    expect(source).toContain('Os orçamentos solicitados aparecerão aqui')
    expect(source).toContain('Cliente')
    expect(source).toContain('Empresa')
    expect(source).toContain('Itens')
    expect(source).toContain('Valor')
    expect(source).toContain('Status')
    expect(source).toContain('Data')
    expect(source).toContain('getInitials(quote.customerName)')
    expect(source).toContain('dashboardStatusConfig')
    expect(source).toContain('quote.totalAmount.toFixed(2)')
    expect(source).toContain(": '-'")
    expect(source).toContain('toLocaleDateString(')
    expect(source).toContain("'pt-BR'")
    expect(source).toContain('hover:bg-yellow-100 dark:hover:bg-yellow-900')
    expect(source).toContain('hover:bg-blue-100 dark:hover:bg-blue-900')
    expect(source).not.toMatch(/hover:!bg-/)
    expect(source).toContain('!Array.isArray(recentQuotes)')
  })
})
