import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Filtro financeiro', () => {
  it('lista 13 meses, trata todos os períodos e espera 350 ms', () => {
    const source =
      readFileSync(new URL('./Filtro.web.tsx', import.meta.url), 'utf8') +
      readFileSync(new URL('../model/period.ts', import.meta.url), 'utf8')
    expect(source).toContain('const SEARCH_DEBOUNCE_MS = 350')
    expect(source).toContain("{ value: 'all', label: 'Todos os períodos' }")
    expect(source).toContain('for (let i = 0; i < 13; i++)')
    expect(source).toContain("'Janeiro'")
    expect(source).toContain("'Dezembro'")
    expect(source).toContain(
      "if (period === 'all') return { startDate: null, endDate: null }"
    )
    expect(source).toContain('new Date(year, month + 1, 0, 23, 59, 59, 999)')
    expect(source).toContain('start.toISOString()')
    expect(source).toContain('end.toISOString()')
  })
})
