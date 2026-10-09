import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Equipamentos por categoria', () => {
  it('mantém o vazio, a barra horizontal e o azul padrão', () => {
    const source = readFileSync(
      new URL('./Categoria.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Sem dados disponíveis')
    expect(source).toContain("defaultColor = '#3b82f6'")
    expect(source).toContain('entry.bgColor || defaultColor')
    expect(source).toContain('item.bgColor || defaultColor')
    expect(source).toContain('layout="vertical"')
    expect(source).toContain('dataKey="categoryName"')
    expect(source).toContain('width={120}')
    expect(source).toContain('radius={[0, 8, 8, 0]}')
    expect(source).toContain('h-[400px]')
    expect(source).toContain('h-[320px] lg:h-[460px]')
    expect(source).toContain('`${value} equipamentos`')
  })
})
