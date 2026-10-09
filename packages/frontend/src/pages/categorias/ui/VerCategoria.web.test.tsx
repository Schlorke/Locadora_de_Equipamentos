import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Visualizar categoria', () => {
  it('mostra o preview, a aba, os equipamentos e abre a edição', () => {
    const source = readFileSync(
      new URL('./VerCategoria.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Visualizar Categoria')
    expect(source).toContain('Preview da Categoria')
    expect(source).toContain('Aba atual:')
    expect(source).toContain('Fases da obra')
    expect(source).toContain('Tipo de trabalho')
    expect(source).toContain("(category.placement || 'types') === 'phases'")
    expect(source).toContain('Sem descrição')
    expect(source).toContain('Equipamentos')
    expect(source).toContain('category._count?.equipments || 0')
    expect(source).toContain('ID da Categoria')
    expect(source).toContain('Fechar')
    expect(source).toContain('Editar Categoria')
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain('aria-label="Fechar dialog"')
  })
})
