import { describe, expect, it, vi } from 'vitest'
import { readAsaasPayment } from '../../packages/backend/src/modules/billing/asaas-events'

const payment = {
  id: 'pay/owned',
  status: 'RECEIVED',
  value: 120,
  paymentDate: '2030-01-10',
}
const config = (request: typeof fetch) => ({
  apiKey: 'tenant-only-key',
  environment: 'sandbox' as const,
  fetch: request,
})

describe('tenant Asaas payment reader', () => {
  it('preserves the observed legacy fallback without enabling strict recovery', async () => {
    for (const extra of [
      { status: 'UNKNOWN_FUTURE_STATUS' },
      { deleted: true, status: 'PENDING' },
    ]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ ...payment, ...extra }))
      expect((await readAsaasPayment(payment.id, config(request))).status).toBe(
        'pending'
      )
    }
  })
  it.each([
    'PENDING',
    'OVERDUE',
    'RECEIVED',
    'CONFIRMED',
    'RECEIVED_IN_CASH',
    'REFUNDED',
    'CANCELLED',
  ])('strict recovery accepts a known boleto snapshot: %s', async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...payment,
        status,
        billingType: 'BOLETO',
        deleted: false,
        subscription: null,
      })
    )
    expect(
      await readAsaasPayment(payment.id, {
        ...config(request),
        reconciliation: true,
      })
    ).toMatchObject({ amount: 120, billingType: 'BOLETO' })
  })
  it('strict recovery treats a deleted pending charge as cancellation evidence', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...payment,
        status: 'PENDING',
        deleted: true,
        billingType: 'PIX',
      })
    )
    expect(
      await readAsaasPayment(payment.id, {
        ...config(request),
        reconciliation: true,
      })
    ).toMatchObject({ status: 'cancelled', billingType: 'PIX' })
  })
  it.each([
    { status: 'UNKNOWN_FUTURE_STATUS' },
    { status: 'REFUND_REQUESTED' },
    { status: 'REFUND_IN_PROGRESS' },
    { status: 'CHARGEBACK_REQUESTED' },
    { status: 'AWAITING_RISK_ANALYSIS' },
    { billingType: 'CREDIT_CARD' },
    { billingType: undefined },
    { deleted: 'true' },
    { deleted: true },
    { subscription: 'sub-platform' },
    { paymentDate: undefined },
  ])('strict recovery refuses ambiguous evidence: %j', async (extra) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...payment, billingType: 'BOLETO', ...extra })
      )
    await expect(
      readAsaasPayment(payment.id, { ...config(request), reconciliation: true })
    ).rejects.toThrow('INVALID_RESPONSE')
  })
  it('uses explicit credentials, fixed origin, encoded reference and a bounded request', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(payment))
    // `paymentDate` só-dia é a data civil de São Paulo (UTC-3), não meia-noite UTC (que seria 09/01 às 21h).
    await expect(
      readAsaasPayment(payment.id, config(request))
    ).resolves.toEqual({
      status: 'paid',
      amount: 120,
      paidAt: new Date('2030-01-10T03:00:00Z'),
    })
    expect(request).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments/pay%2Fowned',
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({ access_token: 'tenant-only-key' }),
      })
    )
  })
  it('does not fall back to global credentials when tenant credentials are absent', async () => {
    const request = vi.fn<typeof fetch>()
    vi.stubEnv('ASAAS_API_KEY', 'unrelated-global-key')
    try {
      await expect(
        readAsaasPayment(payment.id, { ...config(request), apiKey: '' })
      ).rejects.toThrow('UNAVAILABLE')
    } finally {
      vi.unstubAllEnvs()
    }
    expect(request).not.toHaveBeenCalled()
  })
  it.each([
    { ...payment, id: 'another-payment' },
    { ...payment, value: -1 },
    { ...payment, value: '120' },
    { ...payment, paymentDate: 'not-a-date' },
    // `Date.parse` aceita, mas não é forma de data do Asaas (fuso ambíguo).
    { ...payment, paymentDate: '2030-01-10T10:00:00' },
    { ...payment, paymentDate: '2030-02-31' },
    { ...payment, status: null },
  ])('rejects mismatched or invalid provider data: %j', async (invalid) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(invalid))
    await expect(readAsaasPayment(payment.id, config(request))).rejects.toThrow(
      'INVALID_RESPONSE'
    )
  })
  it('prefers clientPaymentDate and reads it as the São Paulo civil date', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...payment,
        paymentDate: '2030-01-11',
        clientPaymentDate: '2030-01-10',
      })
    )
    const read = await readAsaasPayment(payment.id, config(request))
    expect(read.paidAt).toEqual(new Date('2030-01-10T03:00:00Z'))
    expect(
      read.paidAt!.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
    ).toBe('10/01/2030')
  })
  it('never exposes the body of a rejected provider response', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { errors: ['sensitive-provider-content'] },
          { status: 401 }
        )
      )
    await expect(readAsaasPayment(payment.id, config(request))).rejects.toThrow(
      /^REJECTED$/
    )
  })
  it('keeps network failures recoverable without leaking their detail', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private-network-detail'))
    await expect(readAsaasPayment(payment.id, config(request))).rejects.toThrow(
      /^UNAVAILABLE$/
    )
  })
})
