import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Checklist de entrega', () => {
  it('separa os itens de entrega e de coleta', () => {
    const source =
      readFileSync(new URL('./Checklist.web.tsx', import.meta.url), 'utf8') +
      readFileSync(new URL('../model/checklist.ts', import.meta.url), 'utf8')
    expect(source).toContain("type: 'DELIVERY' | 'PICKUP'")
    expect(source).toContain("label: 'Equipamento verificado e funcionando'")
    expect(source).toContain("label: 'Acessórios completos'")
    expect(source).toContain("label: 'Cliente presente na entrega'")
    expect(source).toContain("label: 'Equipamento devolvido'")
    expect(source).toContain("label: 'Danos detectados'")
    expect(source).toContain("label: 'Descrição dos danos'")
    expect(source).toContain("label: 'Cliente presente na coleta'")
    expect(source).toContain("label: 'Leitura do odômetro/horímetro'")
    const dialog = readFileSync(
      new URL('./Dialogo.web.tsx', import.meta.url),
      'utf8'
    )
    expect(dialog).toContain("from './Checklist.web'")
  })
})
