import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Dashboard administrativo', () => {
  it('mantém o título, o erro e os cinco cartões de espera', () => {
    const source = readFileSync(
      new URL('./DashboardPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Dashboard Executivo')
    expect(source).toContain(
      'Visão geral completa do sistema de locação de equipamentos'
    )
    expect(source).toContain('Sistema em tempo real')
    expect(source).toContain('Erro ao carregar o dashboard')
    expect(source).toContain('Tentar novamente')
    expect(source).toContain('ssr: false')
    expect(source).toContain('[...Array(5)]')
    expect(source).toContain('h-[180px]')
    expect(source).toContain('lg:grid-cols-5')
    expect(source).toContain('stats?.financialMetrics')
    expect(source).toContain('transition={{ delay: 0.3 }}')
  })
})
