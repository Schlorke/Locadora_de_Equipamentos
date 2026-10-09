// S13: o vínculo faz parte da área do cliente (B.5, linha "Área do cliente final"). O nome da locadora vem do cartão no
// escopo da área do cliente, que continua com o site em pausa ou desligado por falta de publicação.
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getTenantSite: vi.fn() }))
vi.mock('../../../../../host/server/public-api', () => api)
vi.mock('@gb-locacoes/frontend/pages/vincular-locadora', () => ({
  VincularLocadoraPage: ({ tenantName }: { tenantName: string }) => tenantName,
}))

import Page from './page'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const params = (locadora = 'locadora-a') => ({ params: Promise.resolve({ locadora }) })

afterEach(() => vi.resetAllMocks())

describe('/vincular', () => {
  it.each(['LIVE', 'PAUSED', 'OFF'] as const)('site %s: mostra o vínculo com o nome da locadora', async (mode) => {
    api.getTenantSite.mockResolvedValue({ ...CARD, mode, indexable: false })
    const element = await Page(params())
    expect(element.props).toEqual({ tenantName: 'Locadora A' })
    expect(api.getTenantSite).toHaveBeenCalledExactlyOnceWith('locadora-a')
  })

  it('sem área do cliente (sem cartão): o 404 neutro', async () => {
    api.getTenantSite.mockResolvedValue(null)
    await expect(Page(params())).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
  })

  it('slug inválido: o 404 neutro sem consultar', async () => {
    await expect(Page(params('admin'))).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(api.getTenantSite).not.toHaveBeenCalled()
  })
})
