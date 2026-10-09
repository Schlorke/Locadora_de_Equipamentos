import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Quadro do kanban', () => {
  it('mantém o padrão de colunas e ignora o vazio transitório', () => {
    const source = readFileSync(
      new URL('./Quadro.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('mobile: 1')
    expect(source).toContain('tablet: 3')
    expect(source).toContain('desktop: 3')
    expect(source).toContain('xl: 6')
    expect(source).toContain('columnsPerRow.tablet || 3')
    expect(source).toContain('columnsPerRow.desktop || 3')
    expect(source).toContain('columnsPerRow.xl || 6')
    expect(source).toContain('prev > 80 && h < 40')
    expect(source).toContain('setTimeout(commit, 200)')
    expect(source).toContain('}, 50)')
    expect(source).toContain('max-h-[44rem]')
    expect(source).toContain('rgb(249 115 22)')
  })
})
