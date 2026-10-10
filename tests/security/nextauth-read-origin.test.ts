const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return {
    prisma: { user: { findUnique: mocks.findUnique, findMany: vi.fn() } },
  }
}
/**
 * Achado 149 (onda 133, segunda rodada): os GET do NextAuth (`session`, `csrf`, `providers`, `signin`, `signout`,
 * `verify-request` e qualquer ação nova) recusam `Origin` explícito de outra origem antes do motor e do banco,
 * na rota REAL `apps/services/api/src/app/api/auth/[...nextauth]/route.ts`, no modo `legacy`
 * (o padrão) e no `better-auth-v2`, onde o NextAuth continua em `/api/auth/*`. A regra é a mesma do Better Auth
 * (`engine-read-origin.ts`), aplicada pelo envoltório comum `withSignInAvailability(NextAuth(authOptions))`.
 *
 * Consumidores caracterizados: o `next-auth/react` do navegador chama só o `basePath` (`/api/auth`, mesma origem; GET
 * de mesma origem não leva `Origin`), inclusive no host de locadora (`/api/auth/session` da `TENANT_API_ALLOWLIST`);
 * o cliente legacy do app nativo (`apps/clients/mobile/src/host/auth/legacy-client.ts`) usa o `fetch` do React Native,
 * que não envia `Origin`; o host web não chama o NextAuth do lado do servidor. Exceções, com o motivo: as navegações
 * de topo que chegam de outro site por desenho e se protegem por `state`/PKCE, nunca por `Origin` (`/callback/:id`,
 * o retorno do Google e do Facebook) e a página `/error` para onde esse retorno manda. Mutações seguem com a defesa
 * própria do motor (token duplo do NextAuth, `OWN_CSRF_DEFENCE`).
 *
 * Sem banco: o Prisma do runtime do serviço é um dublê que registra a leitura da credencial da sessão.
 */
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import { encode } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  // A composição de sessão do serviço e o NextAuth leem estes valores quando os módulos são avaliados.
  process.env.NEXTAUTH_SECRET = 'nextauth-read-origin-secret-0123456789abcdef'
  process.env.NEXTAUTH_URL = 'https://app.platform.test'
  return {
    findUnique: vi.fn(),
    cookies: new Map<string, string>(),
    headers: new Headers(),
  }
})

vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({
      prisma: { user: { findUnique: mocks.findUnique, findMany: vi.fn() } },
    }),
    createResendClient: () => null,
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})

import * as legacyRoute from '../../apps/services/api/src/app/api/auth/[...nextauth]/route'
import * as serviceRoute from '../../apps/services/api/src/app/api/auth/[...nextauth]/route'

const NEXTAUTH_SECRET = 'nextauth-read-origin-secret-0123456789abcdef'
const EDGE_SECRET = 'nextauth-read-origin-edge-secret-0123456789'
const ROOT = 'platform.test'
const APP = `https://app.${ROOT}`
const ALFA = `https://alfa.${ROOT}`
const BRAVO = `https://bravo.${ROOT}`
const BACKEND = 'https://backend.example.test'
const DENIAL = { error: 'Origem não permitida' }
const USER = {
  id: 'nextauth-read-origin-user',
  password: '$2a$12$fixturehashfixturehashfixturehashfixturehashfixtu',
}

const edges = {
  app: {
    'x-platform-edge-auth': EDGE_SECRET,
    'x-platform-host-kind': 'app',
    'x-platform-origin': APP,
  },
  alfa: {
    'x-platform-edge-auth': EDGE_SECRET,
    'x-platform-host-kind': 'tenant',
    'x-platform-origin': ALFA,
    'x-platform-tenant-slug': 'alfa',
  },
  none: {},
} as const

/** Origens explícitas que nenhum consumidor legítimo envia numa leitura do NextAuth, por host. */
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
  ['none', 'tenant origin without an edge', { Origin: ALFA }],
] as const

/** GET do NextAuth sem consumidor de outra origem (ações de `core/index.js` e uma ação de versão futura). */
const PRIVATE_READS = [
  'session',
  'csrf',
  'providers',
  'signin',
  'signin/facebook',
  'signout',
  'verify-request',
  'endpoint-of-a-future-version',
]
/** Navegações de topo vindas de outro site por desenho: a recusa por Origin não vale nelas. */
const NAVIGATIONS = ['callback/facebook', 'callback/google', 'error']
/** Caminhos que imitam uma navegação mas não são uma: continuam sob a regra. */
const LOOKALIKES = [
  'callback/',
  'callback/facebook/extra',
  'callback/face.book',
  'callback/facebook%2F..%2F..%2Fsession',
  'error/',
  'errorx',
  'session/',
]

