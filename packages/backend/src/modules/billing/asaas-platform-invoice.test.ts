import { afterEach, expect, it, vi } from 'vitest'
import { readAsaasPlatformInvoice } from './asaas-platform-invoice'
const payment = {
  id: 'pay-one',
  value: 149.9,
  status: 'CONFIRMED',
  deleted: false,
  customer: 'root-customer',
  subscription: 'root-subscription',
  dueDate: '2026-10-03',
  confirmedDate: '2026-10-03',
  invoiceUrl: 'https://sandbox.asaas.com/i/one',
  billingType: 'PIX',
  creditCard: { creditCardToken: 'must-not-escape' },
}
const read = (body: unknown) =>
  readAsaasPlatformInvoice('pay-one', {
    credential: 'synthetic-root',
    environment: 'sandbox',
    fetch: vi.fn().mockResolvedValue(Response.json(body)),
  })
afterEach(() => vi.unstubAllEnvs())
it('confirms through the shared transport with an explicit root credential and returns no PII', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(payment))
  const result = await readAsaasPlatformInvoice('pay-one', {
    credential: 'synthetic-root',
    environment: 'sandbox',
    fetch,
  })
  expect(result.status).toBe('PAID')
  expect(result.amount.toFixed(2)).toBe('149.90')
  expect(result.paidAt).toEqual(new Date('2026-10-03T03:00:00Z'))
  expect(JSON.stringify(result)).not.toContain('must-not-escape')
  expect(fetch.mock.calls[0]![1]).toMatchObject({
    method: 'GET',
    redirect: 'error',
    headers: { access_token: 'synthetic-root' },
  })
  expect(fetch.mock.calls[0]![1].body).toBeUndefined()
})
it.each([
  ['RECEIVED', 'PAID'],
  ['CONFIRMED', 'PAID'],
  ['RECEIVED_IN_CASH', 'PAID'],
  ['OVERDUE', 'OVERDUE'],
  ['REFUND_REQUESTED', 'REFUNDED'],
  ['REFUND_IN_PROGRESS', 'REFUNDED'],
  ['REFUNDED', 'REFUNDED'],
  ['CHARGEBACK_REQUESTED', 'CHARGEBACK'],
  ['CHARGEBACK_DISPUTE', 'CHARGEBACK'],
  ['AWAITING_CHARGEBACK_REVERSAL', 'CHARGEBACK'],
])('platform-specific mapping %s -> %s', async (raw, status) => {
  expect((await read({ ...payment, status: raw })).status).toBe(status)
})
it('records unknown status and deletion separately', async () => {
  expect(
    await read({ ...payment, status: 'NEW_PROVIDER_STATE' })
  ).toMatchObject({ status: 'PENDING', unknownStatus: true })
  expect(
    await read({ ...payment, status: 'PENDING', deleted: true })
  ).toMatchObject({ status: 'CANCELED', unknownStatus: false })
})
it('preserves provider cash receipts as a paid invoice with their actual billing type', async () => {
  expect(
    await read({
      ...payment,
      status: 'RECEIVED',
      billingType: 'RECEIVED_IN_CASH',
    })
  ).toMatchObject({ status: 'PAID', billingType: 'RECEIVED_IN_CASH' })
})
it.each([
  { value: 0.001 },
  { value: -1 },
  { dueDate: '2026-02-31' },
  { id: 'other' },
  { invoiceUrl: 'https://example.com/invoice' },
  { invoiceUrl: 'https://user@asaas.com/i' },
  { paymentDate: 'tomorrow' },
  { customer: null },
  { status: 'private-message-with-key' },
])('refuses malformed or mismatching provider data %j', async (extra) => {
  await expect(read({ ...payment, ...extra })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
