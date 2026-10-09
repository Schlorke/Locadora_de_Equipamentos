// S13: página da vitrine em pausa. O proxy a entrega com 503 quando o cartão diz PAUSED; com o site no ar ou
// desligado é o 404 neutro. Contato da locadora e entrada da área do cliente (fora do modo legacy).
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getPublicSite: vi.fn(), getPublicSettings: vi.fn() }))
vi.mock('../../../../../host/server/public-api', () => api)

import Page, { generateMetadata } from './page'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const params = (locadora = 'locadora-a') => ({ params: Promise.resolve({ locadora }) })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'better-auth')
  api.getPublicSite.mockResolvedValue({ ...CARD, mode: 'PAUSED', indexable: false })
  api.getPublicSettings.mockResolvedValue({
    companyPhone: '(51) 3333-0000',
    whatsappNumber: '(51) 99999-0000',
    contactEmail: 'contato@locadora-a.test',
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('/site-pausado no host de locadora', () => {
  it('PAUSED: aviso neutro com o contato da locadora e a área do cliente', async () => {
    const html = renderToStaticMarkup(await Page(params()))
    expect(html).toContain('Site temporariamente indisponível')
    expect(html).toContain('Locadora A')
    expect(html).toContain('href="tel:+555133330000"')
    expect(html).toContain('href="https://wa.me/5551999990000"')
    expect(html).toContain('href="mailto:contato@locadora-a.test"')
    expect(html).toContain('href="/area-cliente"')
    expect(html).not.toMatch(/assinatura|d[ií]vida|fatura|plataforma/i)
  })

  // Achado 142: moldura neutra com a marca e a cidade da própria locadora, sem a navegação da vitrine.
  it('PAUSED: moldura neutra da locadora, sem catálogo, orçamento, carrinho, busca, categorias nem dado da GB', async () => {
    api.getPublicSite.mockResolvedValue({ ...CARD, city: 'Canoas', state: 'RS', mode: 'PAUSED', indexable: false })
    const html = renderToStaticMarkup(await Page(params()))
    expect(html).toContain('Locadora A · Canoas/RS')
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
    // Onda 134: o rodapé liga as páginas legais que continuam no ar (aqui, nenhum documento publicado: só Cookies).
    expect(hrefs).toEqual([
      'tel:+555133330000',
      'https://wa.me/5551999990000',
      'mailto:contato@locadora-a.test',
      '/area-cliente',
      '/cookies',
    ])
    expect(html).not.toMatch(/Links R[aá]pidos|Carrinho|Buscar|Categorias|GB Loca|34\.780\.330/i)
  })

  it('onda 134: o rodapé liga os documentos que a locadora publicou e Cookies', async () => {
    api.getPublicSettings.mockResolvedValue({
      companyPhone: '(51) 3333-0000',
      legalDocuments: { terms: true, privacy: true, returnPolicy: false },
    })
    const html = renderToStaticMarkup(await Page(params()))
    const rodape = html.slice(html.lastIndexOf('<footer'))
    expect([...rodape.matchAll(/href="([^"]*)"/g)].map((match) => match[1])).toEqual([
      '/privacidade',
      '/termos',
      '/cookies',
    ])
  })

  it('modo legacy: sem entrada da área do cliente no host', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'legacy')
    const html = renderToStaticMarkup(await Page(params()))
    expect(html).not.toContain('/area-cliente')
    expect(html).toContain('Site temporariamente indisponível')
  })

  it.each([
    ['LIVE', { ...CARD, mode: 'LIVE', indexable: true }],
    ['OFF (sem cartão)', null],
  ])('%s: o 404 neutro', async (_caso, site) => {
    api.getPublicSite.mockResolvedValue(site)
    await expect(Page(params())).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(api.getPublicSettings).not.toHaveBeenCalled()
  })

  it('slug inválido: 404 sem consultar', async () => {
    await expect(Page(params('admin'))).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(api.getPublicSite).not.toHaveBeenCalled()
  })

  it('metadata: noindex sempre, título com o nome em pausa', async () => {
    expect(await generateMetadata(params())).toEqual({
      title: 'Locadora A | Temporariamente indisponível',
      robots: { index: false, follow: false },
    })
    api.getPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    expect(await generateMetadata(params())).toEqual({
      title: undefined,
      robots: { index: false, follow: false },
    })
  })
})
