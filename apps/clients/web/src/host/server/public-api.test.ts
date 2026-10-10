// Gateway server-only do host web: locadora explícita na URL, 404 → null, falhas do backend e contrato estrito.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPublicCategoryNames,
  fetchPublicEquipment,
  fetchPublicSitemapCatalog,
  fetchPublicLegalDocument,
  fetchPublicSettings,
  fetchPublicSite,
  fetchTenantSite,
  getPublicSite,
  getTenantSite,
  PublicApiError,
  storefrontOf,
} from './public-api'

const ORIGIN = 'https://backend.example'

function fake(
  status: number,
  body: unknown,
  contentType = 'application/json',
  extraHeaders: Record<string, string> = {}
) {
  const calls: string[] = []
  const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
    calls.push(input)
    expect(init.cache).toBe('no-store')
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType, ...extraHeaders },
    })
  })
  return { calls, options: { apiOrigin: ORIGIN, fetch: fetchImpl } }
}

const CARD = {
  slug: 'locadora-a',
  name: 'Locadora A',
  city: 'Porto Alegre',
  state: 'RS',
  logoUrl: null,
}
const EQUIPMENT = {
  id: 'eq-1',
  name: 'Betoneira',
  description: null,
  pricePerDay: 120.5,
  imageUrl: null,
  images: ['https://cdn.example/eq.jpg'],
  isAvailable: true,
  category: {
    id: 'cat-1',
    name: 'Concreto',
    slug: 'concreto',
    icon: 'Box',
    iconColor: '#000',
    bgColor: '#fff',
    fontColor: '#111',
    customIcon: null,
  },
  dailyDiscount: 0,
  weeklyDiscount: 5,
  biweeklyDiscount: 0,
  monthlyDiscount: 10,
  popularPeriod: 'weekly',
  maxStock: 3,
  dailyDirectValue: 0,
  weeklyDirectValue: 0,
  biweeklyDirectValue: 0,
  monthlyDirectValue: 0,
  dailyUseDirectValue: false,
  weeklyUseDirectValue: false,
  biweeklyUseDirectValue: false,
  monthlyUseDirectValue: false,
  dailyRentalEnabled: true,
  weeklyRentalEnabled: true,
  biweeklyRentalEnabled: false,
  monthlyRentalEnabled: true,
  updatedAt: '2026-09-26T00:00:00.000Z',
}

describe('fetchPublicSite', () => {
  it('lê o cartão da locadora do segmento; sem o modo (backend anterior ao S13), no ar e indexável', async () => {
    const { calls, options } = fake(200, CARD)
    await expect(fetchPublicSite('locadora-a', options)).resolves.toEqual({
      ...CARD,
      mode: 'LIVE',
      indexable: true,
    })
    expect(calls).toEqual([ORIGIN + '/api/public/tenants/locadora-a'])
  })

  it.each([
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'true' }, 'LIVE', true],
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'false' }, 'LIVE', false],
    [{ 'x-site-mode': 'LIVE' }, 'LIVE', false],
    [{ 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' }, 'PAUSED', false],
    [{ 'x-site-mode': 'PAUSED', 'x-site-indexable': 'true' }, 'PAUSED', false],
  ] as const)(
    'S13: modo do site pelos cabeçalhos do cartão %j',
    async (headers, mode, indexable) => {
      const { options } = fake(200, CARD, 'application/json', headers)
      await expect(fetchPublicSite('locadora-a', options)).resolves.toEqual({
        ...CARD,
        mode,
        indexable,
      })
    }
  )

  it.each(['OFF', 'live', 'PAUSADO'])(
    'S13: modo fora do contrato (%s) lança',
    async (mode) => {
      const { options } = fake(200, CARD, 'application/json', {
        'x-site-mode': mode,
      })
      await expect(
        fetchPublicSite('locadora-a', options)
      ).rejects.toBeInstanceOf(PublicApiError)
    }
  )

  it('404 do backend (inexistente, suspensa) vira null; slug inválido ou reservado nem consulta', async () => {
    const notFound = fake(404, { error: 'Locadora não encontrada' })
    await expect(
      fetchPublicSite('locadora-z', notFound.options)
    ).resolves.toBeNull()
    const untouched = fake(200, CARD)
    for (const slug of [
      'a',
      'admin',
      'plataforma',
      'Locadora-A',
      'a--b',
      '../x',
      'locadora-a/..',
    ]) {
      await expect(fetchPublicSite(slug, untouched.options)).resolves.toBeNull()
    }
    expect(untouched.calls).toEqual([])
  })

  it('falha do backend ou cartão fora do contrato lança (não vira 404 silencioso)', async () => {
    await expect(
      fetchPublicSite('locadora-a', fake(500, { error: 'x' }).options)
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchPublicSite(
        'locadora-a',
        fake(200, { ...CARD, cnpj: '00.000.000/0001-00' }).options
      )
    ).rejects.toThrow('fora do contrato')
    await expect(
      fetchPublicSite(
        'locadora-a',
        fake(200, { ...CARD, slug: 'locadora-b' }).options
      )
    ).rejects.toThrow('fora do contrato')
    const offline = {
      apiOrigin: ORIGIN,
      fetch: vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))),
    }
    await expect(fetchPublicSite('locadora-a', offline)).rejects.toBeInstanceOf(
      PublicApiError
    )
  })
})

