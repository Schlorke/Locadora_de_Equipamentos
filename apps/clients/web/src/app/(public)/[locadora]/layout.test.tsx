// S13: o layout da locadora, pai da vitrine e da área do cliente, lê o cartão no escopo da área do cliente (B.5, linha
// "Área do cliente final"). Continua com o site em pausa ou desligado por falta de publicação; sem área do cliente
// (locadora desconhecida, bloqueada, SETUP ou ARCHIVED com a fiscalização on), o 404 neutro do D10. Aplica o noindex
// do modo do site (pausa, desligado e "noindex até a 1ª fatura paga").
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getTenantSite: vi.fn(),
  getPublicSettings: vi.fn(),
}))
vi.mock('../../../host/server/public-api', () => api)
vi.mock('../../../host/providers/TenantSiteProviders', () => ({
  TenantSiteProviders: ({ children }: { children: unknown }) => children,
}))

import TenantSiteLayout, { generateMetadata } from './layout'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const params = (locadora = 'locadora-a') => ({ params: Promise.resolve({ locadora }) })

afterEach(() => vi.resetAllMocks())

describe('layout [locadora]', () => {
  it.each([
    ['LIVE indexável', { mode: 'LIVE', indexable: true }, {}],
    ['LIVE ainda não indexável', { mode: 'LIVE', indexable: false }, { robots: { index: false, follow: false } }],
    ['PAUSED', { mode: 'PAUSED', indexable: false }, { robots: { index: false, follow: false } }],
    ['OFF com área do cliente', { mode: 'OFF', indexable: false }, { robots: { index: false, follow: false } }],
  ] as const)('%s → %j', async (_caso, state, metadata) => {
    api.getTenantSite.mockResolvedValue({ ...CARD, ...state })
    expect(await generateMetadata(params())).toEqual(metadata)
  })

  it.each([
    ['no ar', 'LIVE'],
    ['em pausa', 'PAUSED'],
    ['desligado por falta de publicação (entrada e área do cliente continuam)', 'OFF'],
  ] as const)('site %s: renderiza a árvore da locadora', async (_caso, mode) => {
    api.getTenantSite.mockResolvedValue({ ...CARD, mode, indexable: false })
    const element = await TenantSiteLayout({ children: 'area-cliente', ...params() })
    expect(element.props).toEqual({
      tenantSlug: 'locadora-a',
      identity: { name: 'Locadora A', city: null, state: null, logoUrl: null },
      // Onda 134: o modo do site escolhe a moldura das páginas legais na pausa.
      siteMode: mode,
      children: 'area-cliente',
    })
    expect(api.getTenantSite).toHaveBeenCalledWith('locadora-a')
  })

  // Achado 143 (T12): a identidade da vitrine é a do cartão da própria locadora, com cidade, UF e logo dela.
  it('repassa a identidade do cartão da locadora aos providers', async () => {
    api.getTenantSite.mockResolvedValue({
      ...CARD,
      name: 'Andaimes Sul',
      city: 'Curitiba',
      state: 'PR',
      logoUrl: 'https://cdn.example/logo.png',
      mode: 'LIVE',
      indexable: true,
    })
    const element = await TenantSiteLayout({ children: null, ...params() })
    expect(element.props.identity).toEqual({
      name: 'Andaimes Sul',
      city: 'Curitiba',
      state: 'PR',
      logoUrl: 'https://cdn.example/logo.png',
    })
  })

  it('sem área do cliente nem vitrine (sem cartão): metadata vazia e o 404 neutro', async () => {
    api.getTenantSite.mockResolvedValue(null)
    expect(await generateMetadata(params())).toEqual({})
    await expect(TenantSiteLayout({ children: null, ...params() })).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
  })

  it.each(['admin', '_'])('slug inválido (%s): nada é consultado', async (slug) => {
    expect(await generateMetadata(params(slug))).toEqual({})
    await expect(TenantSiteLayout({ children: null, ...params(slug) })).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
    expect(api.getTenantSite).not.toHaveBeenCalled()
  })
})

// Onda 135, A11 (decisão do dono D4): medição e verificação da própria locadora, só com os identificadores válidos que
// ela gravou no painel (`siteContent`), num modelo fixo.
describe('layout [locadora]: medição e verificação da locadora (onda 135, A11)', () => {
  const GA = 'G-5ABCDE1234'
  const ADS = 'AW-123456789'
  const GOOGLE = 'abcDEF0123456789_-xyzABCDEFGHIJ012345678'
  const META = 'abcdefghij0123456789abcdefghij'
  const LIVE = { ...CARD, mode: 'LIVE', indexable: true }

  it('metas de verificação do Google e da Meta com os códigos da locadora, junto do noindex do modo do site', async () => {
    api.getTenantSite.mockResolvedValue(LIVE)
    api.getPublicSettings.mockResolvedValue({
      siteContent: {
        googleSiteVerification: GOOGLE,
        facebookDomainVerification: META,
      },
    })
    expect(await generateMetadata(params())).toEqual({
      verification: { google: GOOGLE },
      other: { 'facebook-domain-verification': META },
    })
    expect(api.getPublicSettings).toHaveBeenCalledWith('locadora-a')
    api.getTenantSite.mockResolvedValue({ ...LIVE, indexable: false })
    expect(await generateMetadata(params())).toEqual({
      robots: { index: false, follow: false },
      verification: { google: GOOGLE },
      other: { 'facebook-domain-verification': META },
    })
  })

  it('código fora do formato ou ausente: nenhuma meta', async () => {
    api.getTenantSite.mockResolvedValue(LIVE)
    api.getPublicSettings.mockResolvedValue({
      siteContent: {
        googleSiteVerification: '"><script>alert(1)</script>',
        facebookDomainVerification: 'curto',
      },
    })
    expect(await generateMetadata(params())).toEqual({})
    api.getPublicSettings.mockResolvedValue(null)
    expect(await generateMetadata(params())).toEqual({})
  })

  it('com GA4 e Ads, a tag do Google da locadora entra depois da árvore; sem eles, só a árvore', async () => {
    api.getTenantSite.mockResolvedValue(LIVE)
    api.getPublicSettings.mockResolvedValue({
      siteContent: { googleAnalyticsId: GA, googleAdsId: ADS },
    })
    const element = (await TenantSiteLayout({ children: 'vitrine', ...params() })) as {
      props: { children: Array<{ props: Record<string, unknown> }> }
    }
    const [providers, gtag, config] = element.props.children
    expect(providers!.props).toMatchObject({ tenantSlug: 'locadora-a', children: 'vitrine' })
    expect(gtag!.props).toEqual({
      id: 'tag-do-google',
      src: 'https://www.googletagmanager.com/gtag/js?id=' + ADS,
      strategy: 'afterInteractive',
    })
    expect(config!.props.id).toBe('tag-do-google-config')
    expect(config!.props.children).toContain(`gtag('config', "${GA}");`)
    expect(config!.props.children).toContain(`gtag('config', "${ADS}");`)

    // Só a verificação (sem GA4 nem Ads), ou ID inválido: nenhuma tag, a árvore como antes.
    for (const siteContent of [
      { googleSiteVerification: GOOGLE },
      { googleAnalyticsId: "G-1');alert(1);//" },
    ]) {
      api.getPublicSettings.mockResolvedValue({ siteContent })
      const semTag = await TenantSiteLayout({ children: 'vitrine', ...params() })
      expect(semTag.props).toMatchObject({ tenantSlug: 'locadora-a', children: 'vitrine' })
    }
  })
})
