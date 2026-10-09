/**
 * Contexto de borda (proxy web → backend): só vale com o segredo da borda
 * (atual ou anterior, em tempo constante) e com a origem revalidada por
 * `classifyHost`. Qualquer divergência devolve `null` (requisição "sem host").
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { identityConfiguration } from '../../packages/backend/src/modules/identity/configuration'

const crypto = vi.hoisted(() => ({ calls: [] as Array<[number, number]> }))
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      crypto.calls.push([a.byteLength, b.byteLength])
      return actual.timingSafeEqual(a, b)
    },
  }
})

import { readPlatformEdgeContext } from '../../packages/backend/src/modules/identity/platform-edge'

const SECRET = 'edge-secret-current-0123456789abcdef'
const PREVIOUS = 'edge-secret-previous-0123456789abcdef'
const ROOT = 'plataforma.test'
const env = {
  PLATFORM_ENV: 'staging',
  PLATFORM_ROOT_DOMAIN: ROOT,
  PLATFORM_EDGE_SECRET: SECRET,
  PLATFORM_EDGE_SECRET_PREVIOUS: PREVIOUS,
}

type Edge = {
  auth?: string | null
  kind?: string | null
  slug?: string | null
  origin?: string | null
  ip?: string | null
}
function request(edge: Edge = {}): Request {
  const headers = new Headers()
  const set = (name: string, value: string | null | undefined) => {
    if (value !== null && value !== undefined) headers.set(name, value)
  }
  set('x-platform-edge-auth', edge.auth === undefined ? SECRET : edge.auth)
  set('x-platform-host-kind', edge.kind === undefined ? 'tenant' : edge.kind)
  set('x-platform-tenant-slug', edge.slug === undefined ? 'alfa' : edge.slug)
  set(
    'x-platform-origin',
    edge.origin === undefined ? `https://alfa.${ROOT}` : edge.origin
  )
  set('x-platform-client-ip', edge.ip === undefined ? '203.0.113.7' : edge.ip)
  return new Request('https://backend.internal/api/categories', { headers })
}

afterEach(() => {
  crypto.calls.length = 0
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('readPlatformEdgeContext', () => {
  it('accepts a tenant edge with the current secret and a canonical origin', () => {
    expect(readPlatformEdgeContext(request(), env)).toEqual({
      hostKind: 'tenant',
      tenantSlug: 'alfa',
      origin: `https://alfa.${ROOT}`,
      clientIp: '203.0.113.7',
    })
  })

  it('accepts the previous secret during rotation', () => {
    expect(
      readPlatformEdgeContext(request({ auth: PREVIOUS }), env)
    ).toMatchObject({ hostKind: 'tenant', tenantSlug: 'alfa' })
  })

  it('compares both secrets in constant time over fixed-size digests', () => {
    readPlatformEdgeContext(request({ auth: 'x' }), env)
    expect(crypto.calls).toEqual([
      [32, 32],
      [32, 32],
    ])
  })

  it.each([
    ['a wrong secret', 'edge-secret-wrong-0123456789abcdefgh'],
    ['a prefix of the secret', SECRET.slice(0, -1)],
    ['the secret with a suffix', SECRET + 'x'],
    ['the secret in another case', SECRET.toUpperCase()],
    ['an empty value', ''],
  ])('ignores the whole edge with %s', (_name, auth) => {
    expect(readPlatformEdgeContext(request({ auth }), env)).toBeNull()
  })

  it('ignores edge headers without the auth header, without reading the platform env', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(
      readPlatformEdgeContext(request({ auth: null }), {
        PLATFORM_ENV: 'bogus',
      })
    ).toBeNull()
    expect(log).not.toHaveBeenCalled()
  })

  it('ignores the edge when the backend has no edge secret configured', () => {
    const {
      PLATFORM_EDGE_SECRET: _current,
      PLATFORM_EDGE_SECRET_PREVIOUS: _previous,
      ...withoutSecret
    } = env
    expect(readPlatformEdgeContext(request(), withoutSecret)).toBeNull()
  })

  it('fails closed on an invalid platform env and never logs the secret', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(
      readPlatformEdgeContext(request(), {
        ...env,
        PLATFORM_ENV: 'production',
        PLATFORM_ROOT_DOMAIN: '',
      })
    ).toBeNull()
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET)
  })

  it.each([
    ['uppercase host', `https://ALFA.${ROOT}`],
    ['trailing slash', `https://alfa.${ROOT}/`],
    ['explicit default port', `https://alfa.${ROOT}:443`],
    ['http outside development', `http://alfa.${ROOT}`],
    ['another root domain', 'https://alfa.outra.test'],
    ['multi-level host', `https://x.alfa.${ROOT}`],
    ['path', `https://alfa.${ROOT}/equipamentos`],
    ['credentials', `https://user@alfa.${ROOT}`],
    ['raw host without scheme', `alfa.${ROOT}`],
    ['missing origin', null],
  ])('rejects a non-canonical origin (%s)', (_name, origin) => {
    expect(readPlatformEdgeContext(request({ origin }), env)).toBeNull()
  })

  it('rejects a tenant slug header that differs from the origin host', () => {
    expect(readPlatformEdgeContext(request({ slug: 'beta' }), env)).toBeNull()
    expect(readPlatformEdgeContext(request({ slug: null }), env)).toBeNull()
    expect(readPlatformEdgeContext(request({ slug: 'ALFA' }), env)).toBeNull()
  })

  it('rejects a host kind that differs from the classified origin', () => {
    expect(readPlatformEdgeContext(request({ kind: 'app' }), env)).toBeNull()
    expect(readPlatformEdgeContext(request({ kind: 'apex' }), env)).toBeNull()
    expect(readPlatformEdgeContext(request({ kind: null }), env)).toBeNull()
    expect(
      readPlatformEdgeContext(
        request({ kind: 'tenant', slug: 'app', origin: `https://app.${ROOT}` }),
        env
      )
    ).toBeNull()
  })

  it.each([
    ['www', `https://www.${ROOT}`, 'www'],
    ['reserved label', `https://api.${ROOT}`, 'api'],
    ['invalid label', `https://a--b.${ROOT}`, 'a--b'],
  ])('never builds a context for a %s host', (_name, origin, slug) => {
    for (const kind of ['tenant', 'app', 'apex', 'www', 'reserved'])
      expect(
        readPlatformEdgeContext(request({ kind, slug, origin }), env)
      ).toBeNull()
  })

  it('accepts app and apex hosts only without a tenant slug', () => {
    expect(
      readPlatformEdgeContext(
        request({ kind: 'app', slug: null, origin: `https://app.${ROOT}` }),
        env
      )
    ).toEqual({
      hostKind: 'app',
      origin: `https://app.${ROOT}`,
      clientIp: '203.0.113.7',
    })
    expect(
      readPlatformEdgeContext(
        request({ kind: 'apex', slug: null, origin: `https://${ROOT}` }),
        env
      )
    ).toEqual({
      hostKind: 'apex',
      origin: `https://${ROOT}`,
      clientIp: '203.0.113.7',
    })
    expect(
      readPlatformEdgeContext(
        request({ kind: 'app', slug: 'alfa', origin: `https://app.${ROOT}` }),
        env
      )
    ).toBeNull()
  })

  it('keeps the context but drops a malformed client IP', () => {
    for (const ip of ['203.0.113.7, 198.51.100.1', '<script>', 'x'.repeat(60)])
      expect(readPlatformEdgeContext(request({ ip }), env)).toMatchObject({
        hostKind: 'tenant',
        clientIp: null,
      })
    expect(
      readPlatformEdgeContext(request({ ip: '2001:db8::1' }), env)
    ).toMatchObject({
      clientIp: '2001:db8::1',
    })
  })

  it('revalidates development origins with the public port', () => {
    const dev = { PLATFORM_ENV: 'development', PLATFORM_EDGE_SECRET: SECRET }
    expect(
      readPlatformEdgeContext(
        request({ origin: 'http://alfa.localhost:3001' }),
        dev
      )
    ).toMatchObject({ hostKind: 'tenant', tenantSlug: 'alfa' })
    expect(
      readPlatformEdgeContext(
        request({ origin: 'http://alfa.localhost:3000' }),
        dev
      )
    ).toBeNull()
  })

  it('accepts Vercel preview prefixes only in a preview deployment', () => {
    const origin = 'https://alfa---deploy-1.vercel.app'
    const preview = {
      ...env,
      PLATFORM_ENV: 'preview',
      VERCEL_ENV: 'preview',
    }
    expect(readPlatformEdgeContext(request({ origin }), preview)).toMatchObject(
      {
        hostKind: 'tenant',
        tenantSlug: 'alfa',
        origin,
      }
    )
    expect(readPlatformEdgeContext(request({ origin }), env)).toBeNull()
  })

  // Achados 1 e 24: WEB_API_ORIGIN é só do processo web. O backend de produção
  // configurado como a ADR manda (sem ela) precisa aceitar a borda válida.
  it.each([
    ['PLATFORM_ENV=production', { PLATFORM_ENV: 'production' }],
    ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ['VERCEL_ENV=production', { VERCEL_ENV: 'production' }],
  ])(
    'production backend (%s) without WEB_API_ORIGIN accepts a valid edge',
    (_name, production) => {
      const backend = {
        PLATFORM_ROOT_DOMAIN: ROOT,
        PLATFORM_EDGE_SECRET: SECRET,
        ...production,
      }
      expect(readPlatformEdgeContext(request(), backend)).toEqual({
        hostKind: 'tenant',
        tenantSlug: 'alfa',
        origin: `https://alfa.${ROOT}`,
        clientIp: '203.0.113.7',
      })
      expect(
        readPlatformEdgeContext(
          request({ kind: 'app', slug: null, origin: `https://app.${ROOT}` }),
          backend
        )
      ).toMatchObject({ hostKind: 'app', origin: `https://app.${ROOT}` })
      // Continua falhando fechado: segredo errado ou ausente não forma borda.
      expect(
        readPlatformEdgeContext(
          request({ auth: 'edge-secret-wrong-0123456789abcdefgh' }),
          backend
        )
      ).toBeNull()
    }
  )

  it('production backend ignores a web-only WEB_API_ORIGIN copied from the web env', () => {
    for (const origin of [
      'http://127.0.0.1:3000',
      'https://backend.example/api',
    ])
      expect(
        readPlatformEdgeContext(request(), {
          PLATFORM_ENV: 'production',
          PLATFORM_ROOT_DOMAIN: ROOT,
          PLATFORM_EDGE_SECRET: SECRET,
          WEB_API_ORIGIN: origin,
        })
      ).toMatchObject({ hostKind: 'tenant', tenantSlug: 'alfa' })
  })

  it('production backend reads the edge from process.env without WEB_API_ORIGIN', () => {
    vi.stubEnv('PLATFORM_ENV', '')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
    vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
    vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
    vi.stubEnv('WEB_API_ORIGIN', '')
    expect(readPlatformEdgeContext(request())).toMatchObject({
      hostKind: 'tenant',
      tenantSlug: 'alfa',
      origin: `https://alfa.${ROOT}`,
    })
  })

  it('reads process.env by default', () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    expect(readPlatformEdgeContext(request())).toMatchObject({
      hostKind: 'tenant',
      tenantSlug: 'alfa',
    })
    vi.stubEnv('PLATFORM_EDGE_SECRET', 'another-secret-0123456789abcdefghij')
    vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
    expect(readPlatformEdgeContext(request())).toBeNull()
  })
})

describe('backend identity configuration in production (achado 24)', () => {
  it('better-auth starts without WEB_API_ORIGIN and trusts the edge origin', () => {
    const config = identityConfiguration({
      NODE_ENV: 'production',
      PLATFORM_ENV: 'production',
      PLATFORM_ROOT_DOMAIN: ROOT,
      PLATFORM_EDGE_SECRET: SECRET,
      AUTH_MODE: 'better-auth',
      BETTER_AUTH_URL: `https://app.${ROOT}`,
      BETTER_AUTH_SECRET: 'better-auth-secret-0123456789abcdef',
    })
    expect(config.baseURL).toBe(`https://app.${ROOT}`)
    expect(config.readEdge(request())).toMatchObject({
      hostKind: 'tenant',
      tenantSlug: 'alfa',
      origin: `https://alfa.${ROOT}`,
    })
  })
})
