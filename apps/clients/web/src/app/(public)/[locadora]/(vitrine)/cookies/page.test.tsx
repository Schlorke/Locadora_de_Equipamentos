// Política de Cookies no host de locadora (onda 134, S13): texto da plataforma; em pausa, com a moldura neutra da
// locadora (a página continua no ar).
import { afterEach, describe, expect, it, vi } from 'vitest'

const pausa = vi.hoisted(() => ({ molduraDaPausa: vi.fn() }))
vi.mock('../pausa', () => pausa)

import Page from './page'

const params = (locadora = 'locadora-a') => ({
  params: Promise.resolve({ locadora }),
})

afterEach(() => vi.resetAllMocks())

describe('/cookies no host de locadora', () => {
  it('no ar: sem moldura; em pausa: a moldura da locadora', async () => {
    pausa.molduraDaPausa.mockResolvedValue(null)
    expect(
      ((await Page(params())) as { props: Record<string, unknown> }).props
    ).toEqual({ moldura: null })
    const moldura = { nome: 'Locadora A', documentos: null }
    pausa.molduraDaPausa.mockResolvedValue(moldura)
    expect(
      ((await Page(params())) as { props: Record<string, unknown> }).props
    ).toEqual({ moldura })
    expect(pausa.molduraDaPausa).toHaveBeenCalledWith('locadora-a')
  })

  it('slug inválido: 404 sem consultar', async () => {
    await expect(Page(params('admin'))).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
    expect(pausa.molduraDaPausa).not.toHaveBeenCalled()
  })
})
