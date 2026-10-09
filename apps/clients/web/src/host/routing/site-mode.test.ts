// S13: quais páginas do host de locadora o proxy entrega como vitrine em pausa, e com que resposta.
import { describe, expect, it } from 'vitest'
import { classifyHost, isTenantSlug, resolvePlatformEnv } from '@gb-locacoes/contracts/platform'
import {
  PAUSED_LEGAL_PAGE_HEADERS,
  SITE_NOT_FOUND_SEGMENT,
  pausedSiteServes,
  siteNotFoundRewrite,
  sitePausedRewrite,
  storefrontSlug,
} from './site-mode'

const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: 'x'.repeat(32),
  WEB_API_ORIGIN: 'https://backend.example',
})
const tenant = classifyHost('locadora-a.plataforma.example', env)

describe('storefrontSlug', () => {
  it.each([
    '/locadora-a',
    '/locadora-a/equipamentos',
    '/locadora-a/equipamentos/eq-1',
    '/locadora-a/orcamento',
    '/locadora-a/contato',
    '/locadora-a/sobre',
    '/locadora-a/termos',
    '/locadora-a/site-pausado',
    '/locadora-a/caminho-inexistente',
  ])('vitrine %s passa pelo modo do site', (rewritten) => {
    expect(storefrontSlug(tenant, rewritten)).toBe('locadora-a')
  })

  it.each([
    '/locadora-a/entrar',
    '/locadora-a/login',
    '/locadora-a/cadastro',
    '/locadora-a/recuperar-senha',
    '/locadora-a/reset-password',
    '/locadora-a/auth/callback',
    '/locadora-a/vincular',
    '/locadora-a/area-cliente',
    '/locadora-a/area-cliente/historico/q-1',
  ])('área do cliente %s continua com o site em pausa', (rewritten) => {
    expect(storefrontSlug(tenant, rewritten)).toBeNull()
  })

  it.each(['/locadora-a/robots.txt', '/locadora-a/sitemap.xml', '/locadora-a/manifest.json'])(
    '%s decide o próprio estado',
    (rewritten) => {
      expect(storefrontSlug(tenant, rewritten)).toBeNull()
    }
  )

  it('fora do host de locadora, ou fora do prefixo da locadora, não consulta', () => {
    expect(storefrontSlug(classifyHost('app.plataforma.example', env), '/locadora-a')).toBeNull()
    expect(storefrontSlug(classifyHost('plataforma.example', env), '/plataforma')).toBeNull()
    expect(storefrontSlug(tenant, '/locadora-ab/equipamentos')).toBeNull()
    expect(storefrontSlug(tenant, '/plataforma/equipamentos')).toBeNull()
  })
})

describe('siteNotFoundRewrite', () => {
  it('um só caminho interno, cujo segmento nunca é slug de locadora (o layout dá o 404 neutro sem consultar)', () => {
    expect(siteNotFoundRewrite()).toEqual({ pathname: '/_' })
    expect(SITE_NOT_FOUND_SEGMENT).toBe('_')
    expect(isTenantSlug(SITE_NOT_FOUND_SEGMENT)).toBe(false)
  })
})

describe('sitePausedRewrite', () => {
  it('a página de pausa da locadora com 503: Retry-After, sem cache e noindex', () => {
    expect(sitePausedRewrite('locadora-a')).toEqual({
      pathname: '/locadora-a/site-pausado',
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '3600', 'X-Robots-Tag': 'noindex' },
    })
  })
})

// Onda 134 (decisão do dono de 2026-10-06, item 4): na pausa, as páginas legais continuam no ar.
describe('pausedSiteServes', () => {
  it.each(['/locadora-a/termos', '/locadora-a/privacidade', '/locadora-a/politica-devolucao', '/locadora-a/cookies'])(
    'página legal %s continua no ar na pausa',
    (rewritten) => {
      expect(pausedSiteServes(tenant, rewritten)).toBe(true)
    }
  )

  it.each([
    '/locadora-a',
    '/locadora-a/equipamentos',
    '/locadora-a/orcamento',
    '/locadora-a/contato',
    '/locadora-a/sobre',
    '/locadora-a/termos/x',
    '/locadora-a/termos-antigos',
    '/locadora-a/site-pausado',
  ])('%s segue na página de pausa', (rewritten) => {
    expect(pausedSiteServes(tenant, rewritten)).toBe(false)
  })

  it('fora do host de locadora ou do prefixo, nada', () => {
    expect(pausedSiteServes(classifyHost('app.plataforma.example', env), '/locadora-a/termos')).toBe(false)
    expect(pausedSiteServes(tenant, '/locadora-b/termos')).toBe(false)
  })

  it('a página legal em pausa sai com noindex e sem cache', () => {
    expect(PAUSED_LEGAL_PAGE_HEADERS).toEqual({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' })
  })
})
