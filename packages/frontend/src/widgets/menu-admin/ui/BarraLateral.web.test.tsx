import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('menu-admin sidebars', () => {
  it('preserva gradientes rgba ativos e inativos da sidebar desktop', () => {
    const source = readFileSync(
      new URL('./BarraLateral.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain(
      'linear-gradient(145deg, rgba(251, 146, 60, 0.9), rgba(234, 88, 12, 0.8))'
    )
    expect(source).toContain(
      'linear-gradient(145deg, rgba(71, 85, 105, 0.3), rgba(51, 65, 85, 0.2))'
    )
    expect(source).toContain(
      'linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(20, 31, 45, 0.95))'
    )
    expect(source).toContain('from-orange-500 via-orange-600 to-orange-700')
    expect(source).toContain('Dashboard')
    expect(source).toContain('Logística')
  })

  it('preserva overlay e painel mobile com literais rgba originais', () => {
    const source = readFileSync(
      new URL('./BarraLateralMobile.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('bg-black/80')
    expect(source).toContain(
      'linear-gradient(145deg, rgba(51, 65, 85, 0.95), rgba(30, 41, 59, 0.9))'
    )
    expect(source).toContain('Sair do Sistema')
    expect(source).toContain('Painel Administrativo')
  })
})
