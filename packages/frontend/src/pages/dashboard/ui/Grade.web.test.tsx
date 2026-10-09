import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Grade do dashboard', () => {
  it('mantém as duas grades, os atrasos e o ícone laranja padrão', () => {
    const source = readFileSync(
      new URL('./Grade.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain(
      'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'
    )
    expect(source).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6')
    expect(source).toContain('delay: 0.1 + index * 0.08')
    expect(source).toContain('delay: 0.2 + index * 0.08')
    expect(source).toContain('transition={{ delay: 0.1 }}')
    expect(source).toContain('transition={{ delay: 0.2 }}')
    expect(source).toContain("card.iconBg || 'bg-gray-100'")
    expect(source).toContain("card.iconColor || 'text-orange-600'")
    expect(source).toContain('hover:scale-[1.02]')
    expect(source).toContain('h-7 sm:h-8 w-16 bg-gray-200')
    expect(source).toContain('h-8 w-12 bg-gray-200')
  })
})
