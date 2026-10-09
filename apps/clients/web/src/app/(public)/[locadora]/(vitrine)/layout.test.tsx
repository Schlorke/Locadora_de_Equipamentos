// S13: a vitrine (B.5, linha "Site público") só existe no ar ou em pausa. Com o site desligado, a locadora pode ainda
// ter a área do cliente (o layout pai a atende), mas a vitrine é o 404 neutro do D10.
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getPublicSite: vi.fn() }))
vi.mock('../../../../host/server/public-api', () => api)

import StorefrontLayout from './layout'

const CARD = { slug: 'locadora-a', name: 'Locadora A', city: null, state: null, logoUrl: null }
const params = { params: Promise.resolve({ locadora: 'locadora-a' }) }

afterEach(() => vi.resetAllMocks())

describe('layout (vitrine)', () => {
  it.each(['LIVE', 'PAUSED'] as const)('site %s: renderiza a página da vitrine', async (mode) => {
    api.getPublicSite.mockResolvedValue({ ...CARD, mode, indexable: false })
    const element = await StorefrontLayout({ children: 'catalogo', ...params })
    expect(element.props.children).toBe('catalogo')
    expect(api.getPublicSite).toHaveBeenCalledExactlyOnceWith('locadora-a')
  })

  it('site desligado (sem vitrine): o 404 neutro', async () => {
    api.getPublicSite.mockResolvedValue(null)
    await expect(StorefrontLayout({ children: 'catalogo', ...params })).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    })
  })
})
