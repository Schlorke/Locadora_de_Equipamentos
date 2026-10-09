import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Distribuição de status', () => {
  it('mantém o vazio, o total e as cores vindas dos dados', () => {
    const source = readFileSync(
      new URL('./Distribuicao.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Sem dados disponíveis')
    expect(source).toContain('>Total<')
    expect(source).toContain('{totalQuotes}')
    expect(source).toContain('fill={entry.color}')
    expect(source).toContain('label: item.name')
    expect(source).toContain('color: item.color')
    expect(source).toContain('innerRadius="35%"')
    expect(source).toContain('outerRadius="60%"')
    expect(source).toContain('paddingAngle={2}')
    expect(source).toContain('cy="45%"')
    expect(source).toContain('h-[220px] sm:h-[280px] md:h-[320px]')
    expect(source).toContain('h-[280px] sm:h-[320px] lg:h-[460px]')
    expect(source).toContain('`${value} orçamentos`')
    expect(source).toMatch(/fontSize:\s*'12px'/)
  })
})
