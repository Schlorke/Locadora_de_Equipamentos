import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLATFORM } from '@gb-locacoes/contracts/platform'

const state = vi.hoisted(() => ({
  database: {},
  storageFailure: null as Error | null,
  readDatabase: vi.fn(),
  create: vi.fn(),
  handler: vi.fn(),
  send: vi.fn(),
  mailAvailable: true,
  resend: vi.fn(),
  guard: {},
  guardFactory: vi.fn(),
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
// Contraparte na API compartilhada (onda 135, B5): `host/session.ts` compõe o mesmo runtime de identidade com o banco
// de getDatabaseRuntime(), o cliente Resend do backend e os limitadores do backend (só o guarda e o orçamento de reenvio
// viram dublês, o resto dos limitadores é o real).
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => {
    state.readDatabase()
    if (state.storageFailure) throw state.storageFailure
    return { prisma: state.database }
  },
  createResendClient: () =>
    state.mailAvailable ? { emails: { send: state.send } } : null,
}))
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/identity')>()
  return {
    ...actual,
    createIdentityLimiters: (
      dependencies: Parameters<typeof actual.createIdentityLimiters>[0]
    ) => ({
      ...actual.createIdentityLimiters(dependencies),
      legacySignInGuard: state.guardFactory,
      consumeVerificationResend: state.resend,
    }),
  }
})

type IdentityHost = {
  getIdentity(): Promise<unknown>
  handleIdentityRequest(_request: Request): Promise<Response>
}
const HOSTS: ReadonlyArray<[string, () => Promise<IdentityHost>]> = [
  ['service', () => import('../../apps/services/api/src/host/session')],
]

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  state.storageFailure = null
  state.mailAvailable = true
  state.create.mockReturnValue({ api: {}, handler: state.handler })
  state.guardFactory.mockReturnValue(state.guard)
  state.send.mockResolvedValue({ error: null })
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_V2_ENABLED', 'true')
  vi.stubEnv('PLATFORM_ENV', 'development')
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  vi.stubEnv(
    'BETTER_AUTH_SECRET',
    'fixture-identity-runtime-secret-more-than-32'
  )
  vi.stubEnv('AUTH_TRUSTED_ORIGINS', '')
  vi.stubEnv('FROM_EMAIL', 'no-reply@example.test')
})
afterEach(() => vi.unstubAllEnvs())

describe.each(HOSTS)('identity runtime compatibility (%s)', (_host, load) => {
  it('loads storage lazily, shares the engine and injects the real attempt guard', async () => {
    const { getIdentity } = await load()
    expect(state.readDatabase).not.toHaveBeenCalled()
    const first = await getIdentity()
    expect(await getIdentity()).toBe(first)
    expect(state.create).toHaveBeenCalledTimes(1)
    expect(state.create.mock.calls[0]![0]).toBe(state.database)
    expect(state.create.mock.calls[0]![1]).toMatchObject({
      basePath: '/api/auth/v2',
    })
    expect(state.create.mock.calls[0]![3]).toBe(state.guard)
    expect(state.readDatabase).toHaveBeenCalledTimes(1)
    expect(state.guardFactory).toHaveBeenCalledTimes(1)
  })

  it('checks the enable flag even after creating an engine', async () => {
    const { getIdentity } = await load()
    await getIdentity()
    vi.stubEnv('AUTH_V2_ENABLED', '')
    await expect(getIdentity()).rejects.toThrow('Identity v2 is disabled')
    expect(state.create).toHaveBeenCalledTimes(1)
  })

  it('disabled handler returns the existing 503 without storage or engine calls', async () => {
    vi.stubEnv('AUTH_V2_ENABLED', '')
    const { handleIdentityRequest } = await load()
    const response = await handleIdentityRequest(
      new Request('http://localhost:3000/api/auth/v2/get-session')
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Identity v2 unavailable' })
    expect(state.readDatabase).not.toHaveBeenCalled()
    expect(state.create).not.toHaveBeenCalled()
  })

  it('retries a failed lazy dependency load on the next request', async () => {
    const { getIdentity } = await load()
    state.storageFailure = new Error('fixture storage failure')
    await expect(getIdentity()).rejects.toBe(state.storageFailure)
    state.storageFailure = null
    await expect(getIdentity()).resolves.toMatchObject({
      handler: state.handler,
    })
    expect(state.readDatabase).toHaveBeenCalledTimes(2)
  })

  it('sends platform-branded reset/verification mail and preserves the resend budget', async () => {
    const { getIdentity } = await load()
    await getIdentity()
    const mail = state.create.mock.calls[0]![2]
    for (const [method, label] of [
      ['sendPasswordReset', 'Recuperação de senha'],
      ['sendEmailVerification', 'Verifique seu email'],
    ]) {
      await mail[method!]({
        email: 'fixture@example.test',
        url: 'https://app.example.test/fixture-link',
      })
      const subject = `${label} - ${PLATFORM.displayName}`
      expect(state.send).toHaveBeenLastCalledWith({
        from: 'no-reply@example.test',
        to: 'fixture@example.test',
        subject,
        text: `${subject}\n\nhttps://app.example.test/fixture-link`,
      })
    }
    state.resend.mockResolvedValue(false)
    expect(await mail.verificationResendAllowed('fixture@example.test')).toBe(
      false
    )
    expect(state.resend).toHaveBeenCalledExactlyOnceWith('fixture@example.test')
  })

  it.each(['missing-provider', 'missing-from', 'provider-error'])(
    '%s refuses mail delivery instead of reporting success',
    async (failure) => {
      const { getIdentity } = await load()
      await getIdentity()
      if (failure === 'missing-provider') state.mailAvailable = false
      if (failure === 'missing-from') vi.stubEnv('FROM_EMAIL', '')
      if (failure === 'provider-error')
        state.send.mockResolvedValue({
          error: { message: 'fixture provider error' },
        })
      const mail = state.create.mock.calls[0]![2]
      await expect(
        mail.sendPasswordReset({
          email: 'fixture@example.test',
          url: 'https://app.example.test/fixture-link',
        })
      ).rejects.toThrow(
        failure === 'provider-error'
          ? 'Identity email delivery failed'
          : 'Identity email delivery is unavailable'
      )
    }
  )
})
