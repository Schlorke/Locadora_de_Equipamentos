import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuoteIdLoading } from './CarregandoDetalhe.web'
import { AdminQuotesLoading } from './CarregandoLista.web'

/**
 * Carregamento das rotas do painel no host web (onda 135, A6; M2 do plano de aposentadoria da raiz). A raiz legada
 * tinha `loading.tsx` em `admin/orcamentos`, `admin/orcamentos/[id]` e `admin/categorias`; o host web não tinha nenhum
 * (só o `Suspense fallback={null}` dos providers). As três rotas do web passam a montar os componentes da página de
 * orçamentos, que já eram os da raiz: o de categorias é a mesma marcação (spinner da listagem).
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8')
const WEB = '../../../../../../apps/clients/web/src/app/(admin)/admin/'
const classesOf = (markup: string, attribute: 'class' | 'className') =>
  [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(
    (match) => match[1]
  )

describe('carregamento das rotas do painel no host web', () => {
  it.each([
    ['orcamentos/loading.tsx', 'AdminQuotesLoading'],
    ['orcamentos/[id]/loading.tsx', 'QuoteIdLoading'],
  ])('%s monta %s da página de orçamentos', (file, component) => {
    const route = read(WEB + file)
    expect(route).toMatch(
      new RegExp(
        `import \\{ ${component} \\} from ["']@gb-locacoes/frontend/pages/orcamentos-admin["']`
      )
    )
    expect(route).toContain(`return <${component} />`)
  })

  it('o spinner da listagem é o mesmo do loading.tsx de categorias da raiz legada', () => {
    const legacy = read('../../../../../../app/admin/categorias/loading.tsx')
    const legacyClasses = classesOf(legacy, 'className')
    expect(legacyClasses).toHaveLength(2)
    expect(
      classesOf(renderToStaticMarkup(<AdminQuotesLoading />), 'class')
    ).toEqual(legacyClasses)
    // Mesma rotação contínua do framer-motion.
    const source = read('./CarregandoLista.web.tsx')
    for (const animation of [
      'animate={{ rotate: 360 }}',
      'duration: 1,',
      'repeat: Number.POSITIVE_INFINITY,',
      "ease: 'linear',",
    ]) {
      expect(legacy).toContain(animation)
      expect(source).toContain(animation)
    }
  })

  it('o detalhe mostra o texto do carregamento do orçamento', () => {
    expect(renderToStaticMarkup(<QuoteIdLoading />)).toContain(
      'Carregando orçamento...'
    )
  })
})
