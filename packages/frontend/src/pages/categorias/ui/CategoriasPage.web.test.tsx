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

    // A rota do host web mantém a composição compartilhada.
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
    expect(webRoute).not.toContain('useCategoriesData')
    expect(webRoute).not.toContain('Gerenciar Categorias')
    // Onda 135 (A6): o carregamento da rota no host web. A raiz legada desenhava o mesmo spinner da listagem de
    // orçamentos (o antigo app/admin/categorias/loading.tsx, retirado em F, tinha a marcação de AdminQuotesLoading;
    // CarregandoLista.rotas.test.tsx preserva essa caracterização).
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
