// S13 e SEO por host (ADR de hosts, D12): robots.txt da locadora conforme o modo do site.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TENANT_ACCOUNT_PATHS } from '../../../../host/routing/route-table'

const site = vi.hoisted(() => ({ fetchPublicSite: vi.fn() }))
vi.mock('../../../../host/server/public-api', () => ({ fetchPublicSite: site.fetchPublicSite }))

import { GET } from './route'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const call = (locadora = 'locadora-a') =>
  GET(new Request('http://web.internal/locadora-a/robots.txt'), { params: Promise.resolve({ locadora }) })

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'plataforma.example')
  vi.stubEnv('PLATFORM_EDGE_SECRET', 'x'.repeat(32))
  vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('robots.txt da locadora', () => {
  it('LIVE indexável em produção: áreas privadas fora e sitemap na origem canônica', async () => {
    site.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    const text = await response.text()
    expect(text.startsWith('User-agent: *\nAllow: /\n')).toBe(true)
    expect(text).not.toMatch(/^Disallow: \/$/m)
    expect(text).toContain('Sitemap: https://locadora-a.plataforma.example/sitemap.xml\n')
    for (const path of ['/api/', '/admin', '/site-pausado'])
      expect(text).toContain('Disallow: ' + path + '\n')
    // Mesmas áreas de conta da tabela do proxy (a árvore [locadora] não importa a tabela).
    for (const pattern of TENANT_ACCOUNT_PATHS)
      expect(text).toContain('Disallow: ' + pattern.replace(/\/\*\*$/, '') + '\n')
  })

  it.each([
    ['PAUSED', { mode: 'PAUSED', indexable: false }, 'no-store'],
    ['LIVE ainda não indexável', { mode: 'LIVE', indexable: false }, 'public, max-age=300'],
  ] as const)('%s: Disallow / sem sitemap', async (_caso, state, cache) => {
    site.fetchPublicSite.mockResolvedValue({ ...CARD, ...state })
    const response = await call()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
    expect(response.headers.get('cache-control')).toBe(cache)
  })

  it('fora de produção: Disallow / mesmo no ar e indexável', async () => {
    vi.stubEnv('PLATFORM_ENV', 'staging')
    site.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    expect(await (await call()).text()).toBe('User-agent: *\nDisallow: /\n')
  })

  it('OFF (sem cartão): o 404 neutro do D10, sem robots', async () => {
    site.fetchPublicSite.mockResolvedValue(null)
    await expect(call()).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
  })

  it('slug inválido ou reservado nem consulta o backend', async () => {
    await expect(call('admin')).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(site.fetchPublicSite).not.toHaveBeenCalled()
  })
})
