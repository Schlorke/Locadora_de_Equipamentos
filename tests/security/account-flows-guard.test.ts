/**
 * Fluxos anônimos de conta liberados no host de locadora
 * (`/api/auth/register`, `forgot-password`, `reset-password`), nos dois modos
 * de identidade (lote de endurecimento da onda 4):
 *
 * - o mesmo guard de mesma origem das mutações com cookie: um script de
 *   `bravo.<raiz>` não cadastra, não dispara e-mail de recuperação e não troca
 *   senha pelo host `alfa` (CSRF de login, abuso de e-mail);
 * - o ramo better-auth de `register` e `forgot-password` chamava `auth.api.*`
 *   direto, sem o limitador (a chamada direta escapa do rate limit do Better
 *   Auth): agora passa pelo mesmo `consumeAuthAttempt` do ramo legacy;
 * - janela gasta responde 429; o limitador que não consegue contar (sem
 *   PLATFORM_RATE_LIMIT_SECRET em produção, banco fora) responde 503 com
 *   Retry-After, nunca 429 nem 500 (decisão de alinhamento da onda 5), com a
 *   causa num log estruturado sem e-mail, IP nem segredo;
 * - no modo better-auth o cadastro responde o mesmo 202 neutro do legado
 *   (achado 5 da revisão da onda 4).
 *
 * Sem banco: `platform_rate_limits` é o dublê em memória; o motor de
 * identidade e o Prisma são dublês que registram cada efeito.
 */
import { NextRequest } from 'next/server'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  beforeAll,
} from 'vitest'

const { state, record } = vi.hoisted(() => {
  const state = { effects: [] as string[] }
  const record =
    <T>(name: string, value: T) =>
    async () => {
      state.effects.push(name)
      return value
    }
  return { state, record }
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
            findMany: record('prisma.user.findMany', []),
            findUnique: record('prisma.user.findUnique', null),
          },
          verificationToken: {
            findUnique: record('prisma.verificationToken.findUnique', null),
          },
          $transaction: record('prisma.$transaction', { email: 'x' }),
        },
      }
    })()) as { prisma: unknown })
)
vi.mock('@/lib/resend', () => ({ default: () => null }))
vi.mock('@/lib/identity', async () => {
  const config =
    await import('../../packages/backend/src/modules/identity/configuration')
  const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  const api = {
    signUpEmail: async () => {
      state.effects.push('auth.api.signUpEmail')
      return ok()
    },
    requestPasswordReset: async () => {
      state.effects.push('auth.api.requestPasswordReset')
      return ok()
    },
    resetPassword: async () => {
      state.effects.push('auth.api.resetPassword')
      return ok()
    },
  }
  return {
    ...config,
    getIdentity: async () => ({ api }),
    handleIdentityRequest: async () => {
      state.effects.push('auth.handler')
      return ok()
    },
  }
})
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

import * as applicationPrisma from '@/lib/prisma'
import type { createPlatformRateLimitTable } from '../helpers/platform-rate-limit-table'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: legacyPrisma.module?.prisma }),
  ...(await (async () => {
    const F = await (() => ({ default: () => null }))()
    return { createResendClient: () => F.default() }
  })()),
}))
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/identity')>()),
  ...(await (async () => {
    const F = await (async () => {
      const config =
        await import('../../packages/backend/src/modules/identity/configuration')
      const ok = () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      const api = {
        signUpEmail: async () => {
          state.effects.push('auth.api.signUpEmail')
          return ok()
        },
        requestPasswordReset: async () => {
          state.effects.push('auth.api.requestPasswordReset')
          return ok()
        },
        resetPassword: async () => {
          state.effects.push('auth.api.resetPassword')
          return ok()
        },
      }
      return {
        ...config,
        getIdentity: async () => ({ api }),
        handleIdentityRequest: async () => {
          state.effects.push('auth.handler')
          return ok()
        },
      }
    })()
    return {
      createIdentityRuntime: () => ({
        getIdentity: F.getIdentity,
        handleIdentityRequest: F.handleIdentityRequest,
      }),
    }
  })()),
}))
import * as legacyRoute0 from '@/app/api/auth/register/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/register/route'
import * as legacyRoute1 from '@/app/api/auth/forgot-password/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/forgot-password/route'
import * as legacyRoute2 from '@/app/api/auth/reset-password/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/auth/reset-password/route'

