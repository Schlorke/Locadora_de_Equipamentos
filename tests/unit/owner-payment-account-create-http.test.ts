import { beforeEach, expect, it, vi } from 'vitest'
import { createOwnerPaymentAccountCreateHandler } from '../../packages/backend/src/http/owner-payment-account-create'
import { OwnerSubaccountRequestError } from '../../packages/backend/src/modules/payment-accounts/index'

// Wave 134 (S9): owner creation offer and request over HTTP. The declared income and phone are never echoed.
const principal = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
}
const at = new Date('2026-10-07T12:00:00Z')
const version = 'a'.repeat(64)
const body = {
  incomeValue: '98765.43',
  mobilePhone: '(11) 98765-4321',
  companyDataConfirmed: true,
  companyDataVersion: version,
}
const offer = {
  available: false,
  blocker: 'FIRST_PAYMENT_REQUIRED',
  model: null,
  company: null,
  suggestedMobilePhone: null,
  companyDataVersion: null,
  lastRequestOutcome: null,
}
const read = vi.fn(),
  submit = vi.fn(),
  session = vi.fn()
const handler = () =>
  createOwnerPaymentAccountCreateHandler({
    environment: () => ({
      PLATFORM_ENV: 'development',
      PLATFORM_ROOT_DOMAIN: 'localhost',
      PLATFORM_PUBLIC_PORT: '3001',
    }),
    getSession: session,
    creation: { offer: read, request: submit },
    now: () => at,
  })
const url = 'http://app.localhost:3001/api/admin/payment-account/create'
const post = (value: unknown = body, extra: Record<string, string> = {}) =>
  new Request(url, {
    method: 'POST',
    headers: {
      Origin: 'http://app.localhost:3001',
      'Content-Type': 'application/json',
      ...extra,
    },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  })
const check = async (request: Request, status: number) => {
  const response = await handler()(request, principal)
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('vary')).toBe('Cookie, Host')
  const text = await response.text()
  for (const marker of ['98765', '98765-4321', '11987654321', 'private'])
    expect(text).not.toContain(marker)
  return text ? JSON.parse(text) : null
}
beforeEach(() => {
  vi.resetAllMocks()
  session.mockResolvedValue({
    user: { id: principal.userId },
    authenticatedAt: at.getTime(),
  })
  read.mockResolvedValue(offer)
  submit.mockResolvedValue({ accepted: true })
})

it('GET returns the strict offer; same-origin and plain reads are accepted', async () => {
  expect(await check(new Request(url), 200)).toEqual(offer)
  expect(
    await check(
      new Request(url, {
        headers: {
          Origin: 'http://app.localhost:3001',
          'Sec-Fetch-Site': 'same-origin',
        },
      }),
      200
    )
  ).toEqual(offer)
  expect(read).toHaveBeenCalledWith(principal)
  expect(submit).not.toHaveBeenCalled()
  expect(session).not.toHaveBeenCalled()
})

it('POST passes only the strict, normalized body and the fresh session instant to the command', async () => {
  expect(await check(post(), 202)).toEqual({ accepted: true })
  expect(submit).toHaveBeenCalledWith(
    principal,
    { ...body, mobilePhone: '11987654321' },
    at.getTime()
  )
})

it.each([
  { ...body, incomeValue: 98765.43 },
  { ...body, incomeValue: '98765.432' },
  { ...body, incomeValue: '-1.00' },
  { ...body, mobilePhone: '1133334444' },
  { ...body, incomeRange: 'UP_TO_10K' },
  { ...body, companyDataConfirmed: false },
  { ...body, companyDataVersion: 'private' },
  { ...body, environment: 'production' },
  { ...body, tenantId: 'other' },
])('refuses an invalid body without echoing it: %j', async (value) => {
  expect(await check(post(value), 400)).toEqual({
    error: 'Confira os dados informados.',
    code: 'INVALID_INPUT',
  })
  expect(submit).not.toHaveBeenCalled()
})

it.each(['http://alfa.localhost:3001', 'http://bravo.localhost:3001', 'null'])(
  'refuses a sibling, foreign or null Origin on reads and writes: %s',
  async (Origin) => {
    await check(new Request(url, { headers: { Origin } }), 403)
    await check(post(body, { Origin }), 403)
    expect(read).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    expect(session).not.toHaveBeenCalled()
  }
)

it('POST requires the exact panel origin: missing Origin, same-site fetch and another host are refused', async () => {
  const missing = post()
  missing.headers.delete('origin')
  await check(missing, 403)
  await check(post(body, { 'Sec-Fetch-Site': 'same-site' }), 403)
  await check(
    new Request('http://alfa.localhost:3001/api/admin/payment-account/create', {
      method: 'POST',
      headers: {
        Origin: 'http://alfa.localhost:3001',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    403
  )
  expect(submit).not.toHaveBeenCalled()
})

it.each([
  null,
  { user: { id: 'other' }, authenticatedAt: at.getTime() },
  { user: { id: principal.userId }, authenticatedAt: at.getTime() - 600_001 },
])('POST requires a fresh session of the same user: %j', async (value) => {
  session.mockResolvedValue(value)
  expect(await check(post(), 401)).toMatchObject({
    code: 'FRESH_SESSION_REQUIRED',
  })
  expect(submit).not.toHaveBeenCalled()
})

it('bounds the body, requires JSON, refuses any query and other methods', async () => {
  await check(post({ ...body, padding: 'x'.repeat(16384) }), 413)
  await check(post(body, { 'Content-Type': 'text/plain' }), 415)
  await check(post('{"incomeValue":'), 400)
  await check(new Request(url + '?tenantId=other'), 400)
  await check(new Request(url, { method: 'PUT' }), 405)
  expect(submit).not.toHaveBeenCalled()
})

it.each([
  [402, 'MODULE_NOT_IN_PLAN'],
  [403, 'EMAIL_NOT_VERIFIED'],
  [409, 'DOCUMENT_IN_USE'],
  [409, 'COMPANY_DATA_CHANGED'],
  [409, 'FIRST_PAYMENT_REQUIRED'],
  [409, 'PAYMENTS_NOTICE_REQUIRED'],
  [409, 'PAYMENT_ACCOUNT_CREATION_UNAVAILABLE'],
] as const)('maps %s %s to a safe reply', async (status, code) => {
  submit.mockRejectedValueOnce(new OwnerSubaccountRequestError(status, code))
  expect(await check(post(), status)).toEqual({
    error: 'Não foi possível pedir a conta de recebimentos.',
    code,
  })
})

it('conceals arbitrary failures of the offer and of the request', async () => {
  read.mockRejectedValueOnce(new Error('private-offer-failure'))
  expect(await check(new Request(url), 503)).toEqual({
    error: 'Não foi possível consultar a criação da conta de recebimentos.',
  })
  submit.mockRejectedValueOnce(new Error('private-request-failure 98765.43'))
  await check(post(), 503)
})
