// Moldura das páginas legais em pausa (onda 134, S13): o cartão da própria locadora e quais documentos ela publicou;
// com o site no ar, nenhuma (a página fica na moldura da vitrine).
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getPublicSite: vi.fn(),
  getPublicSettings: vi.fn(),
}))
vi.mock('../../../../host/server/public-api', () => api)

import { documentosPublicados, molduraDaPausa } from './pausa'

const CARD = {
  slug: 'locadora-a',
  name: 'Locadora A',
  city: 'Canoas',
  state: 'RS',
  logoUrl: null,
}

afterEach(() => vi.resetAllMocks())

describe('molduraDaPausa', () => {
  it('em pausa: o cartão da locadora e os documentos publicados', async () => {
    api.getPublicSite.mockResolvedValue({
      ...CARD,
      mode: 'PAUSED',
      indexable: false,
    })
    api.getPublicSettings.mockResolvedValue({
      legalDocuments: { terms: true, privacy: false, returnPolicy: true },
    })
    expect(await molduraDaPausa('locadora-a')).toEqual({
      nome: 'Locadora A',
      cidade: 'Canoas',
      uf: 'RS',
      logoUrl: null,
      documentos: { terms: true, privacy: false, returnPolicy: true },
    })
  })

  it('no ar (ou sem vitrine): nenhuma moldura, sem ler as configurações', async () => {
    api.getPublicSite.mockResolvedValue({
      ...CARD,
      mode: 'LIVE',
      indexable: true,
    })
    expect(await molduraDaPausa('locadora-a')).toBeNull()
    api.getPublicSite.mockResolvedValue(null)
    expect(await molduraDaPausa('locadora-a')).toBeNull()
    expect(api.getPublicSettings).not.toHaveBeenCalled()
  })
})

describe('documentosPublicados', () => {
  it('só booleanos verdadeiros contam; leitura fora do contrato vira nenhum documento', () => {
    expect(
      documentosPublicados({
        legalDocuments: { terms: true, privacy: 'sim', returnPolicy: 1 },
      })
    ).toEqual({ terms: true, privacy: false, returnPolicy: false })
    expect(documentosPublicados({ legalDocuments: null })).toBeNull()
    expect(documentosPublicados(null)).toBeNull()
  })
})
