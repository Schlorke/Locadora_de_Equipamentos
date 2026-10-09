import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextAuthOptions } from 'next-auth'

const mocks = vi.hoisted(() => ({
  legacy: vi.fn(),
  identity: vi.fn(),
  session: vi.fn(),
  headers: vi.fn(),
  defaults: { providers: [] },
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.legacy }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/lib/auth', () => ({ authOptions: mocks.defaults }))
vi.mock('@/lib/identity', async () => ({
  ...(await import('../../packages/backend/src/modules/identity/configuration')),
  getIdentity: mocks.identity,
}))

// Contraparte da API compartilhada (onda 135, E27a): a mesma política sobre o leitor composto do serviço
// (`apps/services/api/src/host/session.ts`). Só a fábrica do motor novo vira dublê; o leitor de corte
// (`createApplicationSessionReader`) e a projeção da sessão são os reais do host.
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/identity')>()),
  createIdentityRuntime: () => ({
    getIdentity: mocks.identity,
    handleIdentityRequest: async () => new Response(null, { status: 500 }),
  }),
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => {
    throw new Error('the session reader must not open the database')
  },
  createResendClient: () => null,
}))

import { getServerSession as legacyRootSession } from '@/lib/application-session'
import {
  authOptions as serviceDefaults,
  getServerSession as serviceSession,
} from '../../apps/services/api/src/host/session'

const incoming = new Headers({
  cookie: 'fixture-cookie',
  host: 'app.example.test',
})
const legacy = { expires: '2030-01-01', user: { id: 'legacy-user' } }
const databaseSession = () => ({
  session: { id: 'private-session-id', expiresAt: new Date('2030-01-01') },
  user: {
    id: 'database-user',
    email: 'fixture@example.test',
    name: 'Fixture',
    image: null,
    role: 'OPERATOR',
    password: 'must-not-be-projected',
  },
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  mocks.headers.mockResolvedValue(incoming)
  mocks.legacy.mockResolvedValue(legacy)
  mocks.identity.mockResolvedValue({ api: { getSession: mocks.session } })
  mocks.session.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe.each([
  ['legacy root', legacyRootSession, () => mocks.defaults],
  ['service', serviceSession, () => serviceDefaults],
] as const)(
  '%s application session compatibility',
  (_host, getServerSession, defaults) => {
    it.each(['legacy', 'better-auth'])(
      'mode %s preserves verified createdAt when the cookie is renewed',
      async (mode) => {
        vi.stubEnv('AUTH_MODE', mode)
        vi.stubEnv('AUTH_V2_ENABLED', 'true')
        const createdAt = new Date('2026-10-04T15:40:00Z')
        mocks.session.mockResolvedValue({
          ...databaseSession(),
          session: {
            createdAt,
            updatedAt: new Date('2026-10-04T16:00:00Z'),
            expiresAt: new Date('2030-01-01'),
          },
        })
        expect(await getServerSession()).toMatchObject({
          authenticatedAt: createdAt.getTime(),
        })
      }
    )
    it.each([undefined, '2026-10-04T16:00:00Z', new Date(NaN)])(
      'does not invent authentication time for invalid createdAt %s',
      async (createdAt) => {
        vi.stubEnv('AUTH_MODE', 'better-auth')
        mocks.session.mockResolvedValue({
          ...databaseSession(),
          session: { createdAt, expiresAt: new Date('2030-01-01') },
        })
        expect(await getServerSession()).not.toHaveProperty('authenticatedAt')
      }
    )
    it('disabled coexistence reads only NextAuth with the existing default options', async () => {
      expect(await getServerSession()).toBe(legacy)
      expect(mocks.legacy).toHaveBeenCalledExactlyOnceWith(defaults())
      expect(mocks.identity).not.toHaveBeenCalled()
      expect(mocks.headers).not.toHaveBeenCalled()
    })

    it('forwards custom options unchanged only to NextAuth', async () => {
      const options: NextAuthOptions = {
        providers: [],
        session: { maxAge: 123 },
      }
      expect(await getServerSession(options)).toBe(legacy)
      expect(mocks.legacy).toHaveBeenCalledExactlyOnceWith(options)
    })

    it.each(['legacy', 'better-auth'])(
      '%s projects only the existing session fields and passes the original request headers',
      async (mode) => {
        vi.stubEnv('AUTH_MODE', mode)
        vi.stubEnv('AUTH_V2_ENABLED', 'true')
        mocks.session.mockResolvedValue(databaseSession())
        expect(await getServerSession({ providers: [] })).toEqual({
          expires: '2030-01-01T00:00:00.000Z',
          user: {
            id: 'database-user',
            email: 'fixture@example.test',
            name: 'Fixture',
            image: null,
            role: 'OPERATOR',
          },
        })
        expect(mocks.session).toHaveBeenCalledExactlyOnceWith({
          headers: incoming,
        })
        expect(mocks.legacy).not.toHaveBeenCalled()
      }
    )

    it.each(['absent', 'engine', 'storage', 'headers', 'projection'])(
      'coexistence falls back on %s identity and preserves custom NextAuth options',
      async (failure) => {
        vi.stubEnv('AUTH_V2_ENABLED', 'true')
        identityFailure(failure)
        const options: NextAuthOptions = {
          providers: [],
          session: { maxAge: 321 },
        }
        expect(await getServerSession(options)).toBe(legacy)
        expect(mocks.legacy).toHaveBeenCalledExactlyOnceWith(options)
      }
    )

    it.each(['absent', 'engine', 'storage', 'headers', 'projection'])(
      'after cutover %s identity never revives a legacy JWT',
      async (failure) => {
        vi.stubEnv('AUTH_MODE', 'better-auth')
        identityFailure(failure)
        expect(await getServerSession()).toBeNull()
        expect(mocks.legacy).not.toHaveBeenCalled()
      }
    )

    it('reads the mode again on every request instead of caching a fallback policy', async () => {
      vi.stubEnv('AUTH_V2_ENABLED', 'true')
      expect(await getServerSession()).toBe(legacy)
      vi.stubEnv('AUTH_MODE', 'better-auth')
      expect(await getServerSession()).toBeNull()
      expect(mocks.legacy).toHaveBeenCalledTimes(1)
    })

    it('invalid mode rejects before reading either engine or request headers', async () => {
      vi.stubEnv('AUTH_MODE', 'invalid-mode')
      await expect(getServerSession()).rejects.toThrow('Invalid AUTH_MODE')
      expect(mocks.identity).not.toHaveBeenCalled()
      expect(mocks.legacy).not.toHaveBeenCalled()
      expect(mocks.headers).not.toHaveBeenCalled()
    })

    it('propagates a legacy reader failure as before', async () => {
      const failure = new Error('fixture NextAuth failure')
      mocks.legacy.mockRejectedValue(failure)
      await expect(getServerSession()).rejects.toBe(failure)
    })

    it('returns an absent NextAuth session unchanged', async () => {
      mocks.legacy.mockResolvedValue(null)
      expect(await getServerSession()).toBeNull()
    })
  }
)

function identityFailure(failure: string) {
  const error = new Error('fixture identity failure')
  if (failure === 'engine') mocks.identity.mockRejectedValue(error)
  if (failure === 'storage') mocks.session.mockRejectedValue(error)
  if (failure === 'headers') mocks.headers.mockRejectedValue(error)
  if (failure === 'projection')
    mocks.session.mockResolvedValue({
      ...databaseSession(),
      session: { expiresAt: new Date('invalid date') },
    })
}
