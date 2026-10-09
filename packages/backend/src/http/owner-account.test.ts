import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOwnerAccountHandlers } from './owner-account'
import { OnboardingError } from '../modules/onboarding/index'
const env: Record<string, string | undefined> = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'example.invalid',
  PLATFORM_EDGE_SECRET: 's'.repeat(32),
}
const input = {
  name: 'Ana',
  email: 'owner@example.test',
  password: 'long-fixture-password',
}
const account = { id: 'owner', email: input.email, authEmailVerified: false }
const ports = {
  environment: () => env,
  checkSignup: vi.fn(),
  refuseAttempt: vi.fn(),
  verifyRegistration: vi.fn(),
  register: vi.fn(),
  read: vi.fn(),
  consumeResend: vi.fn(),
  resend: vi.fn(),
}
const handlers = createOwnerAccountHandlers(ports)
const hostileContexts: Record<string, string>[] = [
  { Origin: 'https://evil.invalid' },
  { Origin: 'https://bravo.example.invalid' },
  { Origin: 'null' },
  { 'x-platform-edge-auth': 'forged' },
  {
    'x-platform-host-kind': 'tenant',
    'x-platform-tenant-slug': 'alfa',
    'x-platform-origin': 'https://alfa.example.invalid',
  },
  { 'Sec-Fetch-Site': 'same-site' },
]
function request(
  method = 'POST',
  body: unknown = input,
  headers: Record<string, string> = {},
  query = ''
) {
  return new Request(
    'https://backend.invalid/api/auth/owner-register' + query,
    {
      method,
      headers: {
        'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET!,
        'x-platform-host-kind': 'app',
        'x-platform-origin': 'https://app.example.invalid',
        Origin: 'https://app.example.invalid',
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(method === 'GET' || method === 'HEAD'
        ? {}
        : { body: JSON.stringify(body) }),
    }
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  delete env.AUTH_CREDENTIAL_WRITES_PAUSED
  ports.refuseAttempt.mockResolvedValue(null)
  ports.read.mockResolvedValue(account)
  ports.consumeResend.mockResolvedValue(true)
})
describe('owner access HTTP', () => {
  it('counts and verifies before delegating the minimum account, always with a neutral receipt', async () => {
    const req = request()
    const response = await handlers.register(req)
    expect(response.status).toBe(202)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Host')
    expect(ports.refuseAttempt).toHaveBeenCalledExactlyOnceWith(
      req,
      input.email
    )
    expect(ports.verifyRegistration).toHaveBeenCalledExactlyOnceWith(
      input,
      req,
      'https://app.example.invalid'
    )
    expect(ports.register).toHaveBeenCalledExactlyOnceWith(input, req)
    expect(ports.read).not.toHaveBeenCalled()
    expect(ports.refuseAttempt.mock.invocationCallOrder[0]!).toBeLessThan(
      ports.verifyRegistration.mock.invocationCallOrder[0]!
    )
    expect(ports.verifyRegistration.mock.invocationCallOrder[0]!).toBeLessThan(
      ports.register.mock.invocationCallOrder[0]!
    )
    expect(await response.json()).toEqual({
      message: 'Pedido recebido. Confira seu e-mail para continuar.',
    })
  })
  it.each(hostileContexts)(
    'rejects a hostile context before every effect',
    async (headers) => {
      const response = await handlers.register(request('POST', input, headers))
      expect(response.status).toBe(403)
      expect(ports.checkSignup).not.toHaveBeenCalled()
      expect(ports.register).not.toHaveBeenCalled()
      expect(ports.verifyRegistration).not.toHaveBeenCalled()
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  )
  it.each(['off', 'maintenance'])(
    'rejects %s without registration or provider calls',
    async (mode) => {
      if (mode === 'off')
        ports.checkSignup.mockRejectedValue(
          new OnboardingError(403, 'SELF_SERVICE_SIGNUP_DISABLED')
        )
      else env.AUTH_CREDENTIAL_WRITES_PAUSED = 'true'
      const response = await handlers.register(request())
      expect([403, 503]).toContain(response.status)
      expect(ports.refuseAttempt).not.toHaveBeenCalled()
      expect(ports.verifyRegistration).not.toHaveBeenCalled()
      expect(ports.register).not.toHaveBeenCalled()
    }
  )
  it.each([
    { ...input, role: 'ADMIN' },
    { ...input, password: 'short' },
    { ...input, cpf: 'forged' },
    { ...input, phone: 'forged' },
  ])('refuses a non-minimum or invalid body', async (body) => {
    expect((await handlers.register(request('POST', body))).status).toBe(400)
    expect(ports.refuseAttempt).not.toHaveBeenCalled()
  })
  it('bounds request bytes and content type before counting or verification', async () => {
    expect(
      (await handlers.register(request('POST', { name: 'x'.repeat(17000) })))
        .status
    ).toBe(413)
    expect(
      (
        await handlers.register(
          request('POST', input, { 'Content-Type': 'text/plain' })
        )
      ).status
    ).toBe(415)
    expect(ports.refuseAttempt).not.toHaveBeenCalled()
  })
  it('preserves limiter status/retry headers while making early refusal private', async () => {
    ports.refuseAttempt.mockResolvedValue(
      Response.json(
        { error: 'limited' },
        { status: 429, headers: { 'Retry-After': '23' } }
      )
    )
    const response = await handlers.register(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('23')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(ports.verifyRegistration).not.toHaveBeenCalled()
    expect(ports.register).not.toHaveBeenCalled()
  })
  it.each([
    'CAPTCHA_INVALID',
    'PASSWORD_COMPROMISED',
    'PASSWORD_CHECK_UNAVAILABLE',
  ])('stops on %s before account effects', async (code) => {
    ports.verifyRegistration.mockRejectedValue(
      new OnboardingError(
        code === 'PASSWORD_COMPROMISED'
          ? 422
          : code === 'CAPTCHA_INVALID'
            ? 400
            : 503,
        code
      )
    )
    const response = await handlers.register(request())
    expect((await response.json()).code).toBe(code)
    expect(ports.register).not.toHaveBeenCalled()
  })
  it('reads only the authenticated user fact, without exposing the email', async () => {
    const response = await handlers.read(request('GET'), 'owner')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      userId: 'owner',
      emailVerified: false,
    })
    expect(ports.read).toHaveBeenCalledExactlyOnceWith('owner')
    ports.read.mockResolvedValue({ ...account, authEmailVerified: true })
    expect(await (await handlers.read(request('GET'), 'owner')).json()).toEqual(
      { userId: 'owner', emailVerified: true }
    )
  })
  it.each([null, { ...account, id: 'another-user' }])(
    'rejects a missing or mismatched account row',
    async (row) => {
      ports.read.mockResolvedValue(row)
      expect((await handlers.read(request('GET'), 'owner')).status).toBe(401)
      expect((await handlers.resend(request('POST', {}), 'owner')).status).toBe(
        401
      )
      expect(ports.consumeResend).not.toHaveBeenCalled()
    }
  )
  it('resends only to the email of the authenticated row with a silent persistent budget', async () => {
    const response = await handlers.resend(request('POST', {}), 'owner')
    expect(response.status).toBe(202)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(ports.consumeResend).toHaveBeenCalledExactlyOnceWith(account.email)
    expect(ports.resend.mock.calls[0]![0]).toBe(account.email)
    ports.resend.mockClear()
    ports.consumeResend.mockResolvedValue(false)
    expect(
      await (await handlers.resend(request('POST', {}), 'owner')).json()
    ).toEqual(await response.json())
    expect(ports.resend).not.toHaveBeenCalled()
  })
  it('never mails an already verified account or an email chosen by the caller', async () => {
    ports.read.mockResolvedValue({ ...account, authEmailVerified: true })
    expect((await handlers.resend(request('POST', {}), 'owner')).status).toBe(
      202
    )
    expect(ports.consumeResend).not.toHaveBeenCalled()
    expect(
      (
        await handlers.resend(
          request('POST', { email: 'victim@example.test' }),
          'owner'
        )
      ).status
    ).toBe(400)
    expect(ports.resend).not.toHaveBeenCalled()
  })
  it('rejects query/method variations and hides arbitrary failures', async () => {
    expect(
      (await handlers.register(request('POST', input, {}, '?tenantId=forged')))
        .status
    ).toBe(400)
    expect((await handlers.register(request('PUT'))).status).toBe(400)
    ports.read.mockRejectedValue(new Error('secret SQL account address'))
    const response = await handlers.read(request('GET'), 'owner')
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('secret SQL')
  })
})
