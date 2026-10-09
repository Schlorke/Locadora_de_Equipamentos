import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de categoria', () => {
  it('cria e edita categoria e personaliza o visual', () => {
    const source = readFileSync(
      new URL('./CategoriaDialog.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Nova Categoria')
    expect(source).toContain('Editar Categoria')
    expect(source).toContain('Preview da Categoria')
    expect(source).toContain('Como esta categoria aparece nos cards públicos')
    expect(source).toContain('Descreva onde essa categoria é utilizada.')
    expect(source).toContain('Atualizar Categoria')
    expect(source).toContain('Criar Categoria')
    expect(source).toContain('Salvando...')
    expect(source).toContain('Cancelar')
    expect(source).toContain('Fechar dialog')
    expect(source).toContain('maxLength={200}')
    expect(source).toContain("mode === 'edit'")
    expect(source).toContain('../../../features/abas-categoria')
    expect(source).toContain('useCategoryForm')
    const model = readFileSync(
      new URL('../model/category-form.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('useEmojiRecents')
    expect(model).toContain('useIconRecents')
    expect(source).toContain('../../../widgets/personalizar-icone')
    expect(source).not.toContain('../../packages/frontend')
    expect(source).not.toContain('@/hooks/use-emoji-recents')
    expect(source).not.toContain('@/hooks/use-icon-recents')
  })
})
