import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carga financeira', () => {
  it('lista até 10000, separa o calendário e salva as alíquotas', () => {
    const source =
      readFileSync(new URL('./carga.web.ts', import.meta.url), 'utf8') +
      readFileSync(new URL('./carga.ts', import.meta.url), 'utf8') +
      readFileSync(
        new URL('../../../shared/api/useScopedApiClient.ts', import.meta.url),
        'utf8'
      )
    expect(source).toContain('const TABLE_PAGE_SIZE = 10')
    expect(source).toContain("query.set('limit', '10000')")
    expect(source).toContain('financialApi.entries(')
    expect(source).toContain('financialApi.calendar(')
    expect(source).toContain('financialApi.revenue(')
    expect(source).toContain('financialApi.aging(')
    expect(source).toContain('delinquencyRate ?? 0')
    expect(source).toContain('financialApi.settings(')
    expect(source).toContain('financialApi.saveSettings(')
    expect(source).toContain('Alíquotas financeiras salvas')
    expect(source).toContain('Erro ao carregar painel financeiro')
    expect(source).toContain("name === 'AbortError'")
    expect(source).toContain("viewMode !== 'dashboard'")
    expect(source).toContain("event.color ?? '#f59e0b'")
    expect(source).toContain("event.status ?? 'AWAITING_PAYMENT'")
  })
})
