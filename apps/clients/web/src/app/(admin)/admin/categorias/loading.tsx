import { AdminQuotesLoading } from '@gb-locacoes/frontend/pages/orcamentos-admin'

/**
 * Carregamento das categorias do painel (onda 135, A6). O `loading.tsx` da raiz legada desenhava o mesmo spinner da
 * listagem de orçamentos (mesma marcação e mesma rotação), que a página de orçamentos exporta.
 */
export default function Loading() {
  return <AdminQuotesLoading />
}
