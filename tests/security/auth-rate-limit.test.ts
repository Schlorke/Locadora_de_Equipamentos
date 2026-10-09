import {
  platformRateLimitDigest,
  type RateLimitCounter,
} from '../../packages/backend/src/modules/directory/rate-limit'
/**
 * Identity limiters (lib/rate-limit.ts). Policy tests run against an
 * in-memory stand-in of `platform_rate_limits` through the real Prisma
 * adapter; with a disposable TEST_DATABASE_URL, the last block proves the
 * windows persist across instances (two Prisma clients, two pools), that
 * concurrent attempts are counted atomically, and that keys only hold HMACs
 * keyed by PLATFORM_RATE_LIMIT_SECRET (ADR adr-tenant-hosts, Lote 7a).
 */
import { randomBytes, randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// The application client (lib/prisma) as seen by the limiters' default store.
vi.mock('@/lib/prisma', async () => {
  const { createPlatformRateLimitTable } =
    await import('../helpers/platform-rate-limit-table')
  const table = createPlatformRateLimitTable()
  return { prisma: table.database, applicationTable: table }
})

import type { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prismaRateLimitCounter } from '@gb-locacoes/backend/directory'
import {
  adminApiRateLimit,
  clearAuthAccountAttempts,
  clientIpFromHeaders,
  consumeAccountNotice,
  consumeAuthAttempt,
  consumeVerificationResend,
  identityRateLimitSecret,
  legacySignInGuard,
  resetAuthAccountAttempts,
  strictRateLimit,
} from '@/lib/rate-limit'
import { createMemoryRateLimiters } from '@gb-locacoes/backend/http'
import {
  MAX_RATE_LIMIT_ENTRIES,
  MemoryRateLimitStore,
} from '../../packages/backend/src/http/memory-rate-limit'
const { apiRateLimit, rateLimit } = createMemoryRateLimiters<NextRequest>({
  clientIp: clientIpFromHeaders,
})
import { isPlatformProduction } from '../../packages/backend/src/modules/directory/security-env'
import * as applicationPrisma from '@/lib/prisma'
import { createPlatformRateLimitTable } from '../helpers/platform-rate-limit-table'
import { requireTestDatabase } from '../helpers/test-database'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const MINUTE = 60 * 1000
const production = { NODE_ENV: 'production' }

describe('client IP for rate limiting', () => {
  it('trusts no header in production without a configured source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const forged = {
      'x-forwarded-for': '203.0.113.7',
      'x-real-ip': '203.0.113.8',
      'x-client-ip': '203.0.113.9',
      'true-client-ip': '203.0.113.10',
    }
    expect(clientIpFromHeaders(forged, production)).toBeNull()
    expect(clientIpFromHeaders(new Headers(forged), production)).toBeNull()
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('on Vercel uses x-real-ip and ignores a client-sent X-Forwarded-For', () => {
    const env = { ...production, VERCEL: '1' }
    const headers = new Headers({
      'x-forwarded-for': '10.0.0.1, 198.51.100.4',
      'x-real-ip': '198.51.100.20',
    })
    expect(clientIpFromHeaders(headers, env)).toBe('198.51.100.20')
    expect(
      clientIpFromHeaders({ 'x-forwarded-for': '198.51.100.4' }, env)
    ).toBeNull()
  })

  it('behind N trusted proxies reads the Nth X-Forwarded-For entry from the right', () => {
    const chain = { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 198.51.100.30' }
    expect(
      clientIpFromHeaders(chain, { ...production, TRUSTED_PROXY_HOPS: '1' })
    ).toBe('198.51.100.30')
    expect(
      clientIpFromHeaders(chain, { ...production, TRUSTED_PROXY_HOPS: '2' })
    ).toBe('2.2.2.2')
    // Forged entries on the left never move the trusted one.
    const forged = { 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 198.51.100.30' }
    expect(
      clientIpFromHeaders(forged, { ...production, TRUSTED_PROXY_HOPS: '1' })
    ).toBe('198.51.100.30')
    // Fewer entries than proxies: the request skipped the proxy chain.
    expect(
      clientIpFromHeaders(
        { 'x-forwarded-for': '198.51.100.30' },
        { ...production, TRUSTED_PROXY_HOPS: '2' }
      )
    ).toBeNull()
    // Repeated header lines form one chain.
    expect(
      clientIpFromHeaders(
        { 'x-forwarded-for': ['7.7.7.7', '198.51.100.31'] },
        { ...production, TRUSTED_PROXY_HOPS: '1' }
      )
    ).toBe('198.51.100.31')
  })

  it('outside production keeps the leftmost forwarded address for local runs', () => {
    expect(
      clientIpFromHeaders(
        { 'x-forwarded-for': '192.0.2.5, 10.0.0.1' },
        { NODE_ENV: 'test' }
      )
    ).toBe('192.0.2.5')
    expect(
      clientIpFromHeaders({ 'x-real-ip': '192.0.2.6' }, { NODE_ENV: 'test' })
    ).toBe('192.0.2.6')
  })

  it('accepts only IP addresses and groups IPv6 clients by /64', () => {
    const env = { ...production, VERCEL: '1' }
    const ip = (value: string) =>
      clientIpFromHeaders({ 'x-real-ip': value }, env)
    expect(ip('unknown')).toBeNull()
    expect(ip('999.1.1.1')).toBeNull()
    expect(ip('evil.example')).toBeNull()
    expect(ip('198.51.100.9:4711')).toBe('198.51.100.9')
    expect(ip('::ffff:198.51.100.9')).toBe('198.51.100.9')
    expect(ip('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(ip('2001:DB8:1:2:bbbb:cccc:dddd:2')).toBe('2001:db8:1:2::/64')
    expect(ip('[2001:db8:1:2::3]:443')).toBe('2001:db8:1:2::/64')
    expect(ip('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ip('2001:db8:1:3::1')).not.toBe(ip('2001:db8:1:2::1'))
  })
})

describe('client IP from a validated platform edge', () => {
  const EDGE_SECRET = 'edge-secret-auth-rate-limit-0123456789'
  const platform = {
    NODE_ENV: 'production',
    PLATFORM_ENV: 'staging',
    PLATFORM_ROOT_DOMAIN: 'plataforma.test',
    PLATFORM_EDGE_SECRET: EDGE_SECRET,
  }
  const edge = (clientIp: string | null, secret = EDGE_SECRET) => ({
    'x-platform-edge-auth': secret,
    'x-platform-host-kind': 'apex',
    'x-platform-origin': 'https://plataforma.test',
    ...(clientIp === null ? {} : { 'x-platform-client-ip': clientIp }),
  })
  // Behind the web proxy, x-real-ip is the proxy's own egress address.
  const proxied = { 'x-real-ip': '198.51.100.250' }

  it('prefers the edge client IP over any forwarded header', () => {
    const env = { ...platform, VERCEL: '1' }
    expect(
      clientIpFromHeaders({ ...proxied, ...edge('203.0.113.7') }, env)
    ).toBe('203.0.113.7')
    expect(
      clientIpFromHeaders(
        new Headers({ ...proxied, ...edge('2001:db8:5:6:aaaa::1') }),
        env
      )
    ).toBe('2001:db8:5:6::/64')
  })

  it('ignores a forged edge and falls back to the trusted sources', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const forged = edge('203.0.113.7', 'wrong-secret-0123456789-0123456789')
    expect(
      clientIpFromHeaders(
        { ...proxied, ...forged },
        { ...platform, VERCEL: '1' }
      )
    ).toBe('198.51.100.250')
    expect(clientIpFromHeaders({ ...proxied, ...forged }, platform)).toBeNull()
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('behind the web proxy never falls back to the headers of the proxy itself', () => {
    // Validated edge without a usable client IP: x-real-ip and X-Forwarded-For
    // describe the proxy (its egress address, the same for every user), so
    // reading them would turn every per-IP window into one global window.
    const forwarded = {
      ...proxied,
      'x-forwarded-for': '203.0.113.99, 198.51.100.250',
    }
    for (const env of [
      { ...platform, VERCEL: '1' },
      { ...platform, TRUSTED_PROXY_HOPS: '1' },
      { ...platform, NODE_ENV: 'test' },
    ]) {
      expect(clientIpFromHeaders({ ...forwarded, ...edge(null) }, env)).toBe(
        null
      )
      // Passes the edge's character check but is not an address.
      expect(
        clientIpFromHeaders(
          new Headers({ ...forwarded, ...edge('1.2.3') }),
          env
        )
      ).toBe(null)
    }
  })

  it('behind the web proxy, one user spending the per-IP budget never refuses the others', async () => {
    const counter = prismaRateLimitCounter(
      createPlatformRateLimitTable().database
    )
    const options = { now: Date.UTC(2030, 0, 1), secret: SECRET, counter }
    const env = { ...platform, VERCEL: '1' }
    // Every request arrives from the proxy (same x-real-ip); this edge
    // carries no client IP.
    const attempt = (account: string) =>
      consumeAuthAttempt(
        'sign-in',
        {
          ip: clientIpFromHeaders({ ...proxied, ...edge(null) }, env),
          account,
        },
        options
      )
    for (let index = 0; index < 25; index++)
      await attempt(`spray-${index}@example.test`)
    // Other users of every tenant can still sign in.
    expect((await attempt('owner@example.test')).allowed).toBe(true)
    expect((await attempt('another-owner@example.test')).allowed).toBe(true)
  })
})

const SECRET = 'fixture-rate-limit-secret-0123456789abcdef'

/** In-memory `platform_rate_limits` through the production Prisma adapter. */
function windows(secret = SECRET) {
  const table = createPlatformRateLimitTable()
  const counter = prismaRateLimitCounter(table.database)
  return {
    table,
    counter,
    at: (now: number) => ({ now, counter, secret }),
  }
}

describe('authentication attempt windows', () => {
  const now = Date.UTC(2030, 0, 1)

  it('by default counts in platform_rate_limits of the application client, keyed by PLATFORM_RATE_LIMIT_SECRET', async () => {
    const configured = 'configured-rate-limit-secret-0123456789abcdef'
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', configured)
    const { applicationTable } = applicationPrisma as unknown as {
      applicationTable: ReturnType<typeof createPlatformRateLimitTable>
    }
    const ip = '192.0.2.60'
    const account = 'default-store@example.test'
    for (let index = 0; index < 5; index++)
      expect(
        (await consumeAuthAttempt('sign-in', { ip, account }, { now })).allowed
      ).toBe(true)
    expect(
      (await consumeAuthAttempt('sign-in', { ip, account }, { now })).allowed
    ).toBe(false)
    const index = Math.floor(now / (15 * MINUTE))
    const ipKey = `auth:sign-in:ip:${platformRateLimitDigest(configured, 'ip', ip)}:${index}`
    expect(applicationTable.rows.get(ipKey)?.count).toBe(6)
    await clearAuthAccountAttempts('sign-in', account, ip, { now })
    expect(
      (await consumeAuthAttempt('sign-in', { ip, account }, { now })).allowed
    ).toBe(true)
    expect(
      await consumeAccountNotice('registration-attempt', account, { now })
    ).toBe(true)
    expect(
      await consumeAccountNotice('registration-attempt', account, { now })
    ).toBe(false)
  })

  it('keys hold a fixed-size HMAC keyed by the secret, never the raw e-mail or IP', async () => {
    const { table, at } = windows()
    const hugeEmail = `${'a'.repeat(1_000_000)}@example.test`
    await consumeAuthAttempt(
      'sign-in',
      { ip: '192.0.2.44', account: hugeEmail },
      at(now)
    )
    await consumeAuthAttempt(
      'sign-in',
      { ip: '192.0.2.44', account: 'Person@Example.test' },
      at(now)
    )
    await consumeAccountNotice('password-reset', 'Person@Example.test', at(now))
    const keys = [...table.rows.keys()]
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key.length).toBeLessThan(128)
      expect(key).not.toMatch(/example|192\.0\.2|person/i)
      expect(key).toMatch(
        /^(?:auth:[a-z-]+:(?:ip|account|account-ip)|notice:[a-z-]+):[0-9a-f]{32}(?::(?:[0-9a-f]{32}|unknown))?:\d+$/
      )
    }
    // Another secret, the same inputs: none of the keys repeat.
    const other = windows('another-rate-limit-secret-0123456789abcdef')
    await consumeAuthAttempt(
      'sign-in',
      { ip: '192.0.2.44', account: 'Person@Example.test' },
      other.at(now)
    )
    expect([...other.table.rows.keys()].some((key) => keys.includes(key))).toBe(
      false
    )
  })

  it('a blocked IP creates no counters for the accounts it keeps trying', async () => {
    const { table, at } = windows()
    const attempt = (index: number) =>
      consumeAuthAttempt(
        'sign-in',
        { ip: '192.0.2.45', account: `spray-${index}@example.test` },
        at(now)
      )
    for (let index = 0; index < 20; index++)
      expect((await attempt(index)).allowed).toBe(true)
    const tracked = table.rows.size
    for (let index = 20; index < 200; index++)
      expect((await attempt(index)).allowed).toBe(false)
    expect(table.rows.size).toBe(tracked)
  })

  it('each generic limiter is its own scope: no shared counters for one client, no eviction across limiters', () => {
    const request = (key: string) =>
      ({ headers: new Headers({ 'x-scope-key': key }) }) as NextRequest
    const byHeader = (req: NextRequest) => req.headers.get('x-scope-key')!
    const window = { windowMs: MINUTE, maxRequests: 2, keyGenerator: byHeader }
    const first = rateLimit(window)
    const second = rateLimit(window)
    // The same client (key) spends one limiter without touching the other.
    expect(first(request('client'), now).allowed).toBe(true)
    expect(first(request('client'), now).allowed).toBe(true)
    expect(first(request('client'), now).allowed).toBe(false)
    expect(second(request('client'), now).allowed).toBe(true)
    // A flood of new keys on one limiter keeps the full window of the other.
    expect(second(request('client'), now).allowed).toBe(true)
    expect(second(request('client'), now).allowed).toBe(false)
    for (let index = 0; index < MAX_RATE_LIMIT_ENTRIES + 10; index++)
      first(request(`flood-${index}`), now)
    expect(second(request('client'), now).allowed).toBe(false)
  })

  it('the shipped generic limiters never count requests of each other', () => {
    const ip = '192.0.2.200'
    const request = () =>
      new NextRequest('http://localhost:3000/api/x', {
        headers: { 'x-forwarded-for': ip },
      })
    for (let index = 0; index < 15; index++)
      expect(adminApiRateLimit(request()).allowed).toBe(true)
    // strictRateLimit allows 10 per minute of its own.
    expect(strictRateLimit(request()).allowed).toBe(true)
    expect(apiRateLimit(request()).remaining).toBe(99)
  })

  it('the in-memory store of the generic limiters bounds its keys, dropping expired windows first', () => {
    const store = new MemoryRateLimitStore(100)
    for (let index = 0; index < 60; index++)
      store.consume(`old-${index}`, { windowMs: MINUTE, maxRequests: 5 }, now)
    for (let index = 0; index < 1000; index++)
      store.consume(
        `new-${index}`,
        { windowMs: MINUTE, maxRequests: 5 },
        now + 2 * MINUTE
      )
    expect(store.size).toBeLessThanOrEqual(100)
    expect(store.keys()).toContain('new-999')
    expect(store.keys().some((key) => key.startsWith('old-'))).toBe(false)
  })

  it('refuses the sixth sign-in from one IP for an account, never other IPs', async () => {
    const { at } = windows()
    const account = 'owner@example.test'
    const from = (ip: string) =>
      consumeAuthAttempt('sign-in', { ip, account }, at(now))
    for (let index = 0; index < 5; index++)
      expect((await from('198.51.100.1')).allowed).toBe(true)
    expect(await from('198.51.100.1')).toMatchObject({
      allowed: false,
      remaining: 0,
      resetTime: now + 15 * MINUTE,
    })
    expect(await from('198.51.100.2')).toMatchObject({
      allowed: true,
      delayMs: 0,
    })
  })

  it('windows are fixed and aligned: the next window starts over at resetTime', async () => {
    const { at } = windows()
    const account = 'aligned@example.test'
    const attempt = (when: number) =>
      consumeAuthAttempt('sign-in', { ip: '198.51.100.9', account }, at(when))
    const end = now + 15 * MINUTE
    for (let index = 0; index < 5; index++)
      expect((await attempt(end - 1)).allowed).toBe(true)
    expect((await attempt(end - 1)).allowed).toBe(false)
    expect(await attempt(end)).toMatchObject({
      allowed: true,
      resetTime: end + 15 * MINUTE,
    })
  })

  it('past ten attempts per account, delays grow to five seconds without refusing', async () => {
    const { at } = windows()
    const delays: number[] = []
    for (let index = 0; index < 16; index++) {
      const result = await consumeAuthAttempt(
        'sign-in',
        { ip: `198.51.101.${index}`, account: 'target@example.test' },
        at(now + index)
      )
      expect(result.allowed).toBe(true)
      delays.push(result.delayMs)
    }
    expect(delays).toEqual([
      ...Array(10).fill(0),
      500,
      1000,
      2000,
      4000,
      5000,
      5000,
    ])
    // The shared window expires like any other.
    expect(
      (
        await consumeAuthAttempt(
          'sign-in',
          { ip: '198.51.101.99', account: 'target@example.test' },
          at(now + 16 * MINUTE)
        )
      ).delayMs
    ).toBe(0)
  })

  it('parallel attempts on one account from many IPs: at most 100 per window reach the password check', async () => {
    const { at } = windows()
    const account = 'parallel-target@example.test'
    // 80 IPs x 5 attempts, all at once: every (account, IP) and IP window
    // allows them, so only the ceiling per account can stop them.
    const results = await Promise.all(
      Array.from({ length: 400 }, (_, index) =>
        consumeAuthAttempt(
          'sign-in',
          { ip: `198.51.105.${index % 80}`, account },
          at(now)
        )
      )
    )
    const allowed = results.filter((result) => result.allowed)
    expect(allowed).toHaveLength(100)
    // Below the ceiling the progressive wait still applies.
    expect(Math.max(...allowed.map((result) => result.delayMs))).toBe(5000)
    for (const result of results.filter((entry) => !entry.allowed))
      expect(result).toMatchObject({
        remaining: 0,
        delayMs: 0,
        resetTime: now + 15 * MINUTE,
      })
    // A new client in the same window is refused too; the next window starts over.
    expect(
      (
        await consumeAuthAttempt(
          'sign-in',
          { ip: '198.51.106.1', account },
          at(now)
        )
      ).allowed
    ).toBe(false)
    expect(
      await consumeAuthAttempt(
        'sign-in',
        { ip: '198.51.106.1', account },
        at(now + 15 * MINUTE)
      )
    ).toMatchObject({ allowed: true, delayMs: 0 })
  })

  it('without a trusted client IP one bucket per account keeps brute force bounded', async () => {
    const { at } = windows()
    const attempt = () =>
      consumeAuthAttempt(
        'sign-in',
        { ip: null, account: 'no-ip@example.test' },
        at(now)
      )
    for (let index = 0; index < 5; index++)
      expect((await attempt()).allowed).toBe(true)
    expect((await attempt()).allowed).toBe(false)
  })

  it('without a trusted client IP, a flood of password-reset requests never evicts or spends the sign-in window of an account', async () => {
    const { table, at } = windows()
    const victim = 'no-ip-victim@example.test'
    const signIn = () =>
      consumeAuthAttempt('sign-in', { ip: null, account: victim }, at(now))
    for (let index = 0; index < 5; index++)
      expect((await signIn()).allowed).toBe(true)
    const signInKeys = () =>
      [...table.rows.keys()].filter((key) => key.startsWith('auth:sign-in:'))
    const before = signInKeys()
    // More new keys than any in-memory store would keep, one per random e-mail.
    const flood = MAX_RATE_LIMIT_ENTRIES + 1_000
    for (let index = 0; index < flood; index++)
      await consumeAuthAttempt(
        'password-reset',
        { ip: null, account: `flood-${index}@example.test` },
        at(now)
      )
    // The victim's budget is still spent: no free guesses were bought.
    expect((await signIn()).allowed).toBe(false)
    // The flood only ever wrote keys of its own scope, and nothing was evicted.
    expect(signInKeys()).toEqual(before)
    expect(table.rows.size).toBe(before.length + flood)
  }, 60_000)

  it('in production, without PLATFORM_RATE_LIMIT_SECRET every identity limiter refuses and counts nothing', async () => {
    const { applicationTable } = applicationPrisma as unknown as {
      applicationTable: ReturnType<typeof createPlatformRateLimitTable>
    }
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    const before = applicationTable.rows.size
    const short = 'short-rate-limit-secret-value'
    for (const configured of ['', '   ', short]) {
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', configured)
      for (const scope of ['sign-in', 'password-reset', 'register'] as const) {
        const refusal = consumeAuthAttempt(
          scope,
          { ip: '192.0.2.61', account: 'config@example.test' },
          { now }
        )
        await expect(refusal).rejects.toThrow(/PLATFORM_RATE_LIMIT_SECRET/)
        await expect(refusal).rejects.not.toThrow(short)
      }
      const guard = legacySignInGuard({ now })
      await expect(
        guard.consume({ ip: '192.0.2.61', account: 'config@example.test' })
      ).rejects.toThrow(/PLATFORM_RATE_LIMIT_SECRET/)
      // No e-mail when the budget cannot be read.
      expect(
        await consumeAccountNotice('password-reset', 'config@example.test', {
          now,
        })
      ).toBe(false)
    }
    expect(applicationTable.rows.size).toBe(before)
    for (const call of logged.mock.calls)
      expect(JSON.stringify(call)).not.toContain(short)
    // With the secret the same calls count as usual.
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'k'.repeat(32))
    expect(
      (
        await consumeAuthAttempt(
          'sign-in',
          { ip: '192.0.2.61', account: 'config@example.test' },
          { now }
        )
      ).allowed
    ).toBe(true)
  })

  it('the secret is required by the platform production criterion (resolvePlatformEnv), not by NODE_ENV alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const platform = {
      PLATFORM_ROOT_DOMAIN: 'plataforma.example',
      PLATFORM_EDGE_SECRET: 'e'.repeat(40),
    }
    const configured = 'k'.repeat(32)
    const production = [
      // PLATFORM_ENV=production vale mesmo com NODE_ENV de teste ou desenvolvimento.
      { ...platform, PLATFORM_ENV: 'production', NODE_ENV: 'test' },
      { ...platform, PLATFORM_ENV: 'production', NODE_ENV: 'development' },
      { ...platform, VERCEL_ENV: 'production' },
      { ...platform, NODE_ENV: 'production' },
      // Ambiente da plataforma inválido: qualquer sinal de produção vale (falha fechada).
      { NODE_ENV: 'production' },
      { PLATFORM_ENV: 'nenhum', VERCEL_ENV: 'production' },
      { PLATFORM_ENV: 'production', NODE_ENV: 'test' },
    ]
    for (const env of production) {
      expect(isPlatformProduction(env), JSON.stringify(env)).toBe(true)
      expect(() => identityRateLimitSecret(env)).toThrow(
        /PLATFORM_RATE_LIMIT_SECRET/
      )
      expect(
        identityRateLimitSecret({
          ...env,
          PLATFORM_RATE_LIMIT_SECRET: configured,
        })
      ).toBe(configured)
    }
    const local = [
      // Preview da Vercel e `next start` local com PLATFORM_ENV=development: NODE_ENV=production não basta.
      { ...platform, VERCEL_ENV: 'preview', NODE_ENV: 'production' },
      { PLATFORM_ENV: 'development', NODE_ENV: 'production' },
      { ...platform, PLATFORM_ENV: 'staging', NODE_ENV: 'production' },
      { NODE_ENV: 'test' },
    ]
    for (const env of local) {
      expect(isPlatformProduction(env), JSON.stringify(env)).toBe(false)
      expect(identityRateLimitSecret(env)).toMatch(/^[0-9a-f]{64}$/)
    }

    // Pelo caminho real dos limitadores.
    for (const [key, value] of Object.entries(platform)) vi.stubEnv(key, value)
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PLATFORM_ENV', 'production')
    const attempt = { ip: '192.0.2.62', account: 'criterio@example.test' }
    await expect(
      consumeAuthAttempt('password-reset', attempt, { now })
    ).rejects.toThrow(/PLATFORM_RATE_LIMIT_SECRET/)
    await expect(legacySignInGuard({ now }).consume(attempt)).rejects.toThrow(
      /PLATFORM_RATE_LIMIT_SECRET/
    )
    vi.stubEnv('PLATFORM_ENV', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('NODE_ENV', 'production')
    expect(
      (await consumeAuthAttempt('password-reset', attempt, { now })).allowed
    ).toBe(true)
  })

  it('a success clears the shared window and only its own requester window; a password change clears all', async () => {
    const { at } = windows()
    const account = 'cleared@example.test'
    const attempt = (ip: string) =>
      consumeAuthAttempt('sign-in', { ip, account }, at(now))
    for (const ip of ['198.51.102.1', '198.51.102.2', '198.51.102.3'])
      for (let index = 0; index < 5; index++) await attempt(ip)
    expect((await attempt('198.51.102.4')).delayMs).toBeGreaterThan(0)

    await clearAuthAccountAttempts('sign-in', account, '198.51.102.1', at(now))
    expect(await attempt('198.51.102.1')).toMatchObject({
      allowed: true,
      delayMs: 0,
    })
    expect((await attempt('198.51.102.2')).allowed).toBe(false)
    await resetAuthAccountAttempts('sign-in', 'Cleared@Example.test ', at(now))
    expect((await attempt('198.51.102.2')).allowed).toBe(true)
    expect((await attempt('198.51.102.3')).allowed).toBe(true)
  })

  it('registration allows 10 per IP and 5 per target e-mail', async () => {
    const { at } = windows()
    const register = async (ip: string, account: string) =>
      (await consumeAuthAttempt('register', { ip, account }, at(now))).allowed
    const perIp: boolean[] = []
    for (let index = 0; index < 11; index++)
      perIp.push(await register('198.51.103.1', `new-${index}@example.test`))
    expect(perIp).toEqual([...Array(10).fill(true), false])
    const perTarget: boolean[] = []
    for (let index = 0; index < 6; index++)
      perTarget.push(
        await register(`198.51.103.${10 + index}`, 'wanted@example.test')
      )
    expect(perTarget).toEqual([...Array(5).fill(true), false])
  })

  it('account notices have their own silent budget', async () => {
    const { at } = windows()
    const notice = (when: number) =>
      consumeAccountNotice(
        'registration-attempt',
        'Holder@example.test',
        at(when)
      )
    expect(await notice(now)).toBe(true)
    expect(await notice(now + 5 * 60 * MINUTE)).toBe(false)
    expect(await notice(now + 6 * 60 * MINUTE + 1)).toBe(true)
    const reset: boolean[] = []
    for (let index = 0; index < 4; index++)
      reset.push(
        await consumeAccountNotice(
          'password-reset',
          'holder@example.test',
          at(now)
        )
      )
    expect(reset).toEqual([true, true, true, false])
  })

  it('verification resend (achado 106): one per 5 minutes and three per day per account, silently', async () => {
    const { at } = windows()
    const resend = (when: number, account = 'Unverified@example.test') =>
      consumeVerificationResend(account, at(when))
    const day = Date.UTC(2030, 0, 2)
    expect(await resend(day)).toBe(true)
    // Same 5-minute window: skipped, whatever the letter case.
    expect(await resend(day + 4 * MINUTE, 'unverified@example.test')).toBe(
      false
    )
    expect(await resend(day + 5 * MINUTE)).toBe(true)
    expect(await resend(day + 10 * MINUTE)).toBe(true)
    // Fourth of the day: skipped even in a fresh 5-minute window.
    expect(await resend(day + 15 * MINUTE)).toBe(false)
    expect(await resend(day + 20 * 60 * MINUTE)).toBe(false)
    // Another account keeps its own budget; the next day starts over.
    expect(await resend(day + 15 * MINUTE, 'other@example.test')).toBe(true)
    expect(await resend(day + 24 * 60 * MINUTE)).toBe(true)
  })

  it('a storage failure never lets an attempt through; clearing and notices fail quietly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: RateLimitCounter = {
      hit: async () => {
        throw new Error('database unavailable')
      },
      remove: async () => {
        throw new Error('database unavailable')
      },
      removePrefix: async () => {
        throw new Error('database unavailable')
      },
    }
    const options = { now, counter: broken, secret: SECRET }
    await expect(
      consumeAuthAttempt(
        'sign-in',
        { ip: '198.51.104.1', account: 'down@example.test' },
        options
      )
    ).rejects.toThrow('database unavailable')
    // No e-mail when the budget cannot be read; the caller's answer is unchanged.
    expect(
      await consumeAccountNotice('password-reset', 'down@example.test', options)
    ).toBe(false)
    await expect(
      clearAuthAccountAttempts('sign-in', 'down@example.test', null, options)
    ).resolves.toBeUndefined()
    await expect(
      resetAuthAccountAttempts('sign-in', 'down@example.test', options)
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledTimes(3)
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'persistent identity windows (platform_rate_limits, disposable database)',
  () => {
    // Two clients on two pools: two server instances sharing one database.
    const instances: PrismaClient[] = []
    const pools: Array<{ end(): Promise<void> }> = []
    const written = new Set<string>()
    // A fresh secret per run keeps runs apart; the keys are removed afterwards.
    const secret = randomBytes(32).toString('hex')
    const now = Date.UTC(2030, 0, 1)
    const recording = (client: PrismaClient): RateLimitCounter => {
      const counter = prismaRateLimitCounter(client)
      return {
        hit: (key, expiresAt) => {
          written.add(key)
          return counter.hit(key, expiresAt)
        },
        remove: (keys) => counter.remove(keys),
        removePrefix: (prefix) => counter.removePrefix(prefix),
      }
    }
    const instance = (index: 0 | 1) => ({
      now,
      counter: recording(instances[index]!),
      secret,
    })
    const run = randomUUID().slice(0, 8)

    beforeAll(async () => {
      const { Pool } = await import('pg')
      const { PrismaClient } = await import('@prisma/client')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const connectionString = requireTestDatabase(process.env)
      for (let index = 0; index < 2; index++) {
        const pool = new Pool({ connectionString, max: 4 })
        pools.push(pool)
        instances.push(new PrismaClient({ adapter: new PrismaPg(pool) }))
      }
    })
    afterAll(async () => {
      if (instances[0])
        await instances[0].platformRateLimit.deleteMany({
          where: { key: { in: [...written] } },
        })
      for (const client of instances) await client.$disconnect()
      for (const pool of pools) await pool.end()
    })

    it('an (account, IP) window filled on one instance refuses on the other', async () => {
      const account = `persist-${run}@example.test`
      const ip = '198.51.110.1'
      for (let index = 0; index < 5; index++)
        expect(
          (await consumeAuthAttempt('sign-in', { ip, account }, instance(0)))
            .allowed
        ).toBe(true)
      expect(
        await consumeAuthAttempt('sign-in', { ip, account }, instance(1))
      ).toMatchObject({ allowed: false, resetTime: now + 15 * MINUTE })
      expect(
        (
          await consumeAuthAttempt(
            'sign-in',
            { ip: '198.51.110.2', account },
            instance(1)
          )
        ).allowed
      ).toBe(true)
      // The success on instance B clears what instance A counted.
      await clearAuthAccountAttempts('sign-in', account, ip, instance(1))
      expect(
        (await consumeAuthAttempt('sign-in', { ip, account }, instance(0)))
          .allowed
      ).toBe(true)
    })

    it('concurrent attempts on both instances are counted atomically', async () => {
      const account = `race-${run}@example.test`
      const ip = '198.51.110.3'
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          consumeAuthAttempt(
            'password-reset',
            { ip, account },
            instance((index % 2) as 0 | 1)
          )
        )
      )
      // 5 pass the IP window; 3 of those pass the (account, IP) window.
      expect(results.filter((result) => result.allowed)).toHaveLength(3)
      const rows = await instances[0]!.platformRateLimit.findMany({
        where: { key: { in: [...written] } },
        select: { key: true, count: true },
      })
      const counts = rows
        .filter((row) => row.key.startsWith('auth:password-reset:'))
        .map((row) => row.count)
        .sort((a, b) => a - b)
      expect(counts).toEqual([5, 40])
    })

    it('parallel sign-in attempts on one account from many IPs on both instances: exactly the ceiling of 100 passes', async () => {
      const account = `ceiling-${run}@example.test`
      const results = await Promise.all(
        Array.from({ length: 300 }, (_, index) =>
          consumeAuthAttempt(
            'sign-in',
            { ip: `198.51.111.${index % 60}`, account },
            instance((index % 2) as 0 | 1)
          )
        )
      )
      expect(results.filter((result) => result.allowed)).toHaveLength(100)
      const rows = await instances[0]!.platformRateLimit.findMany({
        where: {
          key: {
            in: [...written].filter((key) =>
              key.startsWith('auth:sign-in:account:')
            ),
          },
        },
        select: { count: true },
      })
      // Every attempt was counted in the shared window, none lost.
      expect(rows.map((row) => row.count)).toContain(300)
    })

    it('stores only HMAC keys with the window end as expiry', async () => {
      const account = `stored-${run}@example.test`
      await consumeAuthAttempt(
        'register',
        { ip: '198.51.110.4', account },
        instance(0)
      )
      const rows = await instances[1]!.platformRateLimit.findMany({
        where: { key: { in: [...written] } },
      })
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row.key).not.toMatch(/example|198\.51\.110|stored|race|persist/i)
        expect(row.expiresAt.getTime()).toBe(now + 15 * MINUTE)
      }
      // Another secret reaches none of these windows.
      const other = { ...instance(1), secret: randomBytes(32).toString('hex') }
      for (let index = 0; index < 5; index++)
        await consumeAuthAttempt(
          'register',
          { ip: '198.51.110.5', account: `other-${run}@example.test` },
          instance(0)
        )
      expect(
        (
          await consumeAuthAttempt(
            'register',
            { ip: '198.51.110.5', account: `other-${run}@example.test` },
            other
          )
        ).allowed
      ).toBe(true)
    })
  }
)
