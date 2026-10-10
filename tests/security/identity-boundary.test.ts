const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return {
    prisma: {
      user: { findUnique: mocks.userFind, update: mocks.userUpdate },
      verificationToken: { findUnique: mocks.tokenFind },
      $transaction: mocks.transaction,
    },
  }
}
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  identityConfiguration,
  identityEnabled,
  identityMode,
} from '../../packages/backend/src/modules/identity/configuration'
import { inspectIdentityMigration } from '../../packages/backend/src/modules/identity/preflight'

const mocks = vi.hoisted(() => ({
  getLegacySession: vi.fn(),
  getToken: vi.fn(),
  getSession: vi.fn(),
  getIdentity: vi.fn(),
  reset: vi.fn(),
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  tokenFind: vi.fn(),
  transaction: vi.fn(),
  findAccountsByEmail: vi.fn(),
  handleIdentityRequest: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.getLegacySession }))
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

// Contraparte da API compartilhada (onda 135, E27a): o leitor de sessão e o reset de senha do serviço, sobre os mesmos
// dublês do motor novo e do banco. O "proxy ignora o JWT" não tem contraparte no proxy do serviço (ele só repassa,
// `apps/services/api/src/proxy.ts`): o portão do painel mora no host web (`apps/clients/web/src/host/auth/client.test.ts`).
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/identity')>()),
  createIdentityRuntime: () => ({
    getIdentity: mocks.getIdentity,
    handleIdentityRequest: mocks.handleIdentityRequest,
  }),
}))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({
      prisma: {
        user: { findUnique: mocks.userFind, update: mocks.userUpdate },
        verificationToken: { findUnique: mocks.tokenFind },
        $transaction: mocks.transaction,
      },
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

import { getServerSession as serviceSession } from '../../apps/services/api/src/host/session'
import { POST as serviceResetPassword } from '../../apps/services/api/src/app/api/auth/reset-password/route'

const HOSTS = [['service', serviceSession, serviceResetPassword]] as const

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', '')
  mocks.getIdentity.mockResolvedValue({
    api: { getSession: mocks.getSession, resetPassword: mocks.reset },
  })
  mocks.handleIdentityRequest.mockImplementation(async (request: Request) => {
    const identity = await mocks.getIdentity()
    return identity.api.resetPassword(request)
  })
  mocks.getLegacySession.mockResolvedValue({ user: { id: 'legacy-user' } })
  mocks.getToken.mockResolvedValue({ sub: 'legacy-user' })
})
afterEach(() => vi.unstubAllEnvs())

describe.each(HOSTS)(
  '%s identity rollout boundary',
  (_host, getServerSession, resetPassword) => {
    it('keeps legacy authentication when v2 is disabled', async () => {
      expect((await getServerSession())?.user.id).toBe('legacy-user')
      expect(mocks.getIdentity).not.toHaveBeenCalled()
    })
    it.each([null, new Error('storage unavailable')])(
      'never revives legacy JWT after cutover',
      async (result) => {
        vi.stubEnv('AUTH_MODE', 'better-auth')
        if (result instanceof Error) mocks.getSession.mockRejectedValue(result)
        else mocks.getSession.mockResolvedValue(result)
        expect(await getServerSession()).toBeNull()
        expect(mocks.getLegacySession).not.toHaveBeenCalled()
      }
    )
    it('projects database session into the existing authorization contract', async () => {
      vi.stubEnv('AUTH_V2_ENABLED', 'true')
      mocks.getSession.mockResolvedValue({
        session: { expiresAt: new Date('2030-01-01') },
        user: {
          id: 'user-1',
          email: 'fixture@example.test',
          name: 'Fixture',
          role: 'OPERATOR',
          image: null,
        },
      })
      expect((await getServerSession())?.user).toMatchObject({
        id: 'user-1',
        role: 'OPERATOR',
      })
      expect(mocks.getLegacySession).not.toHaveBeenCalled()
    })
    it('reset wrapper delegates only to BetterAuth after cutover', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      mocks.reset.mockResolvedValue(Response.json({ status: true }))
      const response = await resetPassword(
        new NextRequest('http://localhost/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: 'fixture-token',
            password: 'fixture-password',
          }),
        })
      )
      expect(response.status).toBe(200)
      expect(mocks.reset).toHaveBeenCalledOnce()
      expect(mocks.tokenFind).not.toHaveBeenCalled()
      expect(mocks.userUpdate).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    })
    it('legacy reset cannot consume an email verification token', async () => {
      mocks.tokenFind.mockResolvedValue({
        identifier: 'email-verification:fixture@example.test',
        expires: new Date('2030-01-01'),
      })
      const response = await resetPassword(
        new NextRequest('http://localhost/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: 'fixture-token',
            password: 'fixture-password',
          }),
        })
      )
      expect(response.status).toBe(400)
      expect(mocks.userFind).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    })
    it('pauses credential mutations explicitly before backfill', async () => {
      vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', 'true')
      const response = await resetPassword(
        new NextRequest('http://localhost/api/auth/reset-password', {
          method: 'POST',
          body: '{}',
        })
      )
      expect(response.status).toBe(503)
      expect(mocks.getIdentity).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    })
  }
)

describe('rollout configuration and preflight', () => {
  const env = {
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'fixture-secret-at-least-thirty-two-characters',
  }
  it('disables v2 by default and uses a separate coexistence path', () => {
    expect(identityEnabled(env)).toBe(false)
    expect(
      identityConfiguration({ ...env, AUTH_V2_ENABLED: 'true' }).basePath
    ).toBe('/api/auth/v2')
    expect(
      identityConfiguration({ ...env, AUTH_MODE: 'better-auth' }).basePath
    ).toBe('/api/auth')
  })
  it('rejects invalid modes, weak secrets and noncanonical origins', () => {
    expect(() => identityMode({ AUTH_MODE: 'fallback' })).toThrow()
    expect(() =>
      identityConfiguration({ ...env, BETTER_AUTH_SECRET: 'short' })
    ).toThrow()
    expect(() =>
      identityConfiguration({
        ...env,
        BETTER_AUTH_URL: 'https://example.test/path',
      })
    ).toThrow()
    expect(() =>
      identityConfiguration({ ...env, AUTH_TRUSTED_ORIGINS: 'exp://**' })
    ).toThrow()
    expect(() =>
      identityConfiguration({ ...env, NODE_ENV: 'production' })
    ).toThrow()
  })
  it('detects email normalization collisions without revealing identities', () => {
    const result = inspectIdentityMigration([
      {
        id: '1',
        email: 'Fixture@Example.test',
        password: null,
        emailVerified: null,
      },
      {
        id: '2',
        email: 'fixture@example.test',
        password: null,
        emailVerified: null,
      },
    ])
    expect(result.canApply).toBe(false)
    expect(result.duplicateEmailGroups).toBe(1)
    expect(JSON.stringify(result)).not.toContain('example.test')
  })
  it('rejects unknown legacy password formats before writing', () => {
    const result = inspectIdentityMigration([
      {
        id: '1',
        email: 'fixture@example.test',
        password: 'unsupported',
        emailVerified: null,
      },
    ])
    expect(result.unsupportedPasswordHashes).toBe(1)
    expect(result.canApply).toBe(false)
  })
})
