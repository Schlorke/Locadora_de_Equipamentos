// S13 e SEO por host (ADR de hosts, D12): sitemap.xml da locadora conforme o modo do site.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  fetchPublicSite: vi.fn(),
  fetchPublicSitemapCatalog: vi.fn(),
  fetchPublicSettings: vi.fn(),
}))
vi.mock('../../../../host/server/public-api', () => api)

import { GET } from './route'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const ORIGIN = 'https://locadora-a.plataforma.example'
const NOW = '2026-10-08T12:00:00.000Z'
const call = (locadora = 'locadora-a') =>
  GET(new Request('http://web.internal/locadora-a/sitemap.xml'), { params: Promise.resolve({ locadora }) })
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
/** Cada `<url>` com os campos do protocolo (ausente = `undefined`). */
const entries = (xml: string) =>
  [...xml.matchAll(/<url>(.*?)<\/url>/g)].map(([, url]) => {
    const field = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(url!)?.[1]
    return {
      loc: field('loc'),
      lastmod: field('lastmod'),
      changefreq: field('changefreq'),
      priority: field('priority'),
    }
  })
const CATALOG = {
  equipmentIds: ['eq-1', 'eq_2'],
  categories: [{ slug: 'andaimes', updatedAt: '2026-09-01T10:00:00.000Z' }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'plataforma.example')
  vi.stubEnv('PLATFORM_EDGE_SECRET', 'x'.repeat(32))
  vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('sitemap.xml da locadora', () => {
  it('LIVE indexável: páginas fixas, equipamentos disponíveis e categorias na origem canônica', async () => {
    api.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    api.fetchPublicSettings.mockResolvedValue({ legalDocuments: { terms: true, privacy: true, returnPolicy: true } })
    api.fetchPublicSitemapCatalog.mockResolvedValue(CATALOG)
    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(response.headers.get('x-robots-tag')).toBeNull()
    const xml = await response.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')).toBe(true)
    expect(locs(xml)).toEqual([
      ORIGIN + '/',
      ...['/equipamentos', '/sobre', '/contato', '/orcamento', '/privacidade', '/termos', '/cookies'].map((path) => ORIGIN + path),
      ORIGIN + '/equipamentos/eq-1',
      ORIGIN + '/equipamentos/eq_2',
      ORIGIN + '/equipamentos?categoria=andaimes',
    ])
    expect(api.fetchPublicSitemapCatalog).toHaveBeenCalledExactlyOnceWith('locadora-a')
  })

  // Onda 135 (A7; M3 do plano de aposentadoria da raiz): a frequência, a prioridade e a data de cada URL são as do
  // app/sitemap.ts da raiz legada, e as categorias com equipamento disponível voltam como filtro do catálogo.
  it('LIVE indexável: frequência, prioridade e lastmod do sitemap da raiz legada', async () => {
    api.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    api.fetchPublicSettings.mockResolvedValue({ legalDocuments: { terms: true, privacy: true } })
    api.fetchPublicSitemapCatalog.mockResolvedValue(CATALOG)
    const page = (path: string, changefreq: string, priority: string) => ({
      loc: ORIGIN + path,
      lastmod: NOW,
      changefreq,
      priority,
    })
    expect(entries(await (await call()).text())).toEqual([
      page('/', 'daily', '1'),
      page('/equipamentos', 'weekly', '0.9'),
      page('/sobre', 'monthly', '0.7'),
      page('/contato', 'monthly', '0.8'),
      page('/orcamento', 'weekly', '0.8'),
      page('/privacidade', 'yearly', '0.3'),
      page('/termos', 'yearly', '0.3'),
      page('/cookies', 'yearly', '0.3'),
      // A leitura pública do catálogo não traz a data de alteração do equipamento: sem lastmod.
      { loc: ORIGIN + '/equipamentos/eq-1', lastmod: undefined, changefreq: 'weekly', priority: '0.8' },
      { loc: ORIGIN + '/equipamentos/eq_2', lastmod: undefined, changefreq: 'weekly', priority: '0.8' },
      {
        loc: ORIGIN + '/equipamentos?categoria=andaimes',
        lastmod: '2026-09-01T10:00:00.000Z',
        changefreq: 'weekly',
        priority: '0.7',
      },
    ])
  })

  it('categoria sem data e slug com caracteres especiais: sem lastmod, slug codificado e XML escapado', async () => {
    api.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    api.fetchPublicSettings.mockResolvedValue(null)
    api.fetchPublicSitemapCatalog.mockResolvedValue({
      equipmentIds: [],
      categories: [{ slug: 'pás & "cia"', updatedAt: null }],
    })
    const xml = await (await call()).text()
    expect(xml).toContain(
      '<url><loc>' + ORIGIN + '/equipamentos?categoria=p%C3%A1s%20%26%20%22cia%22</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>'
    )
  })

  it('catálogo indisponível: só as páginas fixas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    api.fetchPublicSettings.mockResolvedValue({ legalDocuments: { terms: true, privacy: true, returnPolicy: true } })
    api.fetchPublicSitemapCatalog.mockRejectedValue(new Error('fixture-catalog'))
    expect(locs(await (await call()).text())).toHaveLength(8)
  })

  it.each([
    ['PAUSED', { mode: 'PAUSED', indexable: false }, 'no-store'],
    ['LIVE ainda não indexável', { mode: 'LIVE', indexable: false }, 'public, max-age=300'],
  ] as const)('%s: sitemap vazio e noindex, sem ler o catálogo', async (_caso, state, cache) => {
    api.fetchPublicSite.mockResolvedValue({ ...CARD, ...state })
    const response = await call()
    expect(response.status).toBe(200)
    expect(locs(await response.text())).toEqual([])
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(response.headers.get('cache-control')).toBe(cache)
    expect(api.fetchPublicSitemapCatalog).not.toHaveBeenCalled()
  })

  // Onda 134: as páginas legais só entram publicadas (Cookies, da plataforma, sempre); a de Devolução continua fora,
  // como na produção.
  it('LIVE indexável: só os documentos legais que a locadora publicou', async () => {
    api.fetchPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    api.fetchPublicSitemapCatalog.mockResolvedValue({ equipmentIds: [], categories: [] })
    api.fetchPublicSettings.mockResolvedValue({ legalDocuments: { terms: true, privacy: false, returnPolicy: true } })
    expect(locs(await (await call()).text())).toEqual(
      ['/', '/equipamentos', '/sobre', '/contato', '/orcamento', '/termos', '/cookies'].map((path) => ORIGIN + path)
    )
    expect(api.fetchPublicSettings).toHaveBeenCalledWith('locadora-a')
    api.fetchPublicSettings.mockResolvedValue(null)
    expect(locs(await (await call()).text())).toEqual(
      ['/', '/equipamentos', '/sobre', '/contato', '/orcamento', '/cookies'].map((path) => ORIGIN + path)
    )
  })

  it('OFF (sem cartão): o 404 neutro do D10', async () => {
    api.fetchPublicSite.mockResolvedValue(null)
    await expect(call()).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(api.fetchPublicSitemapCatalog).not.toHaveBeenCalled()
  })
})
