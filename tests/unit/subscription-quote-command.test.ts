import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { createQuoteBoletos } from '../../packages/backend/src/modules/quotations/boleto'

const principal = {
  tenantId: 'alfa',
  userId: 'admin',
  membershipId: 'member',
  role: 'ADMIN' as const,
  access: 'FULL' as const,
}
const mock = {
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  quote: { findFirst: vi.fn() },
  financialSetting: { findFirst: vi.fn() },
  subscription: { findFirst: vi.fn() },
  entitlementOverride: { findMany: vi.fn() },
  payment: { findMany: vi.fn(), create: vi.fn() },
  paymentAttempt: { findFirst: vi.fn() },
  outboxEvent: { upsert: vi.fn() },
  // No receiving account: the legacy environment reference keeps its rules (wave 134 barrier).
  paymentAccount: { findFirst: async () => null },
}
const tx = mock as unknown as Prisma.TransactionClient
const run = async <T>(
  _context: unknown,
  operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => operation(tx)
const service = () =>
  createQuoteBoletos({
    withTenantTransaction: run,
    withRentalTransaction: run,
    obligationError: (status, message, policy) =>
      new PaymentRequestError(status, message, policy),
  })
const plan = (enabled: boolean) => ({
  schema: 1,
  limits: { equipments: 20, staffSeats: 3 },
  features: Object.fromEntries(
    ENTITLEMENT_FEATURES.map((key) => [
      key,
      key === 'onlinePayments' ? enabled : true,
    ])
  ),
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
  mock.$queryRaw.mockResolvedValue([
    { id: 'alfa', status: 'ACTIVE', access: 'FULL' },
  ])
  mock.quote.findFirst.mockResolvedValue({
    id: 'quote',
    tenantId: 'alfa',
    status: 'APPROVED',
    approvedAt: new Date(),
    cpf: '12345678909',
    total: new Prisma.Decimal(100),
  })
  mock.subscription.findFirst.mockResolvedValue({
    planVersion: { entitlements: plan(false) },
  })
  mock.entitlementOverride.findMany.mockResolvedValue([])
  mock.financialSetting.findFirst.mockResolvedValue(null)
  mock.payment.findMany.mockResolvedValue([])
  mock.payment.create.mockImplementation(async ({ data }) => ({
    id: 'payment',
    ...data,
    transactionId: null,
    metadata: null,
  }))
  mock.outboxEvent.upsert.mockResolvedValue({ id: 'event' })
})
afterEach(() => vi.unstubAllEnvs())
describe('manual quote boleto and accepted work share one financial core', () => {
  it.each(['FULL', 'RESTRICTED', 'ARCHIVED'])(
    'manual %s refusal creates no obligation or outbox; already accepted work proceeds',
    async (access) => {
      mock.$queryRaw.mockResolvedValue([
        { id: 'alfa', status: 'ACTIVE', access },
      ])
      const api = service()
      await expect(
        api.requestQuoteBoletoPayment(principal, 'quote')
      ).rejects.toMatchObject({
        status: access === 'ARCHIVED' ? 403 : 402,
        policy: {
          code:
            access === 'FULL'
              ? 'MODULE_NOT_IN_PLAN'
              : access === 'ARCHIVED'
                ? 'TENANT_ARCHIVED'
                : 'SUBSCRIPTION_RESTRICTED',
        },
      })
      expect(mock.payment.create).not.toHaveBeenCalled()
      expect(mock.outboxEvent.upsert).not.toHaveBeenCalled()
      mock.$queryRaw.mockClear()
      mock.subscription.findFirst.mockClear()
      expect(
        await api.ensureQuoteBoletoPayment(principal, 'quote')
      ).toMatchObject({
        paymentId: 'payment',
        amount: 100,
        created: true,
        processing: 'PENDING',
      })
      expect(mock.$queryRaw).not.toHaveBeenCalled()
      expect(mock.subscription.findFirst).not.toHaveBeenCalled()
      expect(mock.outboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            topic: 'payment.issue',
            tenantId: 'alfa',
          }),
        })
      )
    }
  )
  it('off keeps the same DTO and no commercial reads for manual calls', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
    expect(
      await service().requestQuoteBoletoPayment(principal, 'quote')
    ).toMatchObject({ amount: 100, status: 'PENDING', processing: 'PENDING' })
    expect(mock.$queryRaw).not.toHaveBeenCalled()
    expect(mock.subscription.findFirst).not.toHaveBeenCalled()
  })
  it('enabled module permits manual creation and then reuses the durable obligation', async () => {
    mock.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: plan(true) },
    })
    const api = service()
    await api.requestQuoteBoletoPayment(principal, 'quote')
    mock.payment.findMany.mockResolvedValue([
      await mock.payment.create.mock.results[0]!.value,
    ])
    expect(
      await api.requestQuoteBoletoPayment(principal, 'quote')
    ).toMatchObject({ created: false, paymentId: 'payment' })
    expect(mock.payment.create).toHaveBeenCalledTimes(1)
  })
  it('a state change after issuance blocks the separate notification without undoing accepted issuance', async () => {
    mock.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: plan(true) },
    })
    mock.$queryRaw
      .mockResolvedValueOnce([{ id: 'alfa', status: 'ACTIVE', access: 'FULL' }])
      .mockResolvedValue([
        { id: 'alfa', status: 'ACTIVE', access: 'RESTRICTED' },
      ])
    await expect(
      service().requestQuoteBoletoDelivery(principal, 'quote')
    ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
    expect(mock.payment.create).toHaveBeenCalledTimes(1)
    expect(mock.outboxEvent.upsert).toHaveBeenCalledTimes(1)
    expect(mock.outboxEvent.upsert.mock.calls[0]![0].create.topic).toBe(
      'payment.issue'
    )
    expect(mock.paymentAttempt.findFirst).not.toHaveBeenCalled()
  })
  it('tenant lookup and approval failures retain their original 404/409 before commercial checks', async () => {
    mock.quote.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'PENDING' })
    await expect(
      service().requestQuoteBoletoPayment(principal, 'foreign')
    ).rejects.toMatchObject({ status: 404, policy: undefined })
    await expect(
      service().requestQuoteBoletoPayment(principal, 'pending')
    ).rejects.toMatchObject({ status: 409, policy: undefined })
    expect(mock.$queryRaw).not.toHaveBeenCalled()
  })
})
