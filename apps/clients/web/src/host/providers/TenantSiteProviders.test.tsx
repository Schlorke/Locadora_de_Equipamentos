// Providers do host de locadora: a moldura segue a rota renderizada (o segmento que o rewrite do proxy escolheu, não
// o caminho visível) e a identidade é a do cartão da própria locadora (achados 142 e 143).
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  pathname: '/',
  segments: [] as string[],
}))
const seen = vi.hoisted(() => ({
  chrome: [] as unknown[],
  identity: [] as unknown[],
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSelectedLayoutSegments: () => navigation.segments,
  useRouter: () => ({ push: () => undefined }),
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('../auth/client', () => ({ hostAuth: {} }))
vi.mock('@gb-locacoes/frontend/app', () => ({
  createHttpClient: () => ({ request: async () => null }),
  usePublicTenantRouting: () => ({
    internalRoutePrefix: '/locadora-a',
    resolveHref: (href: string) => href,
  }),
  AppProviders: ({
    children,
    publicTenantIdentity,
  }: {
    children: ReactNode
    publicTenantIdentity: unknown
  }) => {
    seen.identity.push(publicTenantIdentity)
    return children
  },
  ClientLayoutShell: ({
    children,
    chrome,
  }: {
    children: ReactNode
    chrome: unknown
  }) => {
    seen.chrome.push(chrome)
    return children
  },
}))

import { TenantSiteProviders } from './TenantSiteProviders'

const IDENTITY = {
  name: 'Locadora A',
  city: 'Canoas',
  state: 'RS',
  logoUrl: null,
}

function render(
  pathname: string,
  segments: string[],
  siteMode: 'LIVE' | 'PAUSED' | 'OFF' = 'LIVE'
) {
  navigation.pathname = pathname
  navigation.segments = segments
  seen.chrome.length = 0
  seen.identity.length = 0
  renderToStaticMarkup(
    createElement(TenantSiteProviders, {
      tenantSlug: 'locadora-a',
      identity: IDENTITY,
      siteMode,
      children: 'página',
    })
  )
  return { chrome: seen.chrome[0], identity: seen.identity[0] }
}

afterEach(() => vi.clearAllMocks())

describe('TenantSiteProviders', () => {
  it.each([
    ['/', ['(vitrine)']],
    ['/equipamentos', ['(vitrine)', 'equipamentos']],
    ['/entrar', ['(auth)', 'entrar']],
    ['/area-cliente', ['(account)', 'area-cliente']],
  ])('%s: moldura da vitrine', (pathname, segments) => {
    expect(render(pathname, segments).chrome).toBe('storefront')
  })

  it.each(['/', '/equipamentos', '/orcamento', '/locadora-a/site-pausado'])(
    'pausa reescrita em %s: sem a moldura da vitrine (a página traz a neutra)',
    (pathname) => {
      expect(render(pathname, ['(vitrine)', 'site-pausado']).chrome).toBe(
        'none'
      )
    }
  )

  // Onda 134 (decisão do dono de 2026-10-06, item 4): na pausa, as páginas legais continuam no ar com a moldura neutra
  // que a própria página traz; no ar, com a moldura da vitrine.
  it.each(['termos', 'privacidade', 'politica-devolucao', 'cookies'])(
    'página legal %s: moldura neutra só em pausa',
    (pagina) => {
      expect(render('/' + pagina, ['(vitrine)', pagina], 'PAUSED').chrome).toBe(
        'none'
      )
      expect(render('/' + pagina, ['(vitrine)', pagina], 'LIVE').chrome).toBe(
        'storefront'
      )
    }
  )

  it('em pausa, a área do cliente segue com a moldura de sempre', () => {
    expect(
      render('/area-cliente', ['(account)', 'area-cliente'], 'PAUSED').chrome
    ).toBe('storefront')
  })

  it('identidade da vitrine: o cartão da própria locadora', () => {
    expect(render('/', ['(vitrine)']).identity).toEqual({
      nome: 'Locadora A',
      cidade: 'Canoas',
      uf: 'RS',
      logoUrl: null,
    })
  })
})
