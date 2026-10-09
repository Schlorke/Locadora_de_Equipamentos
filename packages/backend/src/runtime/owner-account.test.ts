import type { PrismaClient } from '@prisma/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  options: vi.fn(),
  captcha: vi.fn(),
  password: vi.fn(),
}))
vi.mock('./onboarding-options', () => ({
  readConfiguredOnboardingOptions: mocks.options,
}))
vi.mock('./onboarding-captcha', () => ({
  verifyOnboardingCaptcha: mocks.captcha,
}))
vi.mock('./owner-password', () => ({ verifyOwnerPassword: mocks.password }))
import { createOwnerAccountRuntime } from './owner-account'
const env = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'example.invalid',
  PLATFORM_EDGE_SECRET: 's'.repeat(32),
  PLATFORM_SELF_SERVICE_SIGNUP: 'on',
  AUTH_MODE: 'better-auth',
  PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
  PLATFORM_SECRETS_KMS_KEY_ARN: 'synthetic-key',
  AWS_ROLE_ARN: 'synthetic-role',
  AWS_WEB_IDENTITY_TOKEN_FILE: 'synthetic-file',
  PLATFORM_CAPTCHA_SECRET_KEY: 'synthetic-secret',
  PLATFORM_CAPTCHA_SITE_KEY: 'synthetic-public',
}
const input = {
  name: 'Ana',
  email: 'owner@example.test',
  password: 'long-fixture-password',
}
const account = { id: 'owner', email: input.email, authEmailVerified: false }
const find = vi.fn()
const ports = {
  database: () => ({ user: { findUnique: find } }) as unknown as PrismaClient,
  accounts: { registerOwnerAccount: vi.fn(), resendOwnerVerification: vi.fn() },
  refuseAuthAttempt: vi.fn(),
  consumeAccountNotice: vi.fn(),
  environment: () => env,
}
const runtime = createOwnerAccountRuntime(ports)
function request(method = 'POST', body: unknown = input) {
  return new Request('https://backend.invalid/api/auth/owner-register', {
    method,
    headers: {
      'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.example.invalid',
      Origin: 'https://app.example.invalid',
      'Content-Type': 'application/json',
      'X-Platform-Captcha': 'synthetic-captcha',
      'x-platform-client-ip': '192.0.2.5',
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  env.PLATFORM_SELF_SERVICE_SIGNUP = 'on'
  env.AUTH_MODE = 'better-auth'
  ports.refuseAuthAttempt.mockResolvedValue(null)
  ports.consumeAccountNotice.mockResolvedValue(true)
  find.mockResolvedValue(account)
  vi.stubEnv('PLATFORM_ENV', env.PLATFORM_ENV)
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', env.PLATFORM_ROOT_DOMAIN)
  vi.stubEnv('PLATFORM_EDGE_SECRET', env.PLATFORM_EDGE_SECRET)
})
afterEach(() => vi.unstubAllEnvs())
it('composes existing budgets, bounded captcha/password verification and the single credential engine', async () => {
  const req = request()
  expect((await runtime.register(req)).status).toBe(202)
  expect(mocks.options).toHaveBeenCalledExactlyOnceWith(env)
  expect(ports.refuseAuthAttempt).toHaveBeenCalledExactlyOnceWith(
    'register',
    { headers: req.headers, account: input.email },
    expect.any(String)
  )
  expect(mocks.captcha).toHaveBeenCalledExactlyOnceWith({
    secret: 'synthetic-secret',
    token: 'synthetic-captcha',
    hostname: 'app.example.invalid',
    ip: '192.0.2.5',
    key: 'owner-account-registration',
    userId: input.email,
  })
  expect(mocks.password).toHaveBeenCalledExactlyOnceWith(input.password)
  expect(ports.accounts.registerOwnerAccount).toHaveBeenCalledExactlyOnceWith(
    input,
    req
  )
  expect(mocks.captcha.mock.invocationCallOrder[0]!).toBeLessThan(
    mocks.password.mock.invocationCallOrder[0]!
  )
  expect(find).not.toHaveBeenCalled()
})
it.each(['off', 'legacy'])(
  'refuses %s before publication, provider or database activity',
  async (mode) => {
    if (mode === 'off') env.PLATFORM_SELF_SERVICE_SIGNUP = 'off'
    else env.AUTH_MODE = 'legacy'
    expect([403, 503]).toContain((await runtime.register(request())).status)
    expect(mocks.options).not.toHaveBeenCalled()
    expect(mocks.captcha).not.toHaveBeenCalled()
    expect(mocks.password).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  }
)
it('does not proceed if the approved publication is unavailable', async () => {
  mocks.options.mockRejectedValue(new Error('private file path'))
  expect((await runtime.register(request())).status).toBe(503)
  expect(ports.refuseAuthAttempt).not.toHaveBeenCalled()
  expect(ports.accounts.registerOwnerAccount).not.toHaveBeenCalled()
})
it('loads the authoritative verification field by the authenticated id only', async () => {
  expect(await (await runtime.read(request('GET'), 'owner')).json()).toEqual({
    userId: 'owner',
    emailVerified: false,
  })
  expect(find).toHaveBeenCalledExactlyOnceWith({
    where: { id: 'owner' },
    select: { id: true, email: true, authEmailVerified: true },
  })
})
it('uses the minute budget and the existing daily verification budget before sending', async () => {
  const req = request('POST', {})
  expect((await runtime.resend(req, 'owner')).status).toBe(202)
  expect(ports.consumeAccountNotice.mock.calls).toEqual([
    ['owner-verification-resend', input.email],
    ['verification-resend-day', input.email],
  ])
  expect(
    ports.accounts.resendOwnerVerification
  ).toHaveBeenCalledExactlyOnceWith(input.email, req)
})
it('does not consume the daily budget or send when the minute budget is exhausted', async () => {
  ports.consumeAccountNotice.mockResolvedValue(false)
  expect((await runtime.resend(request('POST', {}), 'owner')).status).toBe(202)
  expect(ports.consumeAccountNotice).toHaveBeenCalledTimes(1)
  expect(ports.accounts.resendOwnerVerification).not.toHaveBeenCalled()
})
