import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onboardingInput } from '../helpers/onboarding-data'
import {
  createOnboardingHttpHandlers,
  onboardingFailure,
} from '../../packages/backend/src/http/onboarding'
import { OnboardingError } from '../../packages/backend/src/modules/onboarding/index'
import { assertSelfServiceOnboardingConfiguration } from '../../packages/backend/src/runtime/onboarding'

const env = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'rental.test',
  PLATFORM_EDGE_SECRET: 'synthetic-http-edge-key-longer-than32',
}
const owner = 'authenticated-owner'
const receipt = {
  organization: {
    id: 'new-tenant',
    slug: 'new-rental',
    name: 'Synthetic Rental',
  },
  subscription: { status: 'TRIALING', trialEndsAt: '2026-10-18' },
  notices: [],
}
const ports = {
  environment: () => env,
  checkSignup: vi.fn(),
  provision: vi.fn(),
  slugAvailability: vi.fn(),
}
const request = (
  method = 'POST',
  suffix = '',
  overrides: Record<string, string> = {},
  body: unknown = onboardingInput('plan-version', 'new-rental')
) =>
  new Request('https://backend.test/api/onboarding/' + suffix, {
    method,
    headers: {
      'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.rental.test',
      'x-platform-client-ip': '192.0.2.25',
      Origin: 'https://app.rental.test',
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'synthetic-stable-key-1234',
      ...overrides,
    },
    ...(method === 'POST'
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  })
beforeEach(() => {
  vi.clearAllMocks()
  ports.provision.mockResolvedValue(receipt)
  ports.slugAvailability.mockResolvedValue({ available: true })
})
describe('shared onboarding HTTP parsing and app boundary', () => {
  it('returns the strict 201 receipt and host-only secure preference, using authenticated identity', async () => {
    const response = await createOnboardingHttpHandlers(ports).create(
      request(),
      owner
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(receipt)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Host')
    expect(response.headers.get('set-cookie')).toContain(
      'selected-tenant-id=new-tenant; Path=/; HttpOnly; SameSite=Lax;'
    )
    expect(response.headers.get('set-cookie')).toContain('; Secure')
    expect(response.headers.get('set-cookie')).not.toContain('Domain=')
    expect(ports.provision.mock.calls[0]?.slice(0, 4)).toEqual([
      owner,
      onboardingInput('plan-version', 'new-rental'),
      'synthetic-stable-key-1234',
      { ip: '192.0.2.25', userAgent: null },
    ])
  })
  it.each([
    { 'x-platform-edge-auth': 'forged' },
    {
      'x-platform-host-kind': 'tenant',
      'x-platform-origin': 'https://alfa.rental.test',
      'x-platform-tenant-slug': 'alfa',
    },
    {
      'x-platform-host-kind': 'apex',
      'x-platform-origin': 'https://rental.test',
    },
    { Origin: 'https://bravo.rental.test' },
    { Origin: 'null' },
    { 'Sec-Fetch-Site': 'same-site' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { 'x-platform-origin': 'https://outside.test' },
  ])(
    'refuses forged/non-app/cross-origin context before storage: %j',
    async (headers) => {
      const response = await createOnboardingHttpHandlers(ports).create(
        request('POST', '', headers),
        owner
      )
      expect(response.status).toBe(403)
      expect(ports.provision).not.toHaveBeenCalled()
    }
  )
  it('requires an explicit origin for the browser mutation', async () => {
    const inbound = request()
    inbound.headers.delete('origin')
    expect(
      (await createOnboardingHttpHandlers(ports).create(inbound, owner)).status
    ).toBe(403)
    expect(ports.provision).not.toHaveBeenCalled()
  })
  it.each([
    { body: '{}', status: 400 },
    { body: '{', status: 400 },
    {
      body: JSON.stringify({
        ...onboardingInput('plan-version', 'new-rental'),
        userId: 'other-user',
      }),
      status: 400,
    },
    {
      body: JSON.stringify({
        ...onboardingInput('plan-version', 'new-rental'),
        staffUserId: 'platform-admin',
      }),
      status: 400,
    },
    { body: 'a'.repeat(16385), status: 413 },
  ])(
    'rejects untrusted/oversized body before provisioning: $status',
    async ({ body, status }) => {
      expect(
        (
          await createOnboardingHttpHandlers(ports).create(
            request('POST', '', {}, body),
            owner
          )
        ).status
      ).toBe(status)
      expect(ports.provision).not.toHaveBeenCalled()
    }
  )
  it.each([{ 'Content-Type': 'text/plain' }, { 'Idempotency-Key': 'short' }])(
    'rejects content/key: %j',
    async (headers) => {
      expect(
        (
          await createOnboardingHttpHandlers(ports).create(
            request('POST', '', headers),
            owner
          )
        ).ok
      ).toBe(false)
      expect(ports.provision).not.toHaveBeenCalled()
    }
  )
  it('rejects unknown query selection instead of ignoring it', async () => {
    expect(
      (
        await createOnboardingHttpHandlers(ports).create(
          request('POST', '?tenantId=other'),
          owner
        )
      ).status
    ).toBe(400)
    expect(ports.provision).not.toHaveBeenCalled()
  })
  it('preserves rate retry and neutral slug suggestions without exposing internals', async () => {
    ports.provision.mockRejectedValueOnce(
      new OnboardingError(429, 'ONBOARDING_RATE_LIMITED', 61)
    )
    expect(
      (
        await createOnboardingHttpHandlers(ports).create(request(), owner)
      ).headers.get('retry-after')
    ).toBe('61')
    ports.provision.mockRejectedValueOnce(
      new OnboardingError(409, 'SLUG_UNAVAILABLE', undefined, ['new-rental-2'])
    )
    const response = await createOnboardingHttpHandlers(ports).create(
      request(),
      owner
    )
    expect(await response.json()).toEqual({
      error: 'Não foi possível concluir esta etapa do cadastro.',
      code: 'SLUG_UNAVAILABLE',
      suggestions: ['new-rental-2'],
    })
  })
  it.each([
    new Error('synthetic-private-password'),
    new OnboardingError(400, 'synthetic-private-password'),
  ])('hides arbitrary failure messages', async (error) => {
    const response = onboardingFailure(error)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('synthetic-private-password')
  })
  it('validates exactly one slug parameter and uses the trusted IP', async () => {
    const handlers = createOnboardingHttpHandlers(ports)
    expect(
      (await handlers.slug(request('GET', '?slug=new-rental'), owner)).status
    ).toBe(200)
    expect(ports.slugAvailability).toHaveBeenCalledWith(
      'new-rental',
      '192.0.2.25'
    )
    for (const query of [
      '',
      '?slug=',
      '?slug=a&slug=b',
      '?slug=a&tenantId=b',
    ]) {
      ports.slugAvailability.mockClear()
      expect((await handlers.slug(request('GET', query), owner)).status).toBe(
        400
      )
      expect(ports.slugAvailability).not.toHaveBeenCalled()
    }
  })
  it('fails closed when public signup is disabled, before storage', async () => {
    ports.checkSignup.mockImplementationOnce(() => {
      throw new OnboardingError(403, 'SELF_SERVICE_SIGNUP_DISABLED')
    })
    expect(
      (await createOnboardingHttpHandlers(ports).create(request(), owner))
        .status
    ).toBe(403)
    expect(ports.provision).not.toHaveBeenCalled()
  })
})
describe('public onboarding readiness configuration', () => {
  const ready = {
    PLATFORM_SELF_SERVICE_SIGNUP: 'on',
    AUTH_MODE: 'better-auth',
    PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
    PLATFORM_SECRETS_KMS_KEY_ARN: 'synthetic-kms',
    AWS_ROLE_ARN: 'synthetic-role',
    AWS_WEB_IDENTITY_TOKEN_FILE: 'synthetic-token-file',
    PLATFORM_CAPTCHA_SITE_KEY: 'synthetic-site',
    PLATFORM_CAPTCHA_SECRET_KEY: 'synthetic-secret',
  }
  it('allows the documented configuration without enabling actual env', () => {
    expect(() => assertSelfServiceOnboardingConfiguration(ready)).not.toThrow()
    expect(process.env.PLATFORM_SELF_SERVICE_SIGNUP).not.toBe('on')
  })
  it('defaults to disabled', () =>
    expect(() => assertSelfServiceOnboardingConfiguration({})).toThrow(
      'SELF_SERVICE_SIGNUP_DISABLED'
    ))
  it.each(Object.keys(ready))('requires %s', (name) =>
    expect(() =>
      assertSelfServiceOnboardingConfiguration({ ...ready, [name]: '' })
    ).toThrow()
  )
  it.each([
    { AUTH_MODE: 'legacy' },
    { PLATFORM_SECRETS_KEK_PROVIDER: 'env' },
    { PLATFORM_SELF_SERVICE_SIGNUP: 'true' },
  ])('rejects incompatible configuration %j', (changes) =>
    expect(() =>
      assertSelfServiceOnboardingConfiguration({ ...ready, ...changes })
    ).toThrow()
  )
})
