/**
 * Achado 104 da revisão adversarial: a ROTA real do NextAuth
 * (`app/api/auth/[...nextauth]/route.ts`), não um wrapper montado no teste.
 *
 * - Um login legado que não pôde ser contado nem conferido (limitador,
 *   configuração ou banco fora) responde 503 com `Retry-After` e `no-store`
 *   (`withSignInAvailability`), como os outros fluxos de identidade; o NextAuth
 *   sozinho responderia 401 `error=AuthUnavailable`, igual a senha errada;
 * - a rota declara `dynamic = 'force-dynamic'` e `revalidate = 0`.
 *
 * Sem banco: `platform_rate_limits` é o dublê em memória e o Prisma é um dublê
 * que registra as buscas de conta.
 */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
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
  // lib/auth e o NextAuth leem estes valores quando os módulos são avaliados.
  process.env.NEXTAUTH_SECRET = 'fixture-nextauth-secret-nextauth-route'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  return {
    userFindMany: vi.fn(),
    cookies: new Map<string, string>(),
  }
})

vi.mock('@/lib/prisma', async () => {
  const { createPlatformRateLimitTable } =
    await import('../helpers/platform-rate-limit-table')
  const table = createPlatformRateLimitTable()
  return {
    prisma: {
      platformRateLimit: table.platformRateLimit,
      user: { findMany: mocks.userFindMany, findUnique: vi.fn() },
    },
  }
})

// Contraparte da API compartilhada (onda 135, B5): a rota real do NextAuth do serviço
// (`apps/services/api/src/app/api/auth/[...nextauth]/route.ts`), com o mesmo dublê de banco pelo runtime do backend e
// janelas de limite próprias (como numa execução à parte). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const { createPlatformRateLimitTable } =
    await import('../helpers/platform-rate-limit-table')
  const table = createPlatformRateLimitTable()
  const prisma = {
    platformRateLimit: table.platformRateLimit,
    user: { findMany: mocks.userFindMany, findUnique: vi.fn() },
  }
  return {
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma }),
  }
})
import * as legacyNextAuthRoute from '@/app/api/auth/[...nextauth]/route'
import * as serviceNextAuthRoute from '../../apps/services/api/src/app/api/auth/[...nextauth]/route'
import { SIGN_IN_UNAVAILABLE } from '../../packages/backend/src/modules/identity/legacy-auth'

// Public NextAuth callback URL code, independent of the implementation constant.
const SIGN_IN_RATE_LIMITED = 'RateLimited'

const NEXTAUTH_SECRET = 'fixture-nextauth-secret-nextauth-route'
let sequence = 0
const unique = () => `rota-nextauth-${Date.now()}-${++sequence}@example.test`

beforeEach(() => {
  vi.resetAllMocks()
  mocks.cookies.clear()
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PLATFORM_ENV', 'staging')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'k'.repeat(40))
  mocks.userFindMany.mockResolvedValue([])
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/**
 * A rota do NextAuth no App Router lê cookies e cabeçalhos com
 * `require('next/headers')`, fora do alcance de `vi.mock` (pacote externo em
 * CommonJS): o dublê entra no cache do `require` do próprio next-auth.
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
      headers: async () =>
        new Headers({
          host: 'localhost:3000',
          'x-forwarded-for': '192.0.2.70',
        }),
    },
  } as unknown as NodeJS.Module
})
afterAll(() => {
  if (cachedNextHeaders) fromNextAuth.cache[nextHeadersPath] = cachedNextHeaders
  else delete fromNextAuth.cache[nextHeadersPath]
})

describe.each([
  ['legacy root', legacyNextAuthRoute],
  ['service', serviceNextAuthRoute],
] as const)('%s', (_host, nextAuthRoute) => {
  /** POST /api/auth/callback/credentials pela rota exportada, como o cliente do NextAuth envia. */
  async function credentialsCallback(email: string) {
    const token = 'fixture-csrf-token'
    const hash = createHash('sha256')
      .update(`${token}${NEXTAUTH_SECRET}`)
      .digest('hex')
    mocks.cookies.set('next-auth.csrf-token', `${token}|${hash}`)
    return nextAuthRoute.POST(
      new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email,
          password: 'fixture-password',
          csrfToken: token,
          callbackUrl: 'http://localhost:3000/',
          json: 'true',
        }).toString(),
      }),
      { params: Promise.resolve({ nextauth: ['callback', 'credentials'] }) }
    )
  }

  const errorOf = async (response: Response) =>
    new URL(((await response.json()) as { url: string }).url).searchParams.get(
      'error'
    )

  describe('rota [...nextauth] (login legado)', () => {
    it('declara force-dynamic, revalidate 0 e runtime nodejs', () => {
      expect(nextAuthRoute.dynamic).toBe('force-dynamic')
      expect(nextAuthRoute.revalidate).toBe(0)
      expect(nextAuthRoute.runtime).toBe('nodejs')
      expect(nextAuthRoute.GET).toBe(nextAuthRoute.POST)
    })

    it('limitador que não conta (sem PLATFORM_RATE_LIMIT_SECRET em produção): 503 com Retry-After e no-store, error=AuthUnavailable', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.stubEnv('PLATFORM_ENV', 'production')
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'curto-demais-fixture')
      const response = await credentialsCallback(unique())
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('60')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await errorOf(response)).toBe(SIGN_IN_UNAVAILABLE)
      expect(mocks.userFindMany).not.toHaveBeenCalled()
    })

    it('controle: senha errada e limite atingido seguem 401 pela mesma rota', async () => {
      const email = unique()
      const outcomes: Array<[number, string | null]> = []
      for (let attempt = 0; attempt < 6; attempt++) {
        const response = await credentialsCallback(email)
        outcomes.push([response.status, await errorOf(response)])
      }
      expect(outcomes).toEqual([
        ...Array(5).fill([401, 'CredentialsSignin']),
        [401, SIGN_IN_RATE_LIMITED],
      ])
    })
  })
})
