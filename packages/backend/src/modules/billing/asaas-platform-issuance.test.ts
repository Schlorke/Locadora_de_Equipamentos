import { afterEach, expect, it, vi } from 'vitest'
import { createAsaasPlatformIssuance } from './asaas-platform-issuance'
import { BillingProviderError, type AsaasFetch } from './asaas-http'
import { toMoney } from './asaas-amount'
const customer = {
  id: 'cus_fixture',
  cpfCnpj: '11.222.333/0001-81',
  externalReference: 'org:fixture',
  notificationDisabled: true,
  deleted: false,
}
const subscription = {
  id: 'sub_fixture',
  customer: customer.id,
  externalReference: 'sub:fixture',
  status: 'ACTIVE',
  cycle: 'MONTHLY',
  value: 149.9,
  deleted: false,
}
const input = {
  name: 'Synthetic fixture',
  cpfCnpj: '11222333000181',
  email: 'billing@example.invalid',
  externalReference: 'org:fixture',
  notificationDisabled: true as const,
}
const recurring = {
  customer: customer.id,
  amount: toMoney('149.90'),
  nextDueDate: '2026-10-15',
  externalReference: 'sub:fixture',
  description: 'Synthetic plan',
}
const create = (fetch: AsaasFetch) =>
  createAsaasPlatformIssuance({
    credential: 'synthetic-root-key',
    environment: 'sandbox',
    fetch,
    policy: () => ({ outboundDisabled: false, egress: { kind: 'direct' } }),
  })
afterEach(() => vi.restoreAllMocks())
it('queries document and organization reference, then reads the exact existing customer', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [customer], hasMore: false }))
    .mockResolvedValueOnce(
      Response.json({ ...customer, privateField: 'omit-me' })
    )
  const result = await create(fetch).findCustomer(input)
  expect(result).toEqual({
    id: customer.id,
    cpfCnpj: input.cpfCnpj,
    externalReference: input.externalReference,
    notificationDisabled: true,
  })
  const url = new URL(fetch.mock.calls[0]![0])
  expect(url.searchParams.get('cpfCnpj')).toBe(input.cpfCnpj)
  expect(url.searchParams.get('externalReference')).toBe(
    input.externalReference
  )
  expect(fetch.mock.calls[1]![0]).toMatch(/\/customers\/cus_fixture$/)
  expect(
    fetch.mock.calls.every(
      ([, init]) =>
        init.method === 'GET' &&
        init.body === undefined &&
        init.redirect === 'error'
    )
  ).toBe(true)
})
it.each(['customer', 'subscription'] as const)(
  'returns an empty %s search without creating a resource',
  async (resource) => {
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ data: [], hasMore: false })
      )
    const api = create(fetch)
    expect(
      await (resource === 'customer'
        ? api.findCustomer(input)
        : api.findSubscription('sub:fixture'))
    ).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(resource === 'customer' ? 2 : 1)
    expect(fetch.mock.calls[0]![1].method).toBe('GET')
  }
)
it.each([
  { data: [customer, customer], hasMore: false },
  { data: [customer], hasMore: true },
  { data: [], hasMore: 'false' },
])('refuses ambiguous or malformed search: %j', async (list) => {
  const fetch = vi.fn().mockResolvedValue(Response.json(list))
  await expect(create(fetch).findCustomer(input)).rejects.toBeInstanceOf(
    BillingProviderError
  )
  expect(fetch).toHaveBeenCalledTimes(1)
})
it.each([
  { deleted: true },
  { notificationDisabled: false },
  { cpfCnpj: null },
])('rejects unsafe customer facts: %j', async (patch) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ ...customer, ...patch }))
  await expect(create(fetch).createCustomer(input)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
it('creates only a monthly undefined-payment recurrence with exact cents, no split or card data and a 60-second timeout', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: subscription.id }))
    .mockResolvedValueOnce(Response.json(subscription))
  const result = await create(fetch).createSubscription(recurring)
  expect(result.amount.toFixed(2)).toBe('149.90')
  expect(timeout).toHaveBeenCalledWith(60_000)
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
    customer: customer.id,
    billingType: 'UNDEFINED',
    value: 149.9,
    nextDueDate: '2026-10-15',
    cycle: 'MONTHLY',
    externalReference: 'sub:fixture',
    description: 'Synthetic plan',
    fine: { value: 0 },
    interest: { value: 0 },
  })
  expect(fetch.mock.calls[1]![1].method).toBe('GET')
})
it('checks the organization reference alone before creating a customer after a document change', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [], hasMore: false }))
    .mockResolvedValueOnce(Response.json({ data: [customer], hasMore: false }))
    .mockResolvedValueOnce(Response.json(customer))
  const remote = await create(fetch).findCustomer({
    ...input,
    cpfCnpj: '11444777000161',
  })
  expect(remote?.cpfCnpj).toBe(input.cpfCnpj)
  const fallback = new URL(fetch.mock.calls[1]![0])
  expect(fallback.searchParams.get('externalReference')).toBe(
    input.externalReference
  )
  expect(fallback.searchParams.has('cpfCnpj')).toBe(false)
  expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
})
it('a failed GET after successful creation remains ambiguous even when that GET is rejected', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: subscription.id }))
    .mockResolvedValueOnce(
      Response.json(
        { errors: [{ code: 'not_found', description: 'private details' }] },
        { status: 404 }
      )
    )
  await expect(
    create(fetch).createSubscription(recurring)
  ).rejects.toMatchObject({ code: 'AMBIGUOUS', maybeApplied: true })
  expect(
    fetch.mock.calls.filter(([, init]) => init.method === 'POST')
  ).toHaveLength(1)
})
it('stores no keys or provider bodies in an uncertain customer error', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValue(new Error('synthetic-root-key private body'))
  let caught: unknown
  try {
    await create(fetch).createCustomer(input)
  } catch (error) {
    caught = error
  }
  expect(caught).toMatchObject({ maybeApplied: true })
  expect(JSON.stringify(caught)).not.toMatch(/synthetic-root-key|private body/)
})
