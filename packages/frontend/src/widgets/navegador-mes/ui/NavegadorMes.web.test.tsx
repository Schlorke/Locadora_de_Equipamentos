import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Navegador de mês do kanban', () => {
  it('mostra o ano, os meses em português e o botão Hoje', () => {
    const source = readFileSync(
      new URL('./NavegadorMes.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('subYears(selectedDate, 1)')
    expect(source).toContain('addYears(selectedDate, 1)')
    expect(source).toContain('startOfMonth(new Date())')
    expect(source).toContain('Hoje')
    expect(source).toContain("format(monthDate, 'MMM', { locale: ptBR })")
    expect(source).toContain('from-orange-500 via-orange-600 to-orange-700')
    expect(source).toContain('length: 12')
    expect(source).toContain('variant="ghost"')
    expect(source).toContain('variant="outline"')
  })
})