const HOSTS = [
  [
    'legacy root',
    {
      register: legacyRoute0.POST,
      forgotPassword: legacyRoute1.POST,
      resetPassword: legacyRoute2.POST,
    },
  ],
  [
    'service',
    {
      register: serviceRoute0.POST,
      forgotPassword: serviceRoute1.POST,
      resetPassword: serviceRoute2.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { register, forgotPassword, resetPassword }) => {
    // Cada host começa com as janelas de limite vazias, como numa execução própria (a tabela em memória é uma só).
    beforeAll(() =>
      (
        legacyPrisma.module as unknown as {
          rateLimitTable?: { rows: Map<string, unknown> }
        }
      )?.rateLimitTable?.rows.clear()
    )
    const { rateLimitTable } = applicationPrisma as unknown as {
      rateLimitTable: ReturnType<typeof createPlatformRateLimitTable>
    }

    const SECRET = 'edge-secret-account-flows-0123456789ab'
    const ROOT = 'plataforma.test'
    const API = 'https://backend.internal'
    const originOf = (slug: string) => `https://${slug}.${ROOT}`
    const tenantEdge = (slug: string) => ({
      'x-platform-edge-auth': SECRET,
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': slug,
      'x-platform-origin': originOf(slug),
      'x-platform-client-ip': '198.51.100.40',
    })
    type Flow = 'register' | 'forgot-password' | 'reset-password'
    type Headers = Record<string, string>

    let sequence = 0
    const unique = () => `conta-${Date.now()}-${++sequence}@example.test`
    const bodyOf = (flow: Flow, email = unique()) =>
      flow === 'register'
        ? {
            name: 'Fixture',
            email,
            password: 'fixture-password',
            phone: '41999990000',
            cpf: '00000000000',
          }
        : flow === 'forgot-password'
          ? { email }
          : { token: 'fixture-token', password: 'fixture-password' }
    const handlers = {
      register,
      'forgot-password': forgotPassword,
      'reset-password': resetPassword,
    } satisfies Record<Flow, (_request: NextRequest) => Promise<Response>>
    const FLOWS = Object.keys(handlers) as Flow[]

    function call(flow: Flow, headers: Headers, body: unknown = bodyOf(flow)) {
      state.effects.length = 0
      return handlers[flow](
        new NextRequest(`${API}/api/auth/${flow}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        })
      )
    }

    beforeEach(() => {
      vi.stubEnv('PLATFORM_ENV', 'staging')
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
      vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
      vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'k'.repeat(40))
      vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
      vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', '')
      vi.stubEnv('AUTH_V2_ENABLED', '')
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    describe.each(['legacy', 'better-auth'])(
      'anonymous account flows (%s) refuse a sibling tenant origin',
      (mode) => {
        beforeEach(() => vi.stubEnv('AUTH_MODE', mode))

        it.each(FLOWS)(
          '%s: a script on bravo cannot act through alfa, before any count, lookup or engine call',
          async (flow) => {
            for (const headers of [
              {
                ...tenantEdge('alfa'),
                origin: originOf('bravo'),
                'sec-fetch-site': 'same-site',
                'content-type': 'text/plain;charset=UTF-8',
              },
              { ...tenantEdge('alfa'), origin: originOf('bravo') },
              { ...tenantEdge('alfa'), 'sec-fetch-site': 'same-site' },
              { ...tenantEdge('alfa'), origin: `https://app.${ROOT}` },
            ]) {
              const rows = rateLimitTable.rows.size
              const response = await call(flow, headers)
              expect(response.status).toBe(403)
              expect(response.headers.get('cache-control')).toBe('no-store')
              expect(await response.json()).toEqual({
                error: 'Origem não permitida',
              })
              expect(state.effects).toEqual([])
              expect(rateLimitTable.rows.size).toBe(rows)
            }
          }
        )

        it.each(FLOWS)(
          '%s: the same request from the host origin still runs (positive control)',
          async (flow) => {
            const response = await call(flow, {
              ...tenantEdge('alfa'),
              origin: originOf('alfa'),
              'sec-fetch-site': 'same-origin',
            })
            expect([403, 429, 500]).not.toContain(response.status)
            expect(state.effects.length).toBeGreaterThan(0)
          }
        )

        it.each(FLOWS)(
          '%s: a native client without edge nor browser headers still runs',
          async (flow) => {
            const response = await call(flow, {
              'x-forwarded-for': `192.0.2.${(sequence % 200) + 1}`,
            })
            expect([403, 429, 500]).not.toContain(response.status)
            expect(state.effects.length).toBeGreaterThan(0)
          }
        )
      }
    )

    const sameOrigin = (ip: string) => ({
      ...tenantEdge('alfa'),
      'x-platform-client-ip': ip,
      origin: originOf('alfa'),
    })

    describe('better-auth branch goes through the same attempt windows as legacy', () => {
      beforeEach(() => vi.stubEnv('AUTH_MODE', 'better-auth'))

      it('register: 5 per target e-mail (the same neutral 202 as legacy); the sixth answers 429 without calling auth.api.signUpEmail', async () => {
        const email = unique()
        const calls: string[] = []
        for (let attempt = 1; attempt <= 6; attempt++) {
          const response = await call(
            'register',
            sameOrigin(`198.51.100.${attempt}`),
            bodyOf('register', email)
          )
          calls.push(`${response.status}:${state.effects.join(',')}`)
        }
        expect(calls.slice(0, 5)).toEqual(
          Array(5).fill('202:auth.api.signUpEmail')
        )
        expect(calls[5]).toBe('429:')
      })

      it('forgot-password: 3 per (account, IP); the fourth answers 429 without calling auth.api.requestPasswordReset', async () => {
        const email = unique()
        const statuses: number[] = []
        const engine: number[] = []
        for (let attempt = 1; attempt <= 4; attempt++) {
          const response = await call(
            'forgot-password',
            sameOrigin('198.51.100.77'),
            bodyOf('forgot-password', email)
          )
          statuses.push(response.status)
          engine.push(
            state.effects.filter(
              (name) => name === 'auth.api.requestPasswordReset'
            ).length
          )
          if (response.status === 429) {
            expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(
              0
            )
            expect(await response.json()).toEqual({
              error: 'Muitas solicitações. Tente novamente mais tarde.',
            })
          }
        }
        expect(statuses).toEqual([200, 200, 200, 429])
        expect(engine).toEqual([1, 1, 1, 0])
      })

      it('logs a refused attempt as one structured event without the e-mail or the IP', async () => {
        const warn = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => undefined)
        const email = unique()
        for (let attempt = 1; attempt <= 4; attempt++)
          await call(
            'forgot-password',
            sameOrigin('198.51.100.91'),
            bodyOf('forgot-password', email)
          )
        const events = warn.mock.calls.filter(
          ([tag]) => tag === '[auth-rate-limit]'
        )
        expect(events).toHaveLength(1)
        expect(events[0]![1]).toMatchObject({
          event: 'auth_attempt_refused',
          scope: 'password-reset',
          cause: 'rate-limited',
        })
        const logged = JSON.stringify(events)
        expect(logged).not.toContain(email)
        expect(logged).not.toContain('198.51.100.91')
      })
    })

    describe.each(['legacy', 'better-auth'])(
      'a limiter that cannot count answers 503 with Retry-After, never 429 nor 500 (%s)',
      (mode) => {
        beforeEach(() => {
          vi.stubEnv('AUTH_MODE', mode)
          // Produção da plataforma sem PLATFORM_RATE_LIMIT_SECRET: o limitador recusa.
          vi.stubEnv('PLATFORM_ENV', 'production')
          vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'curto-demais')
        })

        it.each(['register', 'forgot-password'] as const)(
          '%s: 503 with Retry-After, no lookup nor engine call, cause logged without secrets',
          async (flow) => {
            const error = vi
              .spyOn(console, 'error')
              .mockImplementation(() => undefined)
            const email = unique()
            const rows = rateLimitTable.rows.size
            const response = await call(
              flow,
              sameOrigin('198.51.100.120'),
              bodyOf(flow, email)
            )
            expect(response.status).toBe(503)
            expect(response.headers.get('retry-after')).toBe('60')
            expect(response.headers.get('cache-control')).toBe('no-store')
            expect(state.effects).toEqual([])
            expect(rateLimitTable.rows.size).toBe(rows)
            const events = error.mock.calls.filter(
              ([tag]) => tag === '[auth-rate-limit]'
            )
            expect(events).toHaveLength(1)
            expect(events[0]![1]).toMatchObject({
              event: 'auth_attempt_refused',
              scope: flow === 'register' ? 'register' : 'password-reset',
              cause: 'limiter-unavailable',
              error: 'PlatformEnvError',
              detail: expect.stringMatching(/PLATFORM_RATE_LIMIT_SECRET/),
            })
            const logged = JSON.stringify(error.mock.calls)
            for (const secret of [
              email,
              '198.51.100.120',
              'curto-demais',
              SECRET,
            ])
              expect(logged).not.toContain(secret)
          }
        )

        it.each(['register', 'forgot-password'] as const)(
          '%s: a storage failure also answers 503; the log keeps the error name and code, never its message',
          async (flow) => {
            vi.stubEnv('PLATFORM_ENV', 'staging')
            vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'k'.repeat(40))
            const error = vi
              .spyOn(console, 'error')
              .mockImplementation(() => undefined)
            const email = unique()
            // Mensagens do Prisma podem repetir argumentos da consulta.
            vi.spyOn(
              rateLimitTable.platformRateLimit,
              'upsert'
            ).mockRejectedValueOnce(
              Object.assign(
                new Error(
                  `Invalid upsert for ${email} at postgres://app:db-password-fixture@db`
                ),
                { name: 'PrismaClientKnownRequestError', code: 'P1001' }
              )
            )
            const response = await call(
              flow,
              sameOrigin('198.51.100.121'),
              bodyOf(flow, email)
            )
            expect(response.status).toBe(503)
            expect(response.headers.get('retry-after')).toBe('60')
            expect(state.effects).toEqual([])
            const events = error.mock.calls.filter(
              ([tag]) => tag === '[auth-rate-limit]'
            )
            expect(events).toHaveLength(1)
            expect(events[0]![1]).toEqual({
              event: 'auth_attempt_refused',
              scope: flow === 'register' ? 'register' : 'password-reset',
              cause: 'limiter-unavailable',
              error: 'PrismaClientKnownRequestError',
              code: 'P1001',
            })
            const logged = JSON.stringify(error.mock.calls)
            for (const secret of [
              email,
              'db-password-fixture',
              '198.51.100.121',
            ])
              expect(logged).not.toContain(secret)
          }
        )
      }
    )
  }
)