const HOSTS = [['service', serviceRoute]] as const

/**
 * A rota do NextAuth no App Router lê cookies e cabeçalhos com `require('next/headers')`, fora do alcance de
 * `vi.mock` (pacote externo em CommonJS): o dublê entra no cache do `require` do próprio next-auth.
 */
const fromNextAuth = createRequire(
  createRequire(import.meta.url).resolve('next-auth/next')
)
const nextHeadersPath = fromNextAuth.resolve('next/headers')
const cachedNextHeaders = fromNextAuth.cache[nextHeadersPath]
beforeAll(() => {
  fromNextAuth.cache[nextHeadersPath] = {
    id: nextHeadersPath,
    filename: nextHeadersPath,
    loaded: true,
    exports: {
      cookies: async () => ({
        getAll: () =>
          [...mocks.cookies].map(([name, value]) => ({ name, value })),
      }),
      headers: async () => new Headers(mocks.headers),
    },
  } as unknown as NodeJS.Module
})
afterAll(() => {
  if (cachedNextHeaders) fromNextAuth.cache[nextHeadersPath] = cachedNextHeaders
  else delete fromNextAuth.cache[nextHeadersPath]
})

/** Sessão real do NextAuth: JWT assinado com a versão da credencial que o callback `jwt` relê no banco. */
async function signedSession(): Promise<string> {
  const credentialVersion = createHmac('sha256', NEXTAUTH_SECRET)
    .update(`legacy-session-credential:v1\0${USER.id}\0${USER.password}`)
    .digest('base64url')
    .slice(0, 22)
  return encode({
    secret: NEXTAUTH_SECRET,
    token: {
      sub: USER.id,
      id: USER.id,
      role: 'ADMIN',
      email: 'owner@example.test',
      name: 'Owner Fixture',
      credentialVersion,
    },
  })
}

