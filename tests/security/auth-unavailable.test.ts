/**
 * Limitador ou configuração que não deixam contar a tentativa (achado 7 da
 * revisão da onda 4 e decisão de alinhamento da onda 5):
 *
 * - o `authorize` do NextAuth chamava o limitador fora de qualquer `try`: a
 *   falha virava `?error=<mensagem>` (Prisma/pg com host e usuário do banco,
 *   ou a configuração do PLATFORM_RATE_LIMIT_SECRET) para um navegador não
 *   autenticado. Agora recusa com o código fixo `AuthUnavailable`, e a causa
 *   vai só para um log estruturado, sem mensagem;
 * - quem não consegue contar responde 503 com `Retry-After`, nunca 429 (429 é
 *   só limite atingido) nem 401 de senha errada: login legado (rota do
 *   NextAuth com `withSignInAvailability`) e login do Better Auth (limitador
 *   do próprio motor sem banco);
 * - `reset-password` e `forgot-password` não dependem do limitador para
 *   responder, e a falha dele ao limpar janelas ou ler o orçamento de avisos
 *   vai para o log estruturado, sem a mensagem.
 *
 * Os fluxos `register` e `forgot-password` com o limitador fora ficam em
 * `account-flows-guard.test.ts`; o login v2 (coexistência), em
 * `tests/identity/legacy-credentials.integration.test.ts`.
 *
 * Sem banco: `platform_rate_limits` é o dublê em memória e o Prisma é um
 * dublê que registra o que cada rota leu e gravou.
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
  process.env.NEXTAUTH_SECRET = 'fixture-nextauth-secret-auth-unavailable'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  return {
    send: vi.fn(),
    userFindMany: vi.fn(),
    userFindUnique: vi.fn(),
    tokenFind: vi.fn(),
    transaction: vi.fn(),
    authRateLimitFindMany: vi.fn(),
    cookies: new Map<string, string>(),
    ip: '192.0.2.40',
  }
})

// O módulo `@/lib/prisma` que a fábrica abaixo monta: o serviço lê o mesmo cliente (real ou simulado) pelo runtime.
const legacyPrisma = vi.hoisted(() => ({
  module: undefined as undefined | { prisma: unknown },
}))
vi.mock(
  '@/lib/prisma',
  async () =>
    (legacyPrisma.module = (await (async () => {
      const { createPlatformRateLimitTable } =
        await import('../helpers/platform-rate-limit-table')
      const table = createPlatformRateLimitTable()
      return {
        rateLimitTable: table,
        prisma: {
          platformRateLimit: table.platformRateLimit,
          user: {
            findMany: mocks.userFindMany,
            findUnique: mocks.userFindUnique,
          },
          verificationToken: { findUnique: mocks.tokenFind },
          // O adaptador do Better Auth procura o modelo pelo nome configurado.
          AuthRateLimit: { findMany: mocks.authRateLimitFindMany },
          $transaction: mocks.transaction,
        },
      }
    })()) as { prisma: unknown })
)
vi.mock('@/lib/resend', () => ({
  default: () => ({ emails: { send: mocks.send } }),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Fora de uma requisição do Next: as rotas executam a tarefa na hora.
  after: () => {
    throw new Error('`after` outside a request scope')
  },
}))
vi.mock('bcryptjs', async (importOriginal) => {
  const actual = (
    (await importOriginal()) as { default: typeof import('bcryptjs') }
  ).default
  return {
    default: { ...actual, hash: (value: string) => actual.hash(value, 4) },
  }
})

import NextAuth from 'next-auth'
import type { CredentialsConfig } from 'next-auth/providers/credentials'
import * as applicationPrisma from '@/lib/prisma'
import { authOptions, withSignInAvailability } from '@/lib/auth'
import { SIGN_IN_UNAVAILABLE } from '../../packages/backend/src/modules/identity/legacy-auth'
import { handleIdentityRequest } from '@/lib/identity'

// Public NextAuth callback URL code, independent of the implementation constant.
const SIGN_IN_RATE_LIMITED = 'RateLimited'
import type { createPlatformRateLimitTable } from '../helpers/platform-rate-limit-table'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: legacyPrisma.module?.prisma }),
  ...(await (async () => {
    const F = await (() => ({
      default: () => ({ emails: { send: mocks.send } }),
    }))()
    return { createResendClient: () => F.default() }
  })()),
}))
import * as legacyRoute0 from '@/app/api/auth/forgot-password/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/forgot-password/route'
import * as legacyRoute1 from '@/app/api/auth/reset-password/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/reset-password/route'

const HOSTS = [
  [
    'legacy root',
    {
      forgotPassword: legacyRoute0.POST,
      resetPassword: legacyRoute1.POST,
    },
  ],
  [
    'service',
    {
      forgotPassword: serviceRoute0.POST,
      resetPassword: serviceRoute1.POST,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { forgotPassword, resetPassword }) => {
  const { rateLimitTable } = applicationPrisma as unknown as {
    rateLimitTable: ReturnType<typeof createPlatformRateLimitTable>
  }

  const NEXTAUTH_SECRET = 'fixture-nextauth-secret-auth-unavailable'
  const DB_PASSWORD = 'db-password-fixture'
  const CONNECTION = `postgres://app:${DB_PASSWORD}@10.0.0.7:5432/plataforma`
  const SHORT_SECRET = 'curto-demais-fixture'
  let sequence = 0
  const unique = () => `indisponivel-${Date.now()}-${++sequence}@example.test`

  /** Erro do Prisma com o que a mensagem real pode repetir: e-mail e connection string. */
  const databaseDown = (email: string) =>
    Object.assign(
      new Error(`Invalid upsert for ${email}: can't reach ${CONNECTION}`),
      { name: 'PrismaClientInitializationError', code: 'P1001' }
    )

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.cookies.clear()
    vi.stubEnv('AUTH_MODE', 'legacy')
    vi.stubEnv('AUTH_V2_ENABLED', '')
    vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', '')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PLATFORM_ENV', 'staging')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'k'.repeat(40))
    vi.stubEnv('FROM_EMAIL', 'identidade@example.test')
    mocks.send.mockResolvedValue({ data: { id: 'email' }, error: null })
    mocks.userFindMany.mockResolvedValue([])
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function authorize(email: string) {
    const provider = authOptions.providers.find(
      (candidate) => candidate.id === 'credentials'
    ) as CredentialsConfig & { options: CredentialsConfig }
    return provider.options
      .authorize(
        { email, password: 'fixture-password' },
        {
          headers: { 'x-forwarded-for': '192.0.2.10' },
          body: {},
          query: {},
          method: 'POST',
        }
      )
      .then(
        (user) => (user ? 'user' : 'rejected'),
        (error: Error) => error.message
      )
  }

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
          new Headers({ host: 'localhost:3000', 'x-forwarded-for': mocks.ip }),
      },
    } as unknown as NodeJS.Module
  })
  afterAll(() => {
    if (cachedNextHeaders)
      fromNextAuth.cache[nextHeadersPath] = cachedNextHeaders
    else delete fromNextAuth.cache[nextHeadersPath]
  })

  /** POST /api/auth/callback/credentials pela rota do NextAuth (App Router), como o cliente do NextAuth envia. */
  async function credentialsCallback(email: string) {
    const token = 'fixture-csrf-token'
    const hash = createHash('sha256')
      .update(`${token}${NEXTAUTH_SECRET}`)
      .digest('hex')
    mocks.cookies.set('next-auth.csrf-token', `${token}|${hash}`)
    const route = withSignInAvailability(NextAuth(authOptions))
    return route(
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

  describe('login legado (NextAuth) sem poder contar a tentativa', () => {
    it('banco fora: recusa com o código fixo; a mensagem do Prisma nunca chega ao cliente, só nome e código no log', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const email = unique()
      vi.spyOn(rateLimitTable.platformRateLimit, 'upsert').mockRejectedValue(
        databaseDown(email)
      )
      const outcome = await authorize(email)
      expect(outcome).toBe(SIGN_IN_UNAVAILABLE)
      expect(outcome).not.toContain(DB_PASSWORD)
      expect(mocks.userFindMany).not.toHaveBeenCalled()
      const events = error.mock.calls.filter(([tag]) => tag === '[auth]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toEqual({
        event: 'sign_in_unavailable',
        error: 'PrismaClientInitializationError',
        code: 'P1001',
      })
      const logged = JSON.stringify(error.mock.calls)
      for (const secret of [email, DB_PASSWORD, '10.0.0.7'])
        expect(logged).not.toContain(secret)
    })

    it('sem PLATFORM_RATE_LIMIT_SECRET em produção: a rota responde 503 com Retry-After e error=AuthUnavailable, nunca 429 nem a configuração', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      vi.stubEnv('PLATFORM_ENV', 'production')
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', SHORT_SECRET)
      const response = await credentialsCallback(unique())
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('60')
      expect(response.headers.get('cache-control')).toBe('no-store')
      const { url } = (await response.json()) as { url: string }
      expect(new URL(url).searchParams.get('error')).toBe(SIGN_IN_UNAVAILABLE)
      expect(url).not.toMatch(/PLATFORM_RATE_LIMIT_SECRET/)
      expect(mocks.userFindMany).not.toHaveBeenCalled()
      const events = error.mock.calls.filter(([tag]) => tag === '[auth]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toMatchObject({
        event: 'sign_in_unavailable',
        error: 'PlatformEnvError',
        detail: expect.stringMatching(/PLATFORM_RATE_LIMIT_SECRET/),
      })
      expect(JSON.stringify(error.mock.calls)).not.toContain(SHORT_SECRET)
    })

    it('banco fora só na busca da conta (tentativa já contada): 503 com Retry-After e AuthUnavailable, nunca 401 de senha errada', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const email = unique()
      mocks.userFindMany.mockRejectedValue(databaseDown(email))
      const response = await credentialsCallback(email)
      expect(mocks.userFindMany).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('60')
      expect(response.headers.get('cache-control')).toBe('no-store')
      const { url } = (await response.json()) as { url: string }
      expect(new URL(url).searchParams.get('error')).toBe(SIGN_IN_UNAVAILABLE)
      // A causa só no log, pelo nome.
      const logged = JSON.stringify(error.mock.calls)
      expect(logged).toContain('PrismaClientInitializationError')
      for (const secret of [email, DB_PASSWORD, '10.0.0.7'])
        expect(logged).not.toContain(secret)
    })

    it('controle: limite atingido e senha errada seguem 401 pela mesma rota (o 503 é só para quem não conta)', async () => {
      const email = unique()
      const statuses: Array<[number, string | null]> = []
      for (let attempt = 0; attempt < 6; attempt++) {
        const response = await credentialsCallback(email)
        const { url } = (await response.json()) as { url: string }
        statuses.push([response.status, new URL(url).searchParams.get('error')])
      }
      expect(statuses).toEqual([
        ...Array(5).fill([401, 'CredentialsSignin']),
        [401, SIGN_IN_RATE_LIMITED],
      ])
    })
  })

  describe('login do Better Auth sem poder contar a tentativa', () => {
    it('limitador do motor sem banco: 503 neutro com Retry-After e no-store, causa só no log', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const app = 'https://app.plataforma.example'
      for (const [key, value] of Object.entries({
        AUTH_MODE: 'better-auth',
        BETTER_AUTH_URL: app,
        BETTER_AUTH_SECRET: 's'.repeat(40),
        BETTER_AUTH_TRUSTED_ORIGINS: '',
        AUTH_TRUSTED_ORIGINS: '',
        PLATFORM_ENV: 'production',
        PLATFORM_ROOT_DOMAIN: 'plataforma.example',
        PLATFORM_EDGE_SECRET: 'fixture-edge-secret-with-more-than-32-chars',
        WEB_API_ORIGIN: 'https://backend.example',
      }))
        vi.stubEnv(key, value)
      const email = unique()
      mocks.authRateLimitFindMany.mockRejectedValue(databaseDown(email))
      const response = await handleIdentityRequest(
        new Request(`${app}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: app,
            'x-forwarded-for': '192.0.2.20',
          },
          body: JSON.stringify({ email, password: 'fixture-password' }),
        })
      )
      expect(mocks.authRateLimitFindMany).toHaveBeenCalled()
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('60')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({
        error: 'Authentication unavailable',
      })
      const events = error.mock.calls.filter(([tag]) => tag === '[identity]')
      expect(events).toHaveLength(1)
      expect(JSON.stringify(events)).not.toContain(DB_PASSWORD)
    })
  })

  describe('reset-password e forgot-password não dependem do limitador para responder', () => {
    it('reset-password: janelas que não podem ser limpas não mudam a resposta; o log leva só nome e código', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const email = unique()
      const identifier = `password-reset:${email}`
      mocks.tokenFind.mockResolvedValue({
        identifier,
        token: 'hash',
        expires: new Date(Date.now() + 60_000),
      })
      mocks.userFindUnique.mockResolvedValue({ id: 'user-reset', email })
      mocks.transaction.mockImplementation(
        async (operation: (_tx: unknown) => Promise<unknown>) =>
          operation({
            verificationToken: {
              deleteMany: async () => ({ count: 1 }),
            },
            user: { update: async () => ({}) },
            authSession: { deleteMany: async () => ({ count: 0 }) },
          })
      )
      vi.spyOn(
        rateLimitTable.platformRateLimit,
        'deleteMany'
      ).mockRejectedValue(databaseDown(email))
      const response = await resetPassword(
        new NextRequest('http://localhost:3000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: 'fixture-token',
            password: 'nova-senha',
          }),
        })
      )
      expect(response.status).toBe(200)
      const events = error.mock.calls.filter(([tag]) => tag === '[rate-limit]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toEqual({
        event: 'auth_windows_not_cleared',
        scope: 'sign-in',
        error: 'PrismaClientInitializationError',
        code: 'P1001',
      })
      const logged = JSON.stringify(error.mock.calls)
      for (const secret of [email, DB_PASSWORD])
        expect(logged).not.toContain(secret)
    })

    it('forgot-password: orçamento de avisos ilegível pula o e-mail, mantém a resposta neutra e loga só nome e código', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const email = unique()
      mocks.userFindMany.mockResolvedValue([
        {
          id: 'user-notice',
          email,
          name: 'Fixture',
          role: 'CLIENT',
          image: null,
          password: 'hash',
          emailVerified: null,
        },
      ])
      const upsert = rateLimitTable.platformRateLimit.upsert.bind(
        rateLimitTable.platformRateLimit
      )
      vi.spyOn(rateLimitTable.platformRateLimit, 'upsert').mockImplementation(
        async (args) => {
          if (args.where.key.startsWith('notice:')) throw databaseDown(email)
          return upsert(args)
        }
      )
      const response = await forgotPassword(
        new NextRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '192.0.2.30',
          },
          body: JSON.stringify({ email }),
        })
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        message: 'Se o email existir, você receberá instruções de recuperação.',
      })
      expect(mocks.send).not.toHaveBeenCalled()
      const events = error.mock.calls.filter(([tag]) => tag === '[rate-limit]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toEqual({
        event: 'account_notice_skipped',
        kind: 'password-reset',
        error: 'PrismaClientInitializationError',
        code: 'P1001',
      })
      const logged = JSON.stringify(error.mock.calls)
      for (const secret of [email, DB_PASSWORD])
        expect(logged).not.toContain(secret)
    })
  })
})