describe('fetchTenantSite (escopo da área do cliente, S13 e B.5)', () => {
  it('pede o cartão com ?scope=client-area e aceita o site desligado (OFF)', async () => {
    const { calls, options } = fake(200, CARD, 'application/json', {
      'x-site-mode': 'OFF',
      'x-site-indexable': 'false',
    })
    await expect(fetchTenantSite('locadora-a', options)).resolves.toEqual({
      ...CARD,
      mode: 'OFF',
      indexable: false,
    })
    expect(calls).toEqual([
      ORIGIN + '/api/public/tenants/locadora-a?scope=client-area',
    ])
  })

  it.each([
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'true' }, 'LIVE', true],
    [{ 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' }, 'PAUSED', false],
    [{}, 'LIVE', true],
  ] as const)('%j → %s', async (headers, mode, indexable) => {
    const { options } = fake(200, CARD, 'application/json', headers)
    await expect(fetchTenantSite('locadora-a', options)).resolves.toEqual({
      ...CARD,
      mode,
      indexable,
    })
  })

  it('404 (sem área do cliente nem vitrine) vira null; slug inválido nem consulta', async () => {
    await expect(
      fetchTenantSite('locadora-z', fake(404, { error: 'x' }).options)
    ).resolves.toBeNull()
    const untouched = fake(200, CARD)
    for (const slug of ['_', 'admin', 'Locadora'])
      await expect(fetchTenantSite(slug, untouched.options)).resolves.toBeNull()
    expect(untouched.calls).toEqual([])
  })

  it('falha do backend, modo ou cartão fora do contrato lançam', async () => {
    await expect(
      fetchTenantSite('locadora-a', fake(500, { error: 'x' }).options)
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchTenantSite(
        'locadora-a',
        fake(200, CARD, 'application/json', { 'x-site-mode': 'off' }).options
      )
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchTenantSite(
        'locadora-a',
        fake(200, { ...CARD, slug: 'outra' }).options
      )
    ).rejects.toBeInstanceOf(PublicApiError)
  })
})

describe('storefrontOf (a vitrine a partir do cartão da área do cliente)', () => {
  it('site desligado não tem vitrine; no ar e em pausa, sim', () => {
    expect(storefrontOf(null)).toBeNull()
    expect(storefrontOf({ ...CARD, mode: 'OFF', indexable: false })).toBeNull()
    expect(storefrontOf({ ...CARD, mode: 'PAUSED', indexable: false })).toEqual(
      {
        ...CARD,
        mode: 'PAUSED',
        indexable: false,
      }
    )
    expect(storefrontOf({ ...CARD, mode: 'LIVE', indexable: true })).toEqual({
      ...CARD,
      mode: 'LIVE',
      indexable: true,
    })
  })
})

describe('getTenantSite e getPublicSite (uma leitura do cartão com escopo)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it.each([
    ['OFF', null],
    ['PAUSED', 'PAUSED'],
    ['LIVE', 'LIVE'],
  ] as const)(
    'site %s: a área do cliente responde; a vitrine é %s',
    async (mode, storefront) => {
      vi.stubEnv('PLATFORM_ENV', 'production')
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'plataforma.example')
      vi.stubEnv('PLATFORM_EDGE_SECRET', 'x'.repeat(40))
      vi.stubEnv('WEB_API_ORIGIN', ORIGIN)
      const calls: string[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
          calls.push(input)
          return new Response(JSON.stringify(CARD), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'x-site-mode': mode,
              'x-site-indexable': 'false',
            },
          })
        })
      )
      await expect(getTenantSite('locadora-a')).resolves.toMatchObject({
        slug: 'locadora-a',
        mode,
      })
      const site = await getPublicSite('locadora-a')
      expect(site === null ? null : site.mode).toBe(storefront)
      expect(new Set(calls)).toEqual(
        new Set([ORIGIN + '/api/public/tenants/locadora-a?scope=client-area'])
      )
    }
  )
})

