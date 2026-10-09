import { afterEach, expect, it, vi } from 'vitest'
import type { AsaasFetch, AsaasHttpClientConfig } from './asaas-http'
import {
  readAsaasPlatformSubscription,
  readAsaasSubscriptionSnapshot,
  setAsaasPlatformSubscriptionInactive,
  deleteAsaasPlatformInvoice,
} from './asaas-platform-subscription'
const subscription = {
  id: 'sub-one',
  customer: 'root-customer',
  externalReference: 'sub:local',
  status: 'ACTIVE',
  cycle: 'MONTHLY',
  value: 149.9,
  deleted: false,
}
const invoice = {
  id: 'pay-one',
  customer: 'root-customer',
  subscription: 'sub-one',
  externalReference: 'sub:local',
  status: 'PENDING',
  value: 149.9,
  dueDate: '2026-10-03',
  deleted: false,
  billingType: 'PIX',
}
const config = (fetch: AsaasFetch): AsaasHttpClientConfig => ({
  credential: 'synthetic-root',
  environment: 'sandbox' as const,
  fetch,
})
afterEach(() => vi.unstubAllEnvs())
it('reads only minimal subscription facts and pages invoices using the explicit root credential', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ ...subscription, creditCard: { token: 'private' } })
    )
    .mockResolvedValueOnce(Response.json({ data: [invoice], hasMore: true }))
    .mockResolvedValueOnce(
      Response.json({ data: [{ ...invoice, id: 'pay-two' }], hasMore: false })
    )
  const result = await readAsaasSubscriptionSnapshot(
    { id: 'sub-one', reference: 'sub:local', knownPaymentIds: [] },
    config(fetch)
  )
  expect(result.invoices).toHaveLength(2)
  expect(JSON.stringify(result)).not.toContain('private')
  expect(new URL(fetch.mock.calls[2]![0]).searchParams.get('offset')).toBe('1')
  expect(
    new URL(fetch.mock.calls[1]![0]).searchParams.get('subscription')
  ).toBe('sub-one')
  for (const [, init] of fetch.mock.calls)
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: { access_token: 'synthetic-root' },
    })
})
it('recovers an unknown subscription only by reference and reads the exact matched resource', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ data: [subscription], hasMore: false })
    )
    .mockResolvedValueOnce(Response.json(subscription))
    .mockResolvedValueOnce(Response.json({ data: [], hasMore: false }))
  expect(
    (
      await readAsaasSubscriptionSnapshot(
        { id: null, reference: 'sub:local', knownPaymentIds: [] },
        config(fetch)
      )
    ).subscription?.id
  ).toBe('sub-one')
  expect(
    new URL(fetch.mock.calls[0]![0]).searchParams.get('externalReference')
  ).toBe('sub:local')
  expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
})
it('does not interpret an absent unknown match as permission to create again', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ data: [], hasMore: false }))
  expect(
    await readAsaasSubscriptionSnapshot(
      { id: null, reference: 'sub:local', knownPaymentIds: [] },
      config(fetch)
    )
  ).toEqual({ subscription: null, invoices: [] })
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('rechecks stored invoice IDs missing from listings rather than assuming deletion', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(subscription))
    .mockResolvedValueOnce(Response.json({ data: [], hasMore: false }))
    .mockResolvedValueOnce(Response.json({ ...invoice, deleted: true }))
  const result = await readAsaasSubscriptionSnapshot(
    { id: 'sub-one', reference: 'sub:local', knownPaymentIds: ['pay-one'] },
    config(fetch)
  )
  expect(result.invoices[0]?.status).toBe('CANCELED')
  expect(new URL(fetch.mock.calls[2]![0]).pathname).toBe('/v3/payments/pay-one')
})
it.each([
  { data: [], hasMore: true },
  { data: [{ ...invoice, subscription: 'other' }], hasMore: false },
  { data: [invoice, invoice], hasMore: false },
  { data: [invoice], hasMore: 'true' },
])(
  'rejects malformed/nonprogressing/cross-subscription pages %j',
  async (page) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(subscription))
      .mockResolvedValue(Response.json(page))
    await expect(
      readAsaasSubscriptionSnapshot(
        { id: 'sub-one', reference: 'sub:local', knownPaymentIds: [] },
        config(fetch)
      )
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  }
)
it.each([
  { id: 'other' },
  { customer: null },
  { value: 149.901 },
  { deleted: true },
  { status: 'private-key' },
])('rejects invalid subscription identity or facts %j', async (extra) => {
  await expect(
    readAsaasPlatformSubscription(
      'sub-one',
      config(
        vi.fn().mockResolvedValue(Response.json({ ...subscription, ...extra }))
      )
    )
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('inactivates recurrence without deleting a subscription, and cancels only an explicit payment ID', async () => {
  const fetch = vi
    .fn<AsaasFetch>()
    .mockImplementation(async () =>
      Response.json({ id: 'pay-one', deleted: true })
    )
  await setAsaasPlatformSubscriptionInactive('sub-one', config(fetch))
  await deleteAsaasPlatformInvoice('pay-one', config(fetch))
  expect(fetch.mock.calls[0]![1]).toMatchObject({
    method: 'PUT',
    body: JSON.stringify({ status: 'INACTIVE' }),
  })
  expect(new URL(fetch.mock.calls[0]![0]).pathname).toBe(
    '/v3/subscriptions/sub-one'
  )
  expect(fetch.mock.calls[1]![1].method).toBe('DELETE')
  expect(new URL(fetch.mock.calls[1]![0]).pathname).toBe('/v3/payments/pay-one')
})
it('the emergency switch refuses writes and reads before any network call', async () => {
  vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'true')
  const fetch = vi.fn()
  await expect(
    setAsaasPlatformSubscriptionInactive('sub-one', config(fetch))
  ).rejects.toMatchObject({ reason: 'OUTBOUND_DISABLED' })
  await expect(
    readAsaasPlatformSubscription('sub-one', config(fetch))
  ).rejects.toMatchObject({ reason: 'OUTBOUND_DISABLED' })
  expect(fetch).not.toHaveBeenCalled()
})
it('a malformed DELETE acknowledgement remains uncertain and cannot enable a blind retry', async () => {
  await expect(
    deleteAsaasPlatformInvoice(
      'pay-one',
      config(
        vi
          .fn<AsaasFetch>()
          .mockResolvedValue(Response.json({ id: 'other', deleted: true }))
      )
    )
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', maybeApplied: true })
})
