/**
 * Achado 149 (onda 133): as leituras GET/HEAD do Better Auth (`get-session`, `list-sessions`, `list-accounts`,
 * `account-info` e qualquer outro GET do motor) recusam `Origin` explícito de outra origem antes do motor e do banco,
 * nas composições REAIS dos dois hosts (`lib/identity` e `apps/services/api/src/host/session`), pelo
 * `handleIdentityRequest` comum (`packages/backend/src/modules/identity/runtime.ts`).
 *
 * Consumidores caracterizados: o cliente web de cada host chama o próprio host (mesma origem, GET sem `Origin`); o app
 * nativo não envia `Origin` (o `expoClient` manda `expo-origin`, que o plugin `expo` só traduz dentro do motor).
 * Exceções, com o motivo: as navegações de topo que chegam de outro site por desenho e se protegem por `state`,
 * PKCE ou token de uso único, nunca por `Origin` (retorno do provedor OAuth, conclusão do `oauth-proxy` vinda do `app`,
 * proxy do navegador do sistema aberto pelo app, links de e-mail e a página de erro para onde esses fluxos
 * redirecionam). Mutações seguem com a defesa própria do motor (`OWN_CSRF_DEFENCE`).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  create: vi.fn(),
  handler: vi.fn(),
  readDatabase: vi.fn(),
  runtimeDatabase: vi.fn(),
}))
vi.mock(
  '../../packages/backend/src/modules/identity/factory',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../packages/backend/src/modules/identity/factory')
    >()),
    createIdentity: state.create,
  })
)
vi.mock('@/lib/prisma', () => ({
  get prisma() {
    state.readDatabase()
    return {}
  },
}))
vi.mock('@/lib/resend', () => ({ default: () => null }))
vi.mock('@/lib/rate-limit', () => ({
  consumeVerificationResend: vi.fn(),
  legacySignInGuard: vi.fn(),
}))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => {
    state.runtimeDatabase()
    return { prisma: {} }
  },
  createResendClient: () => null,
}))

const SECRET = 'identity-read-origin-edge-secret-0123456789'
const ROOT = 'platform.test'
const APP = `https://app.${ROOT}`
const ALFA = `https://alfa.${ROOT}`
const BRAVO = `https://bravo.${ROOT}`
const BACKEND = 'https://backend.example.test'
const DENIAL = { error: 'Origem não permitida' }

const edges = {
  app: {
    'x-platform-edge-auth': SECRET,
    'x-platform-host-kind': 'app',
    'x-platform-origin': APP,
  },
  alfa: {
    'x-platform-edge-auth': SECRET,
    'x-platform-host-kind': 'tenant',
    'x-platform-origin': ALFA,
    'x-platform-tenant-slug': 'alfa',
  },
} as const

/** Origens explícitas que nenhum consumidor legítimo envia numa leitura do motor, por host. */
const FOREIGN = [
  ['alfa', 'sibling tenant', { Origin: BRAVO, 'Sec-Fetch-Site': 'same-site' }],
  ['alfa', 'panel on the tenant host', { Origin: APP }],
  ['alfa', 'opaque origin', { Origin: 'null' }],
  [
    'app',
    'tenant origin on the panel',
    { Origin: ALFA, 'Sec-Fetch-Site': 'same-site' },
  ],
  [
    'app',
    'other site',
    { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
  ],
  [
    'app',
    'own origin with a same-site fetch',
    { Origin: APP, 'Sec-Fetch-Site': 'same-site' },
  ],
] as const

/** GET do motor sem consumidor de outra origem (a enumeração da instância real está em tenant-auth-api.test.ts). */
const PRIVATE_READS = [
  'get-session',
  'list-sessions',
  'list-accounts',
  'account-info',
  'ok',
  'endpoint-of-a-future-version',
]
/** Navegações de topo vindas de outro site por desenho: a recusa por Origin não vale nelas. */
const NAVIGATIONS = [
  'callback/google',
  'callback/google/oauth-proxy',
  'oauth-proxy-callback',
  'expo-authorization-proxy',
  'verify-email',
  'reset-password/fixtureResetToken_01',
  'delete-user/callback',
  'error',
]
/** Caminhos que imitam uma navegação mas não são uma: continuam sob a regra. */
const LOOKALIKES = [
  'callback/google/../../get-session',
  'callback/google/%2e%2e/%2e%2e/list-sessions',
  'callback/',
  'callback/google/oauth-proxy/extra',
  'callback/google%2F..%2F..%2Fget-session',
  'reset-password/a/b',
  'error/',
  'get-session/',
  '/get-session',
  'oauth-proxy-callbackx',
]

type Handle = (request: Request) => Promise<Response>
const HOSTS = [
  [
    'legacy',
    async (): Promise<Handle> =>
      (await import('@/lib/identity')).handleIdentityRequest,
  ],
  [
    'service',
    async (): Promise<Handle> =>
      (await import('../../apps/services/api/src/host/session'))
        .handleIdentityRequest,
  ],
] as const

const request = (
  path: string,
  headers: Record<string, string>,
  method = 'GET'
) => new Request(`${BACKEND}${path}`, { method, headers })

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUTH_MODE', 'better-auth')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.stubEnv('BETTER_AUTH_URL', APP)
  vi.stubEnv('BETTER_AUTH_SECRET', 'identity-read-origin-secret-more-than-32')
  vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', '')
  vi.stubEnv('AUTH_TRUSTED_ORIGINS', '')
  vi.stubEnv('GOOGLE_CLIENT_ID', '')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
  vi.stubEnv('FACEBOOK_CLIENT_ID', '')
  vi.stubEnv('FACEBOOK_CLIENT_SECRET', '')
  state.handler.mockImplementation(async () => Response.json({ engine: true }))
  state.create.mockReturnValue({ api: {}, handler: state.handler })
})
afterAll(() => vi.unstubAllEnvs())