type Route = typeof legacyRoute
/** Chama a rota exportada como o App Router chama: `NextRequest` e o catch-all em `params`. */
async function call(
  route: Route,
  action: string,
  headers: Record<string, string>,
  init: { method?: string; body?: string } = {}
): Promise<Response> {
  mocks.headers = new Headers(headers)
  return route.GET(
    new NextRequest(`${BACKEND}/api/auth/${action}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    }),
    {
      params: Promise.resolve({
        nextauth: action.split('/').filter(Boolean),
      }),
    }
  )
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', EDGE_SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  mocks.findUnique.mockResolvedValue(USER)
  mocks.cookies.clear()
  // NEXTAUTH_URL em https: o NextAuth usa o nome de cookie seguro.
  mocks.cookies.set('__Secure-next-auth.session-token', await signedSession())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(HOSTS)('%s [...nextauth] reads', (_host, route) => {
  const refused = async (response: Response) => {
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(DENIAL)
    expect(response.headers.get('cache-control')).toBe('no-store')
    // O motor responderia com o cookie do token CSRF; a recusa vem antes dele.
    expect(response.headers.get('set-cookie')).toBeNull()
  }
  /** O NextAuth atendeu: todo GET dele grava o cookie do token CSRF de um cliente novo. */
  const reachedEngine = (response: Response) => {
    expect(response.status).not.toBe(403)
    expect(response.headers.get('set-cookie')).toMatch(/next-auth\.csrf-token=/)
  }

  it.each(
    PRIVATE_READS.flatMap((action) =>
      FOREIGN.map(
        ([edge, label, origin]) => [action, label, edge, origin] as const
      )
    )
  )(
    'refuses %s with %s before the engine and the session storage (GET and HEAD)',
    async (action, _label, edge, origin) => {
      for (const method of ['GET', 'HEAD'])
        await refused(
          await call(route, action, { ...edges[edge], ...origin }, { method })
        )
      expect(mocks.findUnique).not.toHaveBeenCalled()
    }
  )

  it.each(LOOKALIKES)(
    'keeps a navigation lookalike under the rule: %s',
    async (action) => {
      await refused(await call(route, action, { ...edges.alfa, Origin: BRAVO }))
      expect(mocks.findUnique).not.toHaveBeenCalled()
    }
  )

  it('keeps the session for the real consumers: no Origin (same-origin fetch, native app) or the own origin', async () => {
    for (const [edge, origin] of [
      ['alfa', {}],
      ['alfa', { 'Sec-Fetch-Site': 'cross-site' }],
      ['alfa', { Origin: ALFA, 'Sec-Fetch-Site': 'same-origin' }],
      ['app', { Origin: APP, 'Sec-Fetch-Site': 'same-origin' }],
      ['none', {}],
    ] as const) {
      const response = await call(route, 'session', {
        ...edges[edge],
        ...origin,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        user: { id: USER.id, email: 'owner@example.test', role: 'ADMIN' },
      })
    }
    // Cada leitura relê a credencial no banco: o motor atendeu as cinco.
    expect(mocks.findUnique).toHaveBeenCalledTimes(5)
  })

  it('keeps the CSRF token and the provider list for the own host (login of next-auth/react)', async () => {
    const csrf = await call(route, 'csrf', {
      ...edges.app,
      Origin: APP,
      'Sec-Fetch-Site': 'same-origin',
    })
    expect(csrf.status).toBe(200)
    expect(await csrf.json()).toEqual({ csrfToken: expect.any(String) })
    const providers = await call(route, 'providers', { ...edges.alfa })
    expect(providers.status).toBe(200)
    expect(Object.keys(await providers.json())).toEqual(
      expect.arrayContaining(['credentials'])
    )
  })

  it.each(NAVIGATIONS)(
    'leaves the cross-site navigation %s to the engine, whatever the Origin',
    async (action) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      for (const origin of [BRAVO, APP, 'null'])
        reachedEngine(
          await call(route, action, {
            ...edges.alfa,
            Origin: origin,
            'Sec-Fetch-Site': 'cross-site',
          })
        )
      expect(mocks.findUnique).not.toHaveBeenCalled()
    }
  )

  // POST em navegação e fora dela: a recusa de leitura não vale em mutação, nem num caminho que ela recusaria em GET.
  it.each([
    ['callback/credentials', '/signin'],
    ['signin/facebook', '/signin'],
    ['signout', '/signout'],
  ])(
    'leaves the POST %s to the engine own defence (NextAuth double-submit token)',
    async (action, page) => {
      const response = await call(
        route,
        action,
        {
          ...edges.alfa,
          Origin: BRAVO,
          'Sec-Fetch-Site': 'same-site',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        {
          method: 'POST',
          body: new URLSearchParams({
            email: 'owner@example.test',
            password: 'fixture-password',
            csrfToken: 'forged-token',
            json: 'true',
          }).toString(),
        }
      )
      // Sem o cookie do token duplo, o NextAuth devolve a página do fluxo com `csrf=true`; nunca o 403 de leitura.
      expect(response.status).toBe(200)
      const { url } = (await response.json()) as { url: string }
      expect(new URL(url).pathname).toBe(`/api/auth${page}`)
      expect(new URL(url).searchParams.get('csrf')).toBe('true')
      expect(mocks.findUnique).not.toHaveBeenCalled()
    }
  )

  it('leaves the POST session update to the engine own defence', async () => {
    const response = await call(
      route,
      'session',
      {
        ...edges.alfa,
        Origin: BRAVO,
        'Sec-Fetch-Site': 'same-site',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      {
        method: 'POST',
        body: new URLSearchParams({ csrfToken: 'forged-token' }).toString(),
      }
    )
    // Token duplo ausente: o NextAuth recusa a atualização com o 400 dele, sem ler a credencial.
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain(DENIAL.error)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('applies the rule while Better Auth runs beside it (better-auth-v2: NextAuth stays on /api/auth)', async () => {
    vi.stubEnv('AUTH_V2_ENABLED', 'true')
    await refused(
      await call(route, 'session', {
        ...edges.app,
        Origin: ALFA,
        'Sec-Fetch-Site': 'same-site',
      })
    )
    expect(mocks.findUnique).not.toHaveBeenCalled()
    const own = await call(route, 'session', { ...edges.app })
    expect(own.status).toBe(200)
    expect(await own.json()).toMatchObject({ user: { id: USER.id } })
  })
})
