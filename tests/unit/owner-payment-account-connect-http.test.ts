import { beforeEach, expect, it, vi } from 'vitest'
import { createOwnerPaymentAccountConnectHandler } from '../../packages/backend/src/http/owner-payment-account-connect'
import { OwnerPaymentAccountConnectError } from '../../packages/backend/src/modules/payment-accounts/index'
import { BillingProviderError } from '../../packages/backend/src/modules/billing/index'
const principal = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
}
const at = new Date('2026-10-04T15:00:00Z')
const apiKey = '$aact_hmlg_' + 'synthetic'.repeat(8)
const connect = vi.fn(),
  session = vi.fn()
const handler = () =>
  createOwnerPaymentAccountConnectHandler({
    environment: () => ({
      PLATFORM_ENV: 'development',
      PLATFORM_ROOT_DOMAIN: 'localhost',
      PLATFORM_PUBLIC_PORT: '3001',
    }),
    getSession: session,
    connect,
    now: () => at,
  })
const request = (
  body: unknown = { apiKey },
  extra: Record<string, string> = {}
) =>
  new Request('http://app.localhost:3001/api/admin/payment-account/connect', {
    method: 'POST',
    headers: {
      Origin: 'http://app.localhost:3001',
      'Content-Type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(body),
  })
const check = async (req: Request, code: number) => {
  const response = await handler()(req, principal)
  expect(response.status).toBe(code)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('vary')).toBe('Cookie, Host')
  const text = await response.text()
  expect(text).not.toContain(apiKey)
  expect(text).not.toContain('private-error')
  return JSON.parse(text)
}
beforeEach(() => {
  vi.resetAllMocks()
  session.mockResolvedValue({
    user: { id: principal.userId },
    authenticatedAt: at.getTime(),
  })
  connect.mockResolvedValue({ accepted: true })
})
it('accepts only the strict request after app-origin and verified session checks', async () => {
  expect(await check(request(), 202)).toEqual({ accepted: true })
  expect(connect).toHaveBeenCalledWith(principal, {
    apiKey,
    authenticatedAt: at.getTime(),
  })
})
it.each([
  {},
  { apiKey: 'private-error' },
  { apiKey, environment: 'production' },
  { apiKey, authenticatedAt: at.getTime() },
])('rejects unsafe bodies without invoking the command: %j', async (body) => {
  await check(request(body), 400)
  expect(connect).not.toHaveBeenCalled()
})
it.each(['http://alfa.localhost:3001', 'null', 'http://bravo.localhost:3001'])(
  'rejects foreign/null browser origin before reading identity: %s',
  async (Origin) => {
    await check(request(undefined, { Origin }), 403)
    expect(session).not.toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
  }
)
it('requires the app host and refuses missing origin even in development', async () => {
  const req = request()
  req.headers.delete('origin')
  await check(req, 403)
  await check(
    new Request(
      'http://alfa.localhost:3001/api/admin/payment-account/connect',
      { method: 'POST', headers: { Origin: 'http://alfa.localhost:3001' } }
    ),
    403
  )
  expect(connect).not.toHaveBeenCalled()
})
it.each([
  null,
  { user: { id: 'other' }, authenticatedAt: at.getTime() },
  { user: { id: principal.userId }, authenticatedAt: at.getTime() - 600_001 },
])('requires trusted fresh identity: %j', async (value) => {
  session.mockResolvedValue(value)
  expect(await check(request(), 401)).toMatchObject({
    code: 'FRESH_SESSION_REQUIRED',
  })
  expect(connect).not.toHaveBeenCalled()
})
it('bounds byte input, requires JSON, rejects unknown query and other methods', async () => {
  await check(request({ apiKey: 'x'.repeat(16384) }), 413)
  await check(request(undefined, { 'Content-Type': 'text/plain' }), 415)
  await check(
    new Request(
      'http://app.localhost:3001/api/admin/payment-account/connect?tenantId=other',
      { method: 'POST', headers: { Origin: 'http://app.localhost:3001' } }
    ),
    400
  )
  await check(
    new Request('http://app.localhost:3001/api/admin/payment-account/connect'),
    405
  )
  expect(connect).not.toHaveBeenCalled()
})
it('returns safe conflicts/provider refusal and conceals arbitrary failures', async () => {
  connect.mockRejectedValueOnce(
    new OwnerPaymentAccountConnectError(409, 'ACCOUNT_DOCUMENT_MISMATCH')
  )
  expect(await check(request(), 409)).toMatchObject({
    code: 'ACCOUNT_DOCUMENT_MISMATCH',
  })
  connect.mockRejectedValueOnce(
    new BillingProviderError('REJECTED', { reason: 'AUTHENTICATION' })
  )
  expect(await check(request(), 400)).toMatchObject({
    code: 'CREDENTIAL_REJECTED',
  })
  connect.mockRejectedValueOnce(new Error('private-error-' + apiKey))
  await check(request(), 503)
})
