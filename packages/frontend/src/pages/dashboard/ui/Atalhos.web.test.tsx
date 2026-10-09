import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Atalhos do dashboard', () => {
  it('mantém o título, a grade e o link de cada ação', () => {
    const source = readFileSync(
      new URL('./Atalhos.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Ações Rápidas')
    expect(source).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6')
    expect(source).toContain('transition={{ delay: 0.25 }}')
    expect(source).toContain('delay: 0.25 + index * 0.08')
    expect(source).toContain('variant="outline"')
    expect(source).toContain('h-40')
    expect(source).toContain('hover:scale-[1.02]')
    expect(source).toContain('group-hover:text-orange-500')
    expect(source).toContain('group-hover:text-orange-400')
    expect(source).toContain('href={button.href}')
    expect(source).toContain('{button.title}')
    expect(source).toContain('{button.subtitle}')
  })
})
