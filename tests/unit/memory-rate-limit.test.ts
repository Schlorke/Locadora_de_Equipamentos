import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
// Contraparte da API compartilhada (onda 135, B5): o mesmo par de limitadores na composição do serviço.
import * as serviceLimiters from '../../apps/services/api/src/host/rate-limit'
import { createMemoryRateLimiters } from '@gb-locacoes/backend/http'
import {
  MemoryRateLimitStore,
  MAX_RATE_LIMIT_ENTRIES,
} from '../../packages/backend/src/http/memory-rate-limit'
import { clientIpFromHeaders } from '@gb-locacoes/backend/identity'
const request = (ip?: string) =>
  new NextRequest('https://fixture.test/api/anything', {
    headers: ip ? { 'x-forwarded-for': ip } : {},
  })
describe.each(
  ['first composition', 'second composition'].map(
    (name) =>
      [
        name,
        {
          ...createMemoryRateLimiters<NextRequest>({
            clientIp: clientIpFromHeaders,
          }),
          MemoryRateLimitStore,
          MAX_RATE_LIMIT_ENTRIES,
        },
      ] as const
  )
)('%s generic memory rate limit characterization', (_name, legacy) => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_001)
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TRUSTED_PROXY_HOPS', '')
    vi.stubEnv('VERCEL', '')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })
  it.each([
    ['authRateLimit', 5, 900_000],
    ['apiRateLimit', 100, 60_000],
    ['adminApiRateLimit', 200, 60_000],
    ['strictRateLimit', 10, 60_000],
  ] as const)(
    '%s keeps its window, exact 429 and strict expiry',
    async (name, max, windowMs) => {
      const original = request(`192.0.2.${max}`)
      const limiter = legacy[name]
      for (let i = 0; i < max; i++) {
        const result = legacy.checkRateLimit(original, limiter)
        expect(result).toEqual({
          allowed: true,
          headers: {
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': String(max - i - 1),
            'X-RateLimit-Reset': String(Math.ceil((100_001 + windowMs) / 1000)),
          },
        })
      }
      const blocked = legacy.checkRateLimit(original, limiter)
      expect(blocked.allowed).toBe(false)
      expect(blocked.response?.status).toBe(429)
      expect(await blocked.response!.json()).toEqual({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: windowMs / 1000,
      })
      expect(Object.fromEntries(blocked.response!.headers)).toEqual({
        'content-type': 'application/json',
        'retry-after': String(windowMs / 1000),
        'x-ratelimit-limit': String(max),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.ceil((100_001 + windowMs) / 1000)),
      })
      vi.setSystemTime(100_001 + windowMs)
      expect(limiter(original).allowed).toBe(false)
      vi.advanceTimersByTime(1)
      expect(limiter(original)).toEqual({
        allowed: true,
        remaining: max - 1,
        resetTime: 100_002 + 2 * windowMs,
      })
    }
  )
  it('keeps custom keys, per-factory stores and the historical fallback header of 10', async () => {
    const keyGenerator = vi.fn(() => '__proto__')
    const first = legacy.rateLimit({
      windowMs: 1000,
      maxRequests: 1,
      keyGenerator,
    })
    const second = legacy.rateLimit({
      windowMs: 1000,
      maxRequests: 1,
      keyGenerator,
    })
    const original = request()
    expect(first(original).allowed).toBe(true)
    const blocked = legacy.checkRateLimit(original, first)
    expect(blocked.response?.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(second(original).allowed).toBe(true)
    expect(keyGenerator).toHaveBeenCalledWith(original)
    expect(
      legacy.consumeRateLimit('__proto__', { windowMs: 1000, maxRequests: 1 })
        .allowed
    ).toBe(true)
  })
  it('uses one anonymous key for missing/untrusted client addresses', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const limiter = legacy.rateLimit({ windowMs: 1000, maxRequests: 1 })
    expect(limiter(request('192.0.2.99')).allowed).toBe(true)
    expect(limiter(request('192.0.2.100')).allowed).toBe(false)
    expect(limiter(request()).allowed).toBe(false)
  })
  it('preserves bounded oldest eviction, prefix deletion and strict sweep boundary', () => {
    const store = new legacy.MemoryRateLimitStore(2)
    const window = { windowMs: 100, maxRequests: 1 }
    store.consume('a', window, 0)
    store.consume('b', window, 1)
    store.consume('c', window, 2)
    expect(store.keys()).toEqual(['b', 'c'])
    expect(store.size).toBe(2)
    store.sweep(101)
    expect(store.keys()).toEqual(['b', 'c'])
    store.sweep(102)
    expect(store.keys()).toEqual(['c'])
    store.deleteByPrefix('c')
    expect(store.size).toBe(0)
    expect(legacy.MAX_RATE_LIMIT_ENTRIES).toBe(50_000)
  })
  it('keeps counters independent across compositions and forwards Fetch headers to the IP port', () => {
    const clientIp = vi.fn(() => 'fixture-ip')
    const first = createMemoryRateLimiters<Request>({ clientIp })
    const second = createMemoryRateLimiters<Request>({ clientIp })
    const original = new Request('https://fixture.test/api')
    for (let i = 0; i < 10; i++)
      expect(first.strictRateLimit(original).allowed).toBe(true)
    expect(first.strictRateLimit(original).allowed).toBe(false)
    expect(second.strictRateLimit(original).allowed).toBe(true)
    expect(first.adminApiRateLimit(original).allowed).toBe(true)
    expect(
      first.consumeRateLimit('fixture-ip', { windowMs: 1000, maxRequests: 1 })
        .allowed
    ).toBe(true)
    expect(
      second.consumeRateLimit('fixture-ip', { windowMs: 1000, maxRequests: 1 })
        .allowed
    ).toBe(true)
    expect(clientIp).toHaveBeenCalledWith(original.headers)
  })
})

// The legacy facade and the service composition retain only names actually used by active routes.
describe.each([['service', serviceLimiters]] as const)(
  '%s memory limiter facade',
  (_host, { adminApiRateLimit, strictRateLimit, checkRateLimit }) => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })
    it.each([
      [adminApiRateLimit, 200],
      [strictRateLimit, 10],
    ] as const)(
      'keeps the route consumer window of %s/%i',
      async (limiter, max) => {
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('TRUSTED_PROXY_HOPS', '')
        vi.stubEnv('VERCEL', '')
        const original = request(`198.51.100.${max}`)
        for (let i = 0; i < max; i++)
          expect(checkRateLimit(original, limiter).allowed).toBe(true)
        const blocked = checkRateLimit(original, limiter)
        expect(blocked.response?.status).toBe(429)
        expect(blocked.response?.headers.get('X-RateLimit-Limit')).toBe(
          String(max)
        )
        expect(blocked.response?.headers.get('X-RateLimit-Remaining')).toBe('0')
        expect((await blocked.response!.json()).error).toBe(
          'Rate limit exceeded'
        )
      }
    )
  }
)