/** Backend simulado por caminho: cada leitura responde a sua fixture; caminho sem fixture responde 404. */
function routes(table: Record<string, { status: number; body: unknown }>) {
  const calls: string[] = []
  const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
    calls.push(input)
    expect(init.cache).toBe('no-store')
    const answer = table[input.slice(ORIGIN.length).split('?')[0]!]
    return new Response(answer ? JSON.stringify(answer.body) : null, {
      status: answer?.status ?? 404,
      headers: { 'content-type': 'application/json' },
    })
  })
  return { calls, options: { apiOrigin: ORIGIN, fetch: fetchImpl } }
}

// S13 e onda 135 (A7): o sitemap da locadora lê o catálogo e as categorias públicas; categoria só entra com equipamento
// disponível, preservando o comportamento do antigo app/sitemap.ts da raiz, retirado no clone F.
describe('fetchPublicSitemapCatalog (sitemap, S13 e onda 135)', () => {
  const CATEGORIES = [
    { id: 'cat-1', slug: 'andaimes', updatedAt: '2026-09-01T10:00:00.000Z' },
    { id: 'cat-2', slug: 'betoneiras', updatedAt: '2026-09-02T10:00:00.000Z' },
    {
      id: 'cat-3',
      slug: 'sem-disponivel',
      updatedAt: '2026-09-03T10:00:00.000Z',
    },
    { id: 'cat-4', slug: 'data-invalida', updatedAt: 'ontem' },
    { id: 'cat-5', name: 'sem slug' },
    'lixo',
  ]
  const EQUIPMENTS = [
    { id: 'eq-1', isAvailable: true, category: { id: 'cat-1' } },
    { id: 'eq-2', category: { id: 'cat-2' } },
    { id: 'eq-3', isAvailable: false, category: { id: 'cat-3' } },
    { id: '../x', category: { id: 'cat-4' } },
    { name: 'sem id', category: { id: 'cat-5' } },
    { id: 'eq-4', category: null },
    'lixo',
  ]

  it('lê catálogo e categorias com tenantSlug explícito; só ids válidos e categorias com equipamento disponível', async () => {
    const { calls, options } = routes({
      '/api/equipments': { status: 200, body: EQUIPMENTS },
      '/api/categories': { status: 200, body: CATEGORIES },
    })
    await expect(
      fetchPublicSitemapCatalog('locadora-a', options)
    ).resolves.toEqual({
      equipmentIds: ['eq-1', 'eq-2', 'eq-4'],
      categories: [
        { slug: 'andaimes', updatedAt: '2026-09-01T10:00:00.000Z' },
        { slug: 'betoneiras', updatedAt: '2026-09-02T10:00:00.000Z' },
        // Data fora do formato: a categoria entra sem lastmod.
        { slug: 'data-invalida', updatedAt: null },
      ],
    })
    expect(calls.sort()).toEqual([
      ORIGIN + '/api/categories?tenantSlug=locadora-a',
      ORIGIN + '/api/equipments?tenantSlug=locadora-a',
    ])
  })

  it('slug inválido não consulta; falha ou resposta fora do contrato em qualquer leitura lança', async () => {
    const untouched = routes({})
    await expect(
      fetchPublicSitemapCatalog('admin', untouched.options)
    ).resolves.toEqual({ equipmentIds: [], categories: [] })
    expect(untouched.calls).toEqual([])
    for (const table of [
      {
        '/api/equipments': { status: 503, body: { code: 'SITE_PAUSED' } },
        '/api/categories': { status: 200, body: [] },
      },
      {
        '/api/equipments': { status: 200, body: { items: [] } },
        '/api/categories': { status: 200, body: [] },
      },
      {
        '/api/equipments': { status: 200, body: [] },
        '/api/categories': { status: 500, body: {} },
      },
      {
        '/api/equipments': { status: 200, body: [] },
        '/api/categories': { status: 200, body: { x: 1 } },
      },
    ])
      await expect(
        fetchPublicSitemapCatalog('locadora-a', routes(table).options)
      ).rejects.toBeInstanceOf(PublicApiError)
  })
})

