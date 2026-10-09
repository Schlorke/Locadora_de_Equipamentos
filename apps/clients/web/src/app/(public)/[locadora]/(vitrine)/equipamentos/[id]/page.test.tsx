// S13: o detalhe do equipamento não reabre a indexação de um site que ainda não pode ser indexado (noindex até a 1ª
// fatura paga); com o site indexável, conserva a política anterior.
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getPublicEquipment: vi.fn(),
  getPublicSettings: vi.fn(),
  getPublicSite: vi.fn(),
}))
vi.mock('../../../../../../host/server/public-api', () => api)
const loja = vi.hoisted(() => ({ getLojaDaVitrine: vi.fn() }))
vi.mock('../../loja', () => loja)
vi.mock('@gb-locacoes/frontend/pages/equipamento-detalhe', () => ({
  EquipamentoDetalhePage: () => null,
  StructuredData: () => null,
  buildEquipmentBreadcrumbs: () => [],
  buildEquipmentProductStructuredData: () => ({}),
  getLocalBusinessData: () => ({}),
  buildEquipmentSeo: (_equipment: unknown, _id: string, store: { name?: string } | null) => ({
    title: store?.name ? `Betoneira | ${store.name}` : 'Betoneira',
    description: 'Betoneira para locação',
    keywords: [],
    canonicalUrl: '/equipamentos/eq-1',
    openGraphTitle: 'Betoneira',
    openGraphDescription: 'Betoneira para locação',
    imageUrl: 'https://cdn.example/eq.jpg',
    imageAlt: 'Betoneira',
  }),
}))

import { generateMetadata } from './page'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const props = { params: Promise.resolve({ locadora: 'locadora-a', id: 'eq-1' }) }

afterEach(() => vi.resetAllMocks())

describe('metadata do detalhe do equipamento', () => {
  // Achado 143 (T12): autoria, nome do site e título são os da própria locadora; nenhum nome ou perfil fixo da GB.
  it('autoria e nome do site da própria locadora', async () => {
    api.getPublicEquipment.mockResolvedValue({ id: 'eq-1' })
    api.getPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    loja.getLojaDaVitrine.mockResolvedValue({ name: 'Locadora A', city: null, state: null, logoUrl: null, origin: null })
    const metadata = await generateMetadata(props)
    expect(metadata).toMatchObject({
      title: 'Betoneira | Locadora A',
      authors: [{ name: 'Locadora A' }],
      creator: 'Locadora A',
      publisher: 'Locadora A',
      openGraph: { siteName: 'Locadora A' },
    })
    expect(JSON.stringify(metadata)).not.toMatch(/GB Loca|locacoesgb/i)
  })

  it('equipamento inexistente: título com o nome da locadora, sem marca fixa', async () => {
    api.getPublicEquipment.mockResolvedValue(null)
    api.getPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    loja.getLojaDaVitrine.mockResolvedValue({ name: 'Locadora A', city: null, state: null, logoUrl: null, origin: null })
    expect((await generateMetadata(props)).title).toBe('Equipamento não encontrado | Locadora A')
    loja.getLojaDaVitrine.mockResolvedValue(null)
    expect((await generateMetadata(props)).title).toBe('Equipamento não encontrado')
  })

  it('site indexável: robots index/follow como antes', async () => {
    api.getPublicEquipment.mockResolvedValue({ id: 'eq-1' })
    api.getPublicSite.mockResolvedValue({ ...CARD, mode: 'LIVE', indexable: true })
    const metadata = await generateMetadata(props)
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
  })

  it.each([
    ['LIVE ainda não indexável', { ...CARD, mode: 'LIVE', indexable: false }],
    ['PAUSED', { ...CARD, mode: 'PAUSED', indexable: false }],
    ['sem cartão', null],
  ])('%s: noindex', async (_caso, site) => {
    api.getPublicEquipment.mockResolvedValue({ id: 'eq-1' })
    api.getPublicSite.mockResolvedValue(site)
    expect((await generateMetadata(props)).robots).toEqual({ index: false, follow: false })
  })
})
