import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Visualizar equipamento', () => {
  it('mostra o equipamento, as avarias e abre a edição', () => {
    const source = readFileSync(
      new URL('./VerEquipamento.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Visualizar Equipamento')
    expect(source).toContain('Detalhes das Perdas de Peças e Avarias')
    expect(source).toContain('Editar Equipamento')
    expect(source).toContain('Fechar')
    expect(source).toContain('variant="outline"')
    expect(source).toContain('aria-label="Fechar dialog"')
    expect(source).toContain("equipment.category?.bgColor || '#3b82f6'")
    expect(source).toContain('4px solid #ef4444')
    expect(source).toContain('next/image')
  })
})
