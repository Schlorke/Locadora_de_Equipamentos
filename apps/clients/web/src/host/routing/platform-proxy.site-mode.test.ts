// S13: o proxy aplica o modo do site que o backend decidiu. Página da vitrine em pausa → a página de pausa com 503
// real, Retry-After e noindex; sem vitrine (404 do D10) → o mesmo caminho interno do 404 neutro para todas; no ar e
// ainda não indexável → X-Robots-Tag noindex; área do cliente, API e outros hosts nunca consultam.
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'
import { resolvePlatformEnv } from '@gb-locacoes/contracts/platform'
import type { SiteLookup, SiteState } from '../server/site-state'
import { createPlatformProxy, type ProxyEnv } from './platform-proxy'

const env: ProxyEnv = {
  ...resolvePlatformEnv({
    PLATFORM_ENV: 'production',
    PLATFORM_ROOT_DOMAIN: 'plataforma.example',
    PLATFORM_EDGE_SECRET: 'segredo-de-borda-de-teste-com-mais-de-32-caracteres',
    WEB_API_ORIGIN: 'https://backend.example',
  }),
  authMode: 'better-auth',
}
const A = 'https://locadora-a.plataforma.example'

function proxyWith(state: SiteState | SiteLookup | Error, overrides: Partial<ProxyEnv> = {}) {
  const siteState = vi.fn(async (): Promise<SiteLookup> => {
    if (state instanceof Error) throw state
    return 'status' in state ? state : { status: 'site', state }
  })
  const proxy = createPlatformProxy(() => ({ ...env, ...overrides }), siteState)
  return {
    siteState,
    call: async (url: string, method = 'GET') =>
      proxy(new NextRequest(url, { method, headers: { host: new URL(url).host } })),
  }
}

describe('vitrine por estado no proxy', () => {
  it('PAUSED: a página de pausa com 503, Retry-After, sem cache e noindex', async () => {
    const { call, siteState } = proxyWith({ mode: 'PAUSED', indexable: false })
    const response = await call(A + '/equipamentos/eq-1?ref=x')
    expect(isRewrite(response)).toBe(true)
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/site-pausado?ref=x')
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('3600')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(siteState).toHaveBeenCalledExactlyOnceWith('https://backend.example', 'locadora-a')
  })

  // Onda 134 (decisão do dono de 2026-10-06, item 4): as páginas legais seguem no ar na pausa, com 200, noindex e sem
  // cache; o resto da vitrine continua na página de pausa com 503.
  it.each(['/termos', '/privacidade', '/politica-devolucao', '/cookies'])(
    'PAUSED: %s continua no ar (200, noindex, sem cache), sem leitura extra',
    async (page) => {
      const { call, siteState } = proxyWith({ mode: 'PAUSED', indexable: false })
      const response = await call(A + page)
      expect(isRewrite(response)).toBe(true)
      expect(getRewrittenUrl(response)).toBe(A + '/locadora-a' + page)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-robots-tag')).toBe('noindex')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('retry-after')).toBeNull()
      expect(siteState).toHaveBeenCalledTimes(1)
    }
  )

  it.each(['/orcamento', '/equipamentos', '/sobre'])('PAUSED: %s segue no 503 da pausa', async (page) => {
    const response = await proxyWith({ mode: 'PAUSED', indexable: false }).call(A + page)
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/site-pausado')
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('3600')
  })

  it('PAUSED também na home', async () => {
    const response = await proxyWith({ mode: 'PAUSED', indexable: false }).call(A + '/')
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/site-pausado')
    expect(response.status).toBe(503)
  })

  it('LIVE não indexável: a página da vitrine com X-Robots-Tag noindex', async () => {
    const response = await proxyWith({ mode: 'LIVE', indexable: false }).call(A + '/equipamentos')
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/equipamentos')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('LIVE indexável: o rewrite de sempre, sem noindex', async () => {
    const response = await proxyWith({ mode: 'LIVE', indexable: true }).call(A + '/equipamentos')
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/equipamentos')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBeNull()
  })

  it.each(['/', '/equipamentos', '/equipamentos/eq-1', '/orcamento', '/contato', '/site-pausado'])(
    'sem vitrine (404 do D10: desconhecida, bloqueada ou site desligado) em %s: o caminho interno do 404 neutro',
    async (path) => {
      const response = await proxyWith({ status: 'not-found' }).call(A + path + '?ref=x')
      expect(isRewrite(response)).toBe(true)
      expect(getRewrittenUrl(response)).toBe(A + '/_?ref=x')
      expect(response.status).toBe(200)
      expect(response.headers.get('x-robots-tag')).toBeNull()
    }
  )

  it('sem vitrine: a mesma resposta para locadoras diferentes', async () => {
    const b = await proxyWith({ status: 'not-found' }).call('https://locadora-b.plataforma.example/orcamento')
    expect(getRewrittenUrl(b)).toBe('https://locadora-b.plataforma.example/_')
  })

  it.each([
    ['leitura indisponível', { status: 'unavailable' } as const],
    ['leitura que falha', new Error('fixture-site-state')],
  ] as const)('%s: o rewrite de sempre (o layout da vitrine decide)', async (_caso, state) => {
    const response = await proxyWith(state).call(A + '/equipamentos')
    expect(getRewrittenUrl(response)).toBe(A + '/locadora-a/equipamentos')
    expect(response.status).toBe(200)
  })

  it.each([
    ['em pausa', { mode: 'PAUSED', indexable: false } as const],
    ['desligado (não publicado)', { status: 'not-found' } as const],
  ])('área do cliente e entrada continuam com o site %s, sem consultar (o layout da locadora decide)', async (_caso, state) => {
    const { call, siteState } = proxyWith(state)
    for (const path of ['/entrar', '/cadastro', '/area-cliente', '/area-cliente/historico/q-1', '/vincular']) {
      const response = await call(A + path)
      expect(getRewrittenUrl(response), path).toBe(A + '/locadora-a' + path)
      expect(response.status, path).toBe(200)
    }
    expect(siteState).not.toHaveBeenCalled()
  })

  it('robots.txt e sitemap.xml decidem o próprio estado', async () => {
    const { call, siteState } = proxyWith({ mode: 'PAUSED', indexable: false })
    expect(getRewrittenUrl(await call(A + '/robots.txt'))).toBe(A + '/locadora-a/robots.txt')
    expect(getRewrittenUrl(await call(A + '/sitemap.xml'))).toBe(A + '/locadora-a/sitemap.xml')
    expect(siteState).not.toHaveBeenCalled()
  })

  it('API, host app, apex e host sem backend nunca consultam o modo do site', async () => {
    const paused = { mode: 'PAUSED', indexable: false } as const
    const { call, siteState } = proxyWith(paused)
    expect(getRewrittenUrl(await call(A + '/api/categories'))).toBe(
      'https://backend.example/api/categories?tenantSlug=locadora-a'
    )
    await call('https://app.plataforma.example/admin')
    await call('https://plataforma.example/')
    expect(siteState).not.toHaveBeenCalled()
    const offline = proxyWith(paused, { apiOrigin: null })
    expect(getRewrittenUrl(await offline.call(A + '/equipamentos'))).toBe(A + '/locadora-a/equipamentos')
    expect(offline.siteState).not.toHaveBeenCalled()
  })
})
