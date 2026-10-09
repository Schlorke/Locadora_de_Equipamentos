// S13: o host web só lê o modo do site que o backend decidiu (cabeçalhos do cartão público), sem regra própria.
import { describe, expect, it, vi } from 'vitest'
import { createSiteStateReader, readSiteState, readTenantSiteState, SITE_PAUSED_PAGE } from './site-state'

const card = (status: number, headers: Record<string, string> = {}) =>
  new Response('{}', { status, headers: { 'content-type': 'application/json', ...headers } })

describe('readSiteState', () => {
  it.each([
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'true' }, { mode: 'LIVE', indexable: true }],
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'false' }, { mode: 'LIVE', indexable: false }],
    [{ 'x-site-mode': 'LIVE' }, { mode: 'LIVE', indexable: false }],
    [{ 'x-site-mode': 'PAUSED', 'x-site-indexable': 'true' }, { mode: 'PAUSED', indexable: false }],
    [{}, { mode: 'LIVE', indexable: true }],
  ] as const)('%j → %j', (headers, state) => {
    expect(readSiteState(card(200, headers))).toEqual(state)
  })

  it.each(['OFF', 'paused', ''])('modo fora do contrato (%j) lança', (mode) => {
    expect(() => readSiteState(card(200, { 'x-site-mode': mode }))).toThrow('fora do contrato')
  })
})

describe('readTenantSiteState (cartão no escopo da área do cliente)', () => {
  it.each([
    [{ 'x-site-mode': 'OFF', 'x-site-indexable': 'false' }, { mode: 'OFF', indexable: false }],
    [{ 'x-site-mode': 'OFF', 'x-site-indexable': 'true' }, { mode: 'OFF', indexable: false }],
    [{ 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' }, { mode: 'PAUSED', indexable: false }],
    [{ 'x-site-mode': 'LIVE', 'x-site-indexable': 'true' }, { mode: 'LIVE', indexable: true }],
    [{}, { mode: 'LIVE', indexable: true }],
  ] as const)('%j → %j', (headers, state) => {
    expect(readTenantSiteState(card(200, headers))).toEqual(state)
  })

  it.each(['paused', 'off', ''])('modo fora do contrato (%j) lança', (mode) => {
    expect(() => readTenantSiteState(card(200, { 'x-site-mode': mode }))).toThrow('fora do contrato')
  })
})

describe('createSiteStateReader', () => {
  it('lê o cartão público na origem privada do backend, sem cache e com prazo', async () => {
    const fetcher = vi.fn(async () => card(200, { 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' }))
    await expect(createSiteStateReader(fetcher)('https://backend.example', 'locadora-a')).resolves.toEqual({
      status: 'site',
      state: { mode: 'PAUSED', indexable: false },
    })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      'https://backend.example/api/public/tenants/locadora-a',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) })
    )
  })

  it('404 do D10 (site desligado ou locadora desconhecida): sem vitrine', async () => {
    await expect(createSiteStateReader(async () => card(404))('https://backend.example', 'locadora-a')).resolves.toEqual({
      status: 'not-found',
    })
  })

  it.each([
    ['falha do backend', async () => card(500)],
    ['outro status', async () => card(409)],
    ['cabeçalho fora do contrato', async () => card(200, { 'x-site-mode': 'OFF' })],
    ['rede indisponível', async () => Promise.reject(new Error('ECONNREFUSED'))],
  ])('%s: leitura indisponível (o layout decide)', async (_caso, fetcher) => {
    await expect(createSiteStateReader(fetcher)('https://backend.example', 'locadora-a')).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('backend lento: leitura indisponível depois do prazo', async () => {
    const fetcher = vi.fn(
      (_input: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('timeout')))
        )
    )
    await expect(createSiteStateReader(fetcher, 5)('https://backend.example', 'locadora-a')).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('a página de pausa tem caminho fixo', () => {
    expect(SITE_PAUSED_PAGE).toBe('/site-pausado')
  })
})
