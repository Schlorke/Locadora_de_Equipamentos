// Home da vitrine no host de locadora (onda 134): o SSR leva ao hero os anos de mercado, a frota, o telefone e o WhatsApp
// da própria locadora (nunca o texto "Sobre nós") e ao JSON-LD o local, o horário e as categorias reais dela.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getPublicSettings: vi.fn(),
  getPublicCategoryNames: vi.fn(),
}))
vi.mock('../../../../host/server/public-api', () => api)
const loja = vi.hoisted(() => ({ getLojaDaVitrine: vi.fn() }))
vi.mock('./loja', () => loja)

import Page, { generateMetadata } from './page'

const params = { params: Promise.resolve({ locadora: 'locadora-a' }) }
/** Props que a página entrega ao HomePage do frontend. */
const propsDaHome = async () =>
  ((await Page(params)) as { props: Record<string, unknown> }).props

beforeEach(() => {
  loja.getLojaDaVitrine.mockResolvedValue({
    name: 'Locadora A',
    city: 'Curitiba',
    state: 'PR',
    logoUrl: null,
    origin: 'https://locadora-a.example.test',
  })
  api.getPublicCategoryNames.mockResolvedValue(['Andaimes', 'Betoneiras'])
})

describe('home da vitrine (host de locadora)', () => {
  it('hero com os anos, a frota e os dois números da locadora; JSON-LD com local, horário e categorias reais', async () => {
    api.getPublicSettings.mockResolvedValue({
      aboutUsText: 'Texto Sobre nós',
      companyPhone: '(41) 3333-4444',
      whatsappNumber: '(41) 99999-4444',
      heroCarousel: [],
      waveAnimation: 'none',
      businessHours: {
        monday: { closed: false, open: '08:00', close: '18:00' },
      },
      siteContent: {
        experienceYears: 10,
        fleetSize: 200,
        clientsServed: 500,
        storeLocation: {
          latitude: -25.4,
          longitude: -49.3,
          addressLine1: 'Rua A, 10',
        },
      },
    })
    const props = await propsDaHome()
    expect(api.getPublicCategoryNames).toHaveBeenCalledWith('locadora-a')
    expect(props.heroInitialSettings).toEqual({
      heroCarousel: [],
      waveAnimation: 'none',
      siteContent: { experienceYears: 10, fleetSize: 200 },
      companyPhone: '(41) 3333-4444',
      whatsappNumber: '(41) 99999-4444',
    })
    expect(JSON.stringify(props.heroInitialSettings)).not.toContain('Sobre nós')
    expect(props.localBusiness).toMatchObject({
      name: 'Locadora A',
      geo: { latitude: -25.4, longitude: -49.3 },
      openingHours: ['Mo 08:00-18:00'],
      offerCatalog: ['Andaimes', 'Betoneiras'],
    })
  })

  it('locadora sem WhatsApp: o hero recebe só o telefone (o WhatsApp vazio, sem número de outra locadora)', async () => {
    api.getPublicSettings.mockResolvedValue({
      companyPhone: '(41) 3333-4444',
      heroCarousel: [],
      waveAnimation: 'animated',
    })
    const props = await propsDaHome()
    expect(props.heroInitialSettings).toMatchObject({
      companyPhone: '(41) 3333-4444',
      whatsappNumber: '',
    })
  })

  it('sem configurações: hero neutro e JSON-LD só com o cartão e as categorias', async () => {
    api.getPublicSettings.mockResolvedValue(null)
    api.getPublicCategoryNames.mockResolvedValue([])
    const props = await propsDaHome()
    expect(props.heroInitialSettings).toEqual({
      heroCarousel: [],
      waveAnimation: 'animated',
      siteContent: {},
      companyPhone: '',
      whatsappNumber: '',
    })
    expect(props.localBusiness).toEqual({
      name: 'Locadora A',
      url: 'https://locadora-a.example.test',
    })
  })
})

// Onda 135 (A4): a home leva o SEO da própria locadora (título e descrição do painel, canonical na origem dela).
describe('metadados da home da vitrine (onda 135, A4)', () => {
  it('título e descrição SEO do painel e canonical na origem da locadora', async () => {
    api.getPublicSettings.mockResolvedValue({
      seoTitle: 'Locadora A | Andaimes',
      seoDescription: 'Andaimes em Curitiba.',
    })
    const metadata = await generateMetadata(params)
    expect(metadata.title).toEqual({ absolute: 'Locadora A | Andaimes' })
    expect(metadata.description).toBe('Andaimes em Curitiba.')
    expect(metadata.alternates).toEqual({
      canonical: 'https://locadora-a.example.test',
    })
  })
})
