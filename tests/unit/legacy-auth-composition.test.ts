import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextAuthOptions } from 'next-auth'

const database = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))
/**
 * A importação fria de @/lib/auth (next-auth, provedores e o barril de identidade do backend) levou 15 s com só este
 * arquivo e outro na fila, e passou do prazo de 10 s dos hooks sob a carga do test:unit, refeita a cada caso depois de
 * vi.resetModules (onda 131). Ela roda uma vez, na coleta do arquivo, que não corre sob prazo de caso nem de hook; o
 * ambiente da composição é aplicado antes dela e reaplicado a cada caso (onda 132, achado 145).
 */
const fixture = vi.hoisted(() => {
  const applyEnv = () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'fixture-options-secret')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture-google-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture-google-secret')
    vi.stubEnv('FACEBOOK_CLIENT_ID', 'fixture-facebook-id')
    vi.stubEnv('FACEBOOK_CLIENT_SECRET', 'fixture-facebook-secret')
  }
  applyEnv()
  // Avaliações de @/lib/auth: a fábrica do limitador simulado roda a cada uma.
  return { applyEnv, compositions: 0 }
})
vi.mock('@/lib/prisma', () => ({ prisma: database }))
vi.mock('@/lib/rate-limit', () => {
  fixture.compositions += 1
  return {
    legacySignInGuard: vi.fn(),
    limiterFailureFields: vi.fn(),
  }
})

// Contraparte da API compartilhada (onda 135, B5): a mesma composição do NextAuth no leitor do serviço
// (`apps/services/api/src/host/session.ts`), sobre o mesmo dublê de banco pelo runtime do backend.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: database }),
}))

import { authOptions } from '@/lib/auth'
import { authOptions as serviceAuthOptions } from '../../apps/services/api/src/host/session'

const options: NextAuthOptions = authOptions
// Lidos antes do clearMocks do primeiro caso: a composição não consulta o banco e acontece só na coleta.
const queriesWhileComposing =
  database.user.findMany.mock.calls.length +
  database.user.findUnique.mock.calls.length
const compositionsWhileCollecting = fixture.compositions

beforeEach(() => {
  vi.resetAllMocks()
  fixture.applyEnv()
})
afterAll(() => vi.unstubAllEnvs())

describe('legacy authentication composition before host extraction', () => {
  it('composes the options once, while collecting the file, outside every case and hook deadline', () => {
    expect(compositionsWhileCollecting).toBe(1)
    expect(fixture.compositions).toBe(1)
  })
})

describe.each([
  ['legacy root', options],
  ['service', serviceAuthOptions],
] as const)('%s authentication composition', (_host, options) => {
  it('keeps providers, JWT lifetime, login page and the existing secret snapshot', () => {
    expect(options.providers.map(({ id }) => id)).toEqual([
      'google',
      'facebook',
      'credentials',
    ])
    expect(options.providers[0]).toMatchObject({
      options: {
        clientId: 'fixture-google-id',
        clientSecret: 'fixture-google-secret',
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
      },
    })
    expect(options.providers[1]).toMatchObject({
      options: {
        clientId: 'fixture-facebook-id',
        clientSecret: 'fixture-facebook-secret',
      },
    })
    expect(options.session).toEqual({ strategy: 'jwt', maxAge: 86400 })
    expect(options.pages).toEqual({ signIn: '/login' })
    expect(options.secret).toBe('fixture-options-secret')
    expect(options.debug).toBe(false)
    vi.stubEnv('NEXTAUTH_SECRET', 'fixture-secret-changed-after-composition')
    expect(options.secret).toBe('fixture-options-secret')
    expect(queriesWhileComposing).toBe(0)
    expect(database.user.findMany).not.toHaveBeenCalled()
    expect(database.user.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['/admin', 'https://app.example.test/admin'],
    [
      'https://app.example.test/admin?x=1',
      'https://app.example.test/admin?x=1',
    ],
    ['https://bravo.example.test/admin', 'https://app.example.test'],
    ['//evil.example.test/admin', 'https://app.example.test'],
    ['https://app.example.test.evil.test', 'https://app.example.test'],
    ['javascript:alert(1)', 'https://app.example.test'],
    ['http://[invalid', 'https://app.example.test'],
  ])('redirect %s stays within the current host', async (url, expected) => {
    expect(
      await options.callbacks!.redirect!({
        url,
        baseUrl: 'https://app.example.test',
      })
    ).toBe(expected)
  })

  it('continues to project the revalidated token into the existing session contract', async () => {
    const session = {
      expires: '2030-01-01',
      user: { id: 'old', role: 'ADMIN' as const },
    }
    expect(
      await options.callbacks!.session!({
        session,
        token: { id: 'member', role: 'CLIENT' },
      } as Parameters<
        NonNullable<NonNullable<NextAuthOptions['callbacks']>['session']>
      >[0])
    ).toEqual({
      expires: '2030-01-01',
      user: { id: 'member', role: 'CLIENT' },
    })
  })

  it('storage unavailable keeps an empty session payload instead of authenticating the old token', async () => {
    expect(
      await options.callbacks!.session!({
        session: { expires: '2030-01-01', user: { id: 'old', role: 'ADMIN' } },
        token: { id: 'old', role: 'ADMIN', credentialCheck: 'unavailable' },
      } as Parameters<
        NonNullable<NonNullable<NextAuthOptions['callbacks']>['session']>
      >[0])
    ).toEqual({})
  })
})
