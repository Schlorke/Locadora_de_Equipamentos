import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  createBoletoVerificationService,
  createTenantBoletoVerifier,
} from './boleto-verification'

const principal = {
  tenantId: 'tenant-A',
  userId: 'user-A',
  membershipId: 'member-A',
  role: 'ADMIN' as const,
}
function fixture() {
  const findFirst = vi.fn().mockResolvedValue({
    id: 'payment-A',
    tenantId: principal.tenantId,
    transactionId: 'external-A',
    amount: new Prisma.Decimal(100),
    method: 'BOLETO',
  })
  const attempts = vi.fn().mockResolvedValue({ count: 1 })
  const transaction = vi.fn(async (_context, operation) =>
    operation({
      payment: { findFirst },
      paymentAttempt: { updateMany: attempts },
    })
  )
  const verify = vi.fn().mockResolvedValue({ status: 'pending', amount: 100 })
  const process = vi.fn(),
    convert = vi.fn()
  const service = createBoletoVerificationService({
    withTenantTransaction: transaction,
    withRentalTransaction: transaction,
    verifyTenantBoleto: verify,
    processPayment: process,
    convertPaidQuotePayment: convert,
  })
  return {
    ...service,
    findFirst,
    attempts,
    transaction,
    verify,
    process,
    convert,
  }
}
describe('existing boleto verification behavior', () => {
  it('returns 404 before consulting the provider for another tenant or missing payment', async () => {
    const f = fixture()
    f.findFirst.mockResolvedValue(null)
    expect((await f.verifyBoletoPayment(principal, 'foreign')).status).toBe(404)
    expect(f.verify).not.toHaveBeenCalled()
    expect(f.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', tenantId: principal.tenantId, method: 'BOLETO' },
    })
  })
  it('preserves 202 without a provider reference', async () => {
    const f = fixture()
    f.findFirst.mockResolvedValue({ id: 'payment-A', transactionId: null })
    const response = await f.verifyBoletoPayment(principal, 'payment-A')
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      processing: 'PENDING',
      payment: { id: 'payment-A' },
    })
    expect(f.verify).not.toHaveBeenCalled()
  })
  it('refuses an amount mismatch before any effect', async () => {
    const f = fixture()
    f.verify.mockResolvedValue({ status: 'paid', amount: 99.99 })
    expect((await f.verifyBoletoPayment(principal, 'payment-A')).status).toBe(
      409
    )
    expect(f.process).not.toHaveBeenCalled()
    expect(f.convert).not.toHaveBeenCalled()
  })
  it('cancellation confirms the matching attempt without changing the obligation', async () => {
    const f = fixture()
    f.verify.mockResolvedValue({ status: 'cancelled', amount: 100 })
    expect((await f.verifyBoletoPayment(principal, 'payment-A')).status).toBe(
      200
    )
    expect(f.attempts).toHaveBeenCalledWith({
      where: {
        tenantId: principal.tenantId,
        paymentId: 'payment-A',
        externalId: 'external-A',
        status: { notIn: ['PAID', 'REFUNDED'] },
      },
      data: {
        status: 'CANCELLED',
        cancellationStatus: 'CONFIRMED',
        cancelledAt: expect.any(Date),
      },
    })
    expect(f.process).not.toHaveBeenCalled()
    expect(f.convert).not.toHaveBeenCalled()
  })
  it.each(['pending', 'overdue', 'refunded', 'paid'] as const)(
    'preserves processing and conversion for %s',
    async (status) => {
      const f = fixture(),
        paidAt = new Date('2030-01-01T03:00:00Z')
      f.verify.mockResolvedValue({ status, amount: 100, paidAt })
      expect((await f.verifyBoletoPayment(principal, 'payment-A')).status).toBe(
        200
      )
      expect(f.process).toHaveBeenCalledWith(principal, 'payment-A', {
        status: {
          pending: 'PENDING',
          overdue: 'OVERDUE',
          refunded: 'REFUNDED',
          paid: 'PAID',
        }[status],
        paidAt,
        externalId: 'external-A',
      })
      expect(f.convert).toHaveBeenCalledTimes(status === 'paid' ? 1 : 0)
    }
  )
  it('preserves conversion failure for the HTTP adapter to handle', async () => {
    const f = fixture()
    f.verify.mockResolvedValue({ status: 'paid', amount: 100 })
    f.convert.mockRejectedValue(Error('availability'))
    await expect(f.verifyBoletoPayment(principal, 'payment-A')).rejects.toThrow(
      'availability'
    )
    expect(f.process).toHaveBeenCalledOnce()
  })
})
describe('tenant provider verification wiring', () => {
  function fixture(reference: unknown, credential: unknown) {
    const findFirst = vi.fn().mockResolvedValue(reference)
    const transaction = vi.fn(
      async (
        _context,
        operation,
        _options?: { timeout?: number; maxWait?: number }
      ) => operation({ externalResourceTenant: { findFirst } })
    )
    const resolve = vi.fn().mockResolvedValue(credential)
    const read = vi.fn().mockResolvedValue({ status: 'paid', amount: 100 })
    const service = createTenantBoletoVerifier({
      withTenantTransaction: transaction,
      resolveIntegrationCredential: resolve,
      readPayment: read,
    })
    return { ...service, findFirst, transaction, resolve, read }
  }
  const reference = {
    integration: {
      tenantId: 'tenant-A',
      status: 'ACTIVE',
      credentialsRef: 'env:LOCADORA_INTEGRATION_ONE',
    },
  }
  const payment = { id: 'payment-A', transactionId: 'external-A' }
  it('uses the scoped mapping, original transaction budget and explicit credentials', async () => {
    const f = fixture(reference, {
      signingSecret: 'one',
      apiKey: 'tenant-key',
      environment: 'sandbox',
    })
    await expect(f.verifyTenantBoleto(principal, payment)).resolves.toEqual({
      status: 'paid',
      amount: 100,
    })
    expect(f.transaction.mock.calls[0]![2]).toEqual({
      timeout: 5000,
      maxWait: 3000,
    })
    expect(f.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-A',
        provider: 'ASAAS',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        externalId: payment.transactionId,
      },
      include: { integration: true },
    })
    expect(f.read).toHaveBeenCalledWith(payment.transactionId, {
      apiKey: 'tenant-key',
      environment: 'sandbox',
    })
  })
  it.each([
    null,
    { integration: { ...reference.integration, tenantId: 'tenant-B' } },
    { integration: { ...reference.integration, status: 'DISABLED' } },
  ])('refuses unavailable or unrelated mapping', async (value) => {
    const f = fixture(value, { apiKey: 'key', environment: 'sandbox' })
    await expect(f.verifyTenantBoleto(principal, payment)).rejects.toThrow(
      'integration unavailable'
    )
    expect(f.resolve).not.toHaveBeenCalled()
    expect(f.read).not.toHaveBeenCalled()
  })
  it.each([
    null,
    { apiKey: '', environment: 'sandbox' },
    { apiKey: 'key', environment: 'other' },
  ])(
    'refuses missing credentials without provider access',
    async (credential) => {
      const f = fixture(reference, credential)
      await expect(f.verifyTenantBoleto(principal, payment)).rejects.toThrow(
        'credentials unavailable'
      )
      expect(f.read).not.toHaveBeenCalled()
    }
  )
})