describe.each(HOSTS)('%s Better Auth reads', (_host, load) => {
  const untouched = () => {
    expect(state.handler).not.toHaveBeenCalled()
    expect(state.create).not.toHaveBeenCalled()
    expect(state.readDatabase).not.toHaveBeenCalled()
    expect(state.runtimeDatabase).not.toHaveBeenCalled()
  }

  it.each(
    PRIVATE_READS.flatMap((endpoint) =>
      FOREIGN.map(
        ([edge, label, origin]) => [endpoint, label, edge, origin] as const
      )
    )
  )(
    'refuses %s with %s before the engine and its storage (GET and HEAD)',
    async (endpoint, _label, edge, origin) => {
      const handle = await load()
      for (const method of ['GET', 'HEAD']) {
        const response = await handle(
          request(
            `/api/auth/${endpoint}`,
            { ...edges[edge], ...origin },
            method
          )
        )
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual(DENIAL)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('set-cookie')).toBeNull()
      }
      untouched()
    }
  )

  it.each(LOOKALIKES)(
    'keeps a navigation lookalike under the rule: %s',
    async (endpoint) => {
      const handle = await load()
      const response = await handle(
        request(`/api/auth/${endpoint}`, { ...edges.alfa, Origin: BRAVO })
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual(DENIAL)
      untouched()
    }
  )

  it.each(PRIVATE_READS)(
    'keeps %s for the real consumers: no Origin (same-origin fetch, native app) or the own origin',
    async (endpoint) => {
      const handle = await load()
      for (const [edge, origin] of [
        ['alfa', {}],
        ['alfa', { 'Sec-Fetch-Site': 'cross-site' }],
        ['alfa', { Origin: ALFA, 'Sec-Fetch-Site': 'same-origin' }],
        ['app', { Origin: APP, 'Sec-Fetch-Site': 'same-origin' }],
        ['app', { 'expo-origin': 'locadora://' }],
      ] as const) {
        const response = await handle(
          request(`/api/auth/${endpoint}`, { ...edges[edge], ...origin })
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ engine: true })
      }
      expect(state.handler).toHaveBeenCalledTimes(5)
    }
  )

  it.each(NAVIGATIONS)(
    'leaves the cross-site navigation %s to the engine, whatever the Origin',
    async (endpoint) => {
      const handle = await load()
      for (const origin of [BRAVO, APP, 'null']) {
        const response = await handle(
          request(`/api/auth/${endpoint}`, { ...edges.alfa, Origin: origin })
        )
        expect(response.status).toBe(200)
      }
      expect(state.handler).toHaveBeenCalledTimes(3)
      expect(new URL(state.handler.mock.calls[0]![0].url).pathname).toBe(
        `/api/auth/${endpoint}`
      )
    }
  )

  it('leaves mutations to the engine own defence (Better Auth checks Origin itself)', async () => {
    const handle = await load()
    const response = await handle(
      request(
        '/api/auth/sign-in/email',
        { ...edges.alfa, Origin: BRAVO },
        'POST'
      )
    )
    expect(response.status).toBe(200)
    expect(state.handler).toHaveBeenCalledTimes(1)
  })

  it('applies the rule on the v2 basePath while the backend is in legacy mode', async () => {
    vi.stubEnv('AUTH_MODE', 'legacy')
    vi.stubEnv('AUTH_V2_ENABLED', 'true')
    const handle = await load()
    const refused = await handle(
      request('/api/auth/v2/get-session', { ...edges.app, Origin: ALFA })
    )
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual(DENIAL)
    untouched()
    const navigation = await handle(
      request('/api/auth/v2/callback/google', { ...edges.app, Origin: BRAVO })
    )
    expect(navigation.status).toBe(200)
    const outside = await handle(
      request('/api/auth/callback/google', { ...edges.app, Origin: BRAVO })
    )
    expect(outside.status).toBe(403)
    expect(state.handler).toHaveBeenCalledTimes(1)
  })

  it('keeps the disabled-engine 503 ahead of the origin refusal', async () => {
    vi.stubEnv('AUTH_MODE', 'legacy')
    const handle = await load()
    const response = await handle(
      request('/api/auth/v2/get-session', { ...edges.app, Origin: ALFA })
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Identity v2 unavailable' })
    untouched()
  })
})
