// Política de Privacidade no host de locadora (onda 134): o documento publicado pela própria locadora, lido no servidor. Só o 404
// do backend (documento não publicado) vira notFound(); qualquer outra falha lança (nunca um 404 falso). Em pausa
// (S13), a página recebe a moldura neutra da locadora.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getPublicLegalDocument: vi.fn() }))
vi.mock('../../../../../host/server/public-api', () => api)
const pausa = vi.hoisted(() => ({ molduraDaPausa: vi.fn() }))
vi.mock('../pausa', () => pausa)

import Page from './page'

const params = (locadora = 'locadora-a') => ({
  params: Promise.resolve({ locadora }),
})
const DOCUMENTO = {
  document: {
    version: 1,
    lastUpdated: '2 de março de 2026',
    sections: [
      { id: 'a', title: 'A', blocks: [{ type: 'paragraph', text: 'Texto.' }] },
    ],
  },
  publishedAt: '2026-03-02T12:00:00.000Z',
}

beforeEach(() => {
  api.getPublicLegalDocument.mockResolvedValue(DOCUMENTO)
  pausa.molduraDaPausa.mockResolvedValue(null)
})
afterEach(() => vi.resetAllMocks())

describe('/privacidade no host de locadora', () => {
  it('documento publicado: a página recebe o documento da locadora do segmento', async () => {
    const element = (await Page(params())) as { props: Record<string, unknown> }
    expect(api.getPublicLegalDocument).toHaveBeenCalledExactlyOnceWith(
      'locadora-a',
      'privacy'
    )
    expect(element.props).toEqual({ documento: DOCUMENTO, moldura: null })
  })

  it('em pausa: a moldura neutra da locadora vai para a página', async () => {
    const moldura = {
      nome: 'Locadora A',
      documentos: { terms: true, privacy: false, returnPolicy: false },
    }
    pausa.molduraDaPausa.mockResolvedValue(moldura)
    const element = (await Page(params())) as { props: Record<string, unknown> }
    expect(element.props.moldura).toEqual(moldura)
  })

  it('documento não publicado (404 do backend): notFound()', async () => {
    api.getPublicLegalDocument.mockResolvedValue(null)
    await expect(Page(params())).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
  })

  it('falha do backend lança o erro (não vira 404)', async () => {
    const falha = new Error('Documento legal respondeu 503.')
    api.getPublicLegalDocument.mockRejectedValue(falha)
    await expect(Page(params())).rejects.toBe(falha)
  })

  it('slug inválido: 404 sem consultar', async () => {
    await expect(Page(params('admin'))).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
    expect(api.getPublicLegalDocument).not.toHaveBeenCalled()
  })
})