describe('fetchPublicEquipment', () => {
  it('pede o detalhe com tenantSlug explícito', async () => {
    const { calls, options } = fake(200, EQUIPMENT)
    const equipment = await fetchPublicEquipment('locadora-a', 'eq-1', options)
    expect(calls).toEqual([
      ORIGIN + '/api/equipments/eq-1?tenantSlug=locadora-a',
    ])
    expect(equipment).toMatchObject({
      id: 'eq-1',
      pricePerDay: 120.5,
      isAvailable: true,
      maxStock: 3,
      biweeklyRentalEnabled: false,
    })
    expect(equipment?.category).toEqual(EQUIPMENT.category)
  })

  it('equipamento de outra locadora (404) vira null; id inválido nem consulta', async () => {
    await expect(
      fetchPublicEquipment(
        'locadora-a',
        'eq-b',
        fake(404, { error: 'x' }).options
      )
    ).resolves.toBeNull()
    const untouched = fake(200, EQUIPMENT)
    await expect(
      fetchPublicEquipment('locadora-a', '../admin', untouched.options)
    ).resolves.toBeNull()
    await expect(
      fetchPublicEquipment('admin', 'eq-1', untouched.options)
    ).resolves.toBeNull()
    expect(untouched.calls).toEqual([])
  })

  it('resposta fora do contrato ou de outro id lança', async () => {
    await expect(
      fetchPublicEquipment(
        'locadora-a',
        'eq-1',
        fake(200, { ...EQUIPMENT, id: 'eq-2' }).options
      )
    ).rejects.toThrow()
    await expect(
      fetchPublicEquipment(
        'locadora-a',
        'eq-1',
        fake(200, { ...EQUIPMENT, category: null }).options
      )
    ).rejects.toThrow()
    await expect(
      fetchPublicEquipment(
        'locadora-a',
        'eq-1',
        fake(409, { error: 'x' }).options
      )
    ).rejects.toThrow()
  })
})

describe('fetchPublicSettings', () => {
  it('lê as configurações públicas com tenantSlug explícito', async () => {
    const { calls, options } = fake(200, {
      companyPhone: '51 9999',
      heroCarousel: [],
      waveAnimation: 'animated',
      socialLinks: {},
    })
    await expect(
      fetchPublicSettings('locadora-a', options)
    ).resolves.toMatchObject({
      companyPhone: '51 9999',
      heroCarousel: [],
      waveAnimation: 'animated',
    })
    expect(calls).toEqual([
      ORIGIN + '/api/settings/public?tenantSlug=locadora-a',
    ])
  })

  // Achado 143: as redes da própria locadora entram no JSON-LD (sameAs); valor fora de objeto fica de fora.
  it('repassa as redes sociais da locadora só quando são um objeto', async () => {
    const links = { facebook: 'https://facebook.example.test/locadora-a' }
    await expect(
      fetchPublicSettings(
        'locadora-a',
        fake(200, { socialLinks: links }).options
      )
    ).resolves.toMatchObject({ socialLinks: links })
    expect(
      (
        await fetchPublicSettings(
          'locadora-a',
          fake(200, { socialLinks: ['x'] }).options
        )
      )?.socialLinks
    ).toBeUndefined()
  })

  it('sem configuração (409) ou com o backend fora cai nos padrões da página (null)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      fetchPublicSettings(
        'locadora-a',
        fake(409, { code: 'SETTINGS_NOT_CONFIGURED' }).options
      )
    ).resolves.toBeNull()
    await expect(
      fetchPublicSettings('locadora-a', fake(500, {}).options)
    ).resolves.toBeNull()
    const offline = {
      apiOrigin: ORIGIN,
      fetch: vi.fn(async () => Promise.reject(new Error('down'))),
    }
    await expect(fetchPublicSettings('locadora-a', offline)).resolves.toBeNull()
  })
})

// Onda 134 (lote vitrine-conteúdo): conteúdo institucional, horário e textos legais da própria locadora no SSR.
describe('fetchPublicSettings: conteúdo institucional e documentos (onda 134)', () => {
  it('repassa siteContent, businessHours e legalDocuments para a página (a validação é das entidades)', async () => {
    const corpo = {
      siteContent: { experienceYears: 10 },
      businessHours: { monday: { closed: true } },
      legalDocuments: { terms: true, privacy: false, returnPolicy: true },
    }
    await expect(
      fetchPublicSettings('locadora-a', fake(200, corpo).options)
    ).resolves.toMatchObject(corpo)
  })
})

