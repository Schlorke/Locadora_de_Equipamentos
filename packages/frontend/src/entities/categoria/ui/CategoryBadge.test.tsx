import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('CategoryBadge (entity categoria)', () => {
  it('preserva defaults de size/hover e delega ao helper de cores', () => {
    const source = readFileSync(
      new URL('./CategoryBadge.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain("size = 'sm'")
    expect(source).toContain('hover = false')
    expect(source).toContain('getCategoryBadgePreview(category, size, hover)')
    expect(source).toContain("from '../../../shared/lib/category-helpers'")
    expect(source).toContain("'xs' | 'sm' | 'md' | 'lg'")
  })

  it('é exportado pelo index da entity e não unido ao page size 9', () => {
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
    const mapa = readFileSync(
      new URL('../model/mapa.ts', import.meta.url),
      'utf8'
    )
    expect(index).toContain('from "./ui/CategoryBadge"')
    expect(index).toContain('CategoryBadge')
    expect(mapa).toContain('CATEGORY_PAGE_SIZE = 9')
  })

  it('consumidor do detalhe importa pelo index da entity', () => {
    const detalhe = readFileSync(
      new URL(
        '../../../pages/equipamento-detalhe/ui/EquipamentoDetalhePage.web.tsx',
        import.meta.url
      ),
      'utf8'
    )
    const imports = ts
      .createSourceFile(
        'detail.tsx',
        detalhe,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )
      .statements.filter(ts.isImportDeclaration)
    expect(
      imports.some(
        (node) =>
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === '../../../entities/categoria' &&
          node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.some(
            (item) => item.name.text === 'CategoryBadge'
          )
      )
    ).toBe(true)
    expect(detalhe).toContain('CategoryBadge')
    expect(detalhe).toContain('size="sm"')
    expect(detalhe).toContain('hover={false}')
    expect(detalhe).not.toContain('components/ui/category-badge')
  })
})
