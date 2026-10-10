const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return {
    get prisma() {
      if (state.failure) throw state.failure
      return {}
    },
  }
}
/**
 * `handleIdentityRequest` (lib/identity.ts) respondia 503 e engolia a causa:
 * sem log, uma configuração quebrada ou o banco fora do ar eram invisíveis.
 * Agora a causa vai para um log estruturado (nome e código do erro, método e
 * o primeiro segmento do endpoint), sem segredos, sem corpo e sem o resto do
 * caminho, e a resposta continua fechada e neutra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ failure: null as Error | null }))

// Contraparte da API compartilhada (onda 135, B5): o mesmo tratamento pelo leitor do serviço
// (`apps/services/api/src/host/session.ts`), com o banco do runtime do backend falhando do mesmo jeito.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => {
      if (state.failure) throw state.failure
      return { prisma: {} }
    },
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

import { handleIdentityRequest as serviceHandleIdentityRequest } from '../../apps/services/api/src/host/session'

const BODY_SECRET = 'senha-do-corpo-nao-pode-vazar'
const PATH_TOKEN = 'token-do-caminho-0123456789'
const QUERY_TOKEN = 'token-da-query-0123456789'
const identitySecret = 's'.repeat(40)

function request(path: string) {
  return new Request(`https://backend.internal${path}?token=${QUERY_TOKEN}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'plataforma.session_token=cookie-de-sessao-secreto',
    },
    body: JSON.stringify({ password: BODY_SECRET }),
  })
}

const secrets = [
  BODY_SECRET,
  PATH_TOKEN,
  QUERY_TOKEN,
  identitySecret,
  'cookie-de-sessao-secreto',
  'fixture@example.test',
  'db-password-fixture',
]

beforeEach(() => {
  state.failure = null
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', 'true')
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  vi.stubEnv('BETTER_AUTH_SECRET', identitySecret)
  vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each([['service', serviceHandleIdentityRequest]] as const)(
  '%s handleIdentityRequest failure log',
  (_host, handleIdentityRequest) => {
    it('an unreachable database: 503 neutral, cause logged by name and code only', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      state.failure = Object.assign(
        new Error(
          "Can't reach database server at postgres://app:db-password-fixture@db for fixture@example.test"
        ),
        { name: 'PrismaClientInitializationError', code: 'P1001' }
      )
      const response = await handleIdentityRequest(
        request(`/api/auth/v2/reset-password/${PATH_TOKEN}`)
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: 'Authentication unavailable',
      })
      const events = error.mock.calls.filter(([tag]) => tag === '[identity]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toEqual({
        event: 'identity_request_failed',
        method: 'POST',
        endpoint: 'reset-password',
        error: 'PrismaClientInitializationError',
        code: 'P1001',
      })
      const logged = JSON.stringify(error.mock.calls)
      for (const secret of secrets) expect(logged).not.toContain(secret)
    })

    it('an invalid configuration: 503 neutral, cause logged without the configured values', async () => {
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      vi.stubEnv('BETTER_AUTH_SECRET', 'curto')
      const response = await handleIdentityRequest(
        request('/api/auth/sign-in/email')
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: 'Authentication unavailable',
      })
      const events = error.mock.calls.filter(([tag]) => tag === '[identity]')
      expect(events).toHaveLength(1)
      expect(events[0]![1]).toEqual({
        event: 'identity_request_failed',
        method: 'POST',
        endpoint: 'sign-in',
        error: 'Error',
      })
      const logged = JSON.stringify(error.mock.calls)
      for (const secret of [...secrets, 'curto'])
        expect(logged).not.toContain(secret)
    })
  }
)