// Onda 135 (A4): o SEO que a locadora gravou no painel chega à home; o null da leitura pública (sem título) fica ausente.
describe('fetchPublicSettings: SEO da locadora (onda 135, A4)', () => {
  it('repassa seoTitle e seoDescription quando são texto; null ou outro tipo ficam ausentes', async () => {
    await expect(
      fetchPublicSettings(
        'locadora-a',
        fake(200, {
          seoTitle: 'Locadora A | Andaimes',
          seoDescription: 'Andaimes em Curitiba.',
        }).options
      )
    ).resolves.toMatchObject({
      seoTitle: 'Locadora A | Andaimes',
      seoDescription: 'Andaimes em Curitiba.',
    })
    const semSeo = await fetchPublicSettings(
      'locadora-a',
      fake(200, { seoTitle: null, seoDescription: 42 }).options
    )
    expect(semSeo?.seoTitle).toBeUndefined()
    expect(semSeo?.seoDescription).toBeUndefined()
  })
})

describe('fetchPublicCategoryNames (catálogo do JSON-LD, onda 134)', () => {
  it('lê as categorias da locadora com tenantSlug explícito e devolve só os nomes', async () => {
    const { calls, options } = fake(200, [
      { id: 'c1', name: 'Andaimes' },
      { id: 'c2', name: 'Betoneiras' },
      { id: 'c3', name: 7 },
      'x',
    ])
    await expect(
      fetchPublicCategoryNames('locadora-a', options)
    ).resolves.toEqual(['Andaimes', 'Betoneiras'])
    expect(calls).toEqual([ORIGIN + '/api/categories?tenantSlug=locadora-a'])
  })

  it('falha ou resposta fora do contrato: nenhum catálogo (o JSON-LD é opcional; a home não cai)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      fetchPublicCategoryNames('locadora-a', fake(500, {}).options)
    ).resolves.toEqual([])
    await expect(
      fetchPublicCategoryNames('locadora-a', fake(200, { x: 1 }).options)
    ).resolves.toEqual([])
    const { calls, options } = fake(200, [])
    await expect(
      fetchPublicCategoryNames('Inválido!', options)
    ).resolves.toEqual([])
    expect(calls).toEqual([])
  })
})

describe('fetchPublicLegalDocument (páginas legais no SSR, onda 134)', () => {
  const DOCUMENTO = {
    version: 1,
    lastUpdated: '1 de março de 2026',
    sections: [
      {
        id: 'uso',
        title: 'Uso',
        blocks: [{ type: 'paragraph', text: 'Texto.' }],
      },
    ],
  }

  it('lê o documento publicado da locadora pelo segmento do tipo, com tenantSlug explícito', async () => {
    const { calls, options } = fake(200, {
      kind: 'returnPolicy',
      document: DOCUMENTO,
      publishedAt: '2026-03-01T12:00:00.000Z',
    })
    await expect(
      fetchPublicLegalDocument('locadora-a', 'returnPolicy', options)
    ).resolves.toEqual({
      document: DOCUMENTO,
      publishedAt: '2026-03-01T12:00:00.000Z',
    })
    expect(calls).toEqual([
      ORIGIN +
        '/api/settings/public/legal-documents/return-policy?tenantSlug=locadora-a',
    ])
  })

  it('só o 404 vira null (documento não publicado); slug inválido nem consulta', async () => {
    await expect(
      fetchPublicLegalDocument(
        'locadora-a',
        'terms',
        fake(404, { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' }).options
      )
    ).resolves.toBeNull()
    const { calls, options } = fake(200, {})
    await expect(
      fetchPublicLegalDocument('Inválido!', 'terms', options)
    ).resolves.toBeNull()
    expect(calls).toEqual([])
  })

  it('falha do backend, versão desconhecida ou documento fora do contrato lançam (nunca um 404 falso)', async () => {
    await expect(
      fetchPublicLegalDocument('locadora-a', 'terms', fake(500, {}).options)
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchPublicLegalDocument('locadora-a', 'terms', fake(503, {}).options)
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchPublicLegalDocument(
        'locadora-a',
        'terms',
        fake(200, {
          kind: 'terms',
          document: { ...DOCUMENTO, version: 2 },
          publishedAt: '2026-03-01T12:00:00.000Z',
        }).options
      )
    ).rejects.toBeInstanceOf(PublicApiError)
    await expect(
      fetchPublicLegalDocument(
        'locadora-a',
        'terms',
        fake(200, { kind: 'terms', document: { version: 1 } }).options
      )
    ).rejects.toBeInstanceOf(PublicApiError)
    const offline = {
      apiOrigin: ORIGIN,
      fetch: vi.fn(async () => Promise.reject(new Error('down'))),
    }
    await expect(
      fetchPublicLegalDocument('locadora-a', 'privacy', offline)
    ).rejects.toBeInstanceOf(PublicApiError)
  })
})
