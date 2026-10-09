import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Listagem admin de categorias', () => {
  it('mantém título, página 9, diálogos existentes e shell da rota', () => {
    const source = readFileSync(
      new URL('./CategoriasPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Gerenciar Categorias')
    expect(source).toContain(
      'Organize e gerencie as categorias de equipamentos'
    )
    expect(source).toContain('placeholder="Buscar categorias..."')
    expect(source).toContain('Nova Categoria')
    expect(source).toContain("from './VerCategoria.web'")
    expect(source).toContain("from './CategoriaDialog.web'")
    expect(source).toContain("from '../model/carga.web'")
    expect(source).not.toContain('@/hooks/use-categories-data')
    expect(source).not.toContain('cabecalho-admin')

    const carga = readFileSync(
      new URL('../model/carga.ts', import.meta.url),
      'utf8'
    )
    expect(carga).toContain('CATEGORY_PAGE_SIZE')
    expect(carga).toContain('api.list()')
    expect(carga).toContain(
      'filteredCategories.slice(startIndex, startIndex + CATEGORY_PAGE_SIZE)'
    )
    expect(carga).not.toContain('../ui/')

    const mapa = readFileSync(
      new URL('../../../entities/categoria/model/mapa.ts', import.meta.url),
      'utf8'
    )
    expect(mapa).toContain('export const CATEGORY_PAGE_SIZE = 9')

    const route = readFileSync(
      new URL(
        '../../../../../../app/admin/categorias/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(route).toContain("from '@gb-locacoes/frontend/pages/categorias'")
    expect(route).toContain('return <AdminCategoriesPage />')
    expect(route).not.toContain('useCategoriesData')
    expect(route).not.toContain('Gerenciar Categorias')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/categorias/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/categorias["']/
    )
    expect(webRoute).toContain('return <AdminCategoriesPage />')
    // Onda 135 (A6): o carregamento da rota no host web. A raiz legada desenhava o mesmo spinner da listagem de
    // orçamentos (app/admin/categorias/loading.tsx tem a marcação de AdminQuotesLoading; CarregandoLista.rotas.test.tsx).
    const webLoading = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/categorias/loading.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webLoading).toMatch(
      /import \{ AdminQuotesLoading \} from ["']@gb-locacoes\/frontend\/pages\/orcamentos-admin["']/
    )
    expect(webLoading).toContain('return <AdminQuotesLoading />')
  })
})
