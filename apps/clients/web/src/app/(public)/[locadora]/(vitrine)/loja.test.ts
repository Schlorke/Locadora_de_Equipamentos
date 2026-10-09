// Identidade da vitrine para SEO e JSON-LD (achado 143): o cartão da própria locadora e a origem canônica do host dela.
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getPublicSite: vi.fn() }))
vi.mock('../../../../host/server/public-api', () => api)

import { getLojaDaVitrine } from './loja'

const CARD = {
  slug: 'locadora-a',
  name: 'Locadora A',
  city: 'Canoas',
  state: 'RS',
  logoUrl: null,
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('getLojaDaVitrine', () => {
  it('cartão da locadora e a origem canônica do host dela', async () => {
    vi.stubEnv('PLATFORM_ENV', 'production')
    vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'plataforma.example.test')
    vi.stubEnv('WEB_API_ORIGIN', 'https://app.plataforma.example.test')
    vi.stubEnv('PLATFORM_EDGE_SECRET', 'a'.repeat(64))
    api.getPublicSite.mockResolvedValue({
      ...CARD,
      mode: 'LIVE',
      indexable: true,
    })
    expect(await getLojaDaVitrine('locadora-a')).toEqual({
      name: 'Locadora A',
      city: 'Canoas',
      state: 'RS',
      logoUrl: null,
      origin: 'https://locadora-a.plataforma.example.test',
    })
  })

  it('ambiente sem raiz válida: origem null (URLs relativas), nunca um domínio fixo', async () => {
    vi.stubEnv('PLATFORM_ENV', 'nao-existe')
    api.getPublicSite.mockResolvedValue({
      ...CARD,
      mode: 'LIVE',
      indexable: true,
    })
    expect((await getLojaDaVitrine('locadora-a'))?.origin).toBeNull()
  })

  it('sem vitrine (OFF ou desconhecida): null', async () => {
    api.getPublicSite.mockResolvedValue(null)
    expect(await getLojaDaVitrine('locadora-a')).toBeNull()
  })
})
