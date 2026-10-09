import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PlaygroundPage', () => {
  it('mantém título, benefícios e CTA com telefone +55', () => {
    const source = readFileSync(
      new URL('./PlaygroundPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('export function PlaygroundPage')
    expect(source).toContain('text="Por que Escolher a"')
    // Achado 143: o laboratório usa o nome da plataforma, nunca a marca da GB.
    expect(source).toContain('text={`${PLATFORM.displayName}?`}')
    expect(source).not.toMatch(/GB Loca/)
    // Benefícios da vitrine sem locadora: nenhum cliente, ano de mercado ou região da GB.
    expect(source).toContain('const benefits = beneficiosComVisual(null)')
    expect(source).not.toMatch(
      /Porto Alegre|Melnick|Cyrela|Construtoras|10 Anos|Ha 10 anos/i
    )
    expect(source).toContain('itemDistance={300}')
    expect(source).toContain('tel:+55')
    expect(source).toContain('href="/orcamento"')
    expect(source).toContain('Solicitar Orcamento Online')
    expect(source).toContain("from '../../../widgets/por-que-escolher'")
    expect(source).not.toContain('prisma')
    expect(source).not.toContain('@prisma')
  })
})
