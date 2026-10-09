import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tendência de orçamentos', () => {
  it('mantém o vazio, as alturas e o laranja da marca', () => {
    const source = readFileSync(
      new URL('./Tendencia.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Sem dados disponíveis')
    expect(source).toContain("label: 'Orçamentos'")
    expect(source).toContain("orange: '#ea580c'")
    expect(source).toContain("orangeLight: '#f97316'")
    expect(source).toContain('h-[320px] lg:h-[460px]')
    expect(source).toContain('h-[280px] md:h-[320px]')
    expect(source).toContain('allowDecimals={false}')
    expect(source).toContain('`${value} orçamentos`')
    expect(source).toContain('id="colorCount"')
  })
})
