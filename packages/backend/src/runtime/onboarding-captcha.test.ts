import { describe, expect, it, vi } from 'vitest'
import { verifyOnboardingCaptcha } from './onboarding-captcha'
const input = {
  secret: 'synthetic-private-captcha-secret',
  token: 'synthetic-challenge',
  hostname: 'app.rental.test',
  ip: '192.0.2.25',
  key: 'synthetic-idempotency-key',
  userId: 'owner',
}
const result = { success: true, hostname: input.hostname, action: 'onboarding' }
describe('bounded server-side signup captcha', () => {
  it('binds hostname/action and sends trusted address to the fixed endpoint with a stable validation UUID', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(result))
    await verifyOnboardingCaptcha(input, transport)
    await verifyOnboardingCaptcha(input, transport)
    const call = transport.mock.calls[0]!
    expect(call[0]).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    )
    expect(call[1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
    })
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(String(call[1]?.body))
    expect(body).toMatchObject({
      secret: input.secret,
      response: input.token,
      remoteip: input.ip,
    })
    expect(body.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(
      JSON.parse(String(transport.mock.calls[1]?.[1]?.body)).idempotency_key
    ).toBe(body.idempotency_key)
    await verifyOnboardingCaptcha(
      { ...input, userId: 'another-owner' },
      transport
    )
    expect(
      JSON.parse(String(transport.mock.calls[2]?.[1]?.body)).idempotency_key
    ).not.toBe(body.idempotency_key)
  })
  it.each([null, '', 'x'.repeat(2049)])(
    'refuses missing/oversized token before network: %j',
    async (token) => {
      const transport = vi.fn<typeof fetch>()
      await expect(
        verifyOnboardingCaptcha({ ...input, token }, transport)
      ).rejects.toThrow('CAPTCHA_REQUIRED')
      expect(transport).not.toHaveBeenCalled()
    }
  )
  it.each([
    { ...result, success: false },
    { ...result, hostname: 'bravo.rental.test' },
    { ...result, action: 'login' },
    { success: true },
  ])('refuses invalid/cross-host/action validation %j', async (body) =>
    expect(
      verifyOnboardingCaptcha(
        input,
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
      )
    ).rejects.toThrow('CAPTCHA_INVALID')
  )
  it.each([
    new Response('unavailable', { status: 503 }),
    new Response('{'),
    new Response('x'.repeat(8193)),
    Response.json({ success: 'true' }),
  ])('hides malformed/unavailable provider response', async (response) =>
    expect(
      verifyOnboardingCaptcha(
        input,
        vi.fn<typeof fetch>().mockResolvedValue(response)
      )
    ).rejects.toThrow('CAPTCHA_UNAVAILABLE')
  )
  it('does not forward unbounded IPv6 rate-limit network as an IP and never retries a failed POST', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(result))
      .mockRejectedValueOnce(new Error(input.secret))
    await verifyOnboardingCaptcha(
      { ...input, ip: '2001:db8:0:0::/64' },
      transport
    )
    expect(
      JSON.parse(String(transport.mock.calls[0]?.[1]?.body))
    ).not.toHaveProperty('remoteip')
    await expect(verifyOnboardingCaptcha(input, transport)).rejects.toThrow(
      'CAPTCHA_UNAVAILABLE'
    )
    expect(transport).toHaveBeenCalledTimes(2)
  })
})
