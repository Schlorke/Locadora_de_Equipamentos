import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  rental: vi.fn(),
  quote: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  existing: vi.fn(),
  profile: vi.fn(),
  integrations: vi.fn(),
  attempt: vi.fn(),
  enqueue: vi.fn(),
  cancelled: vi.fn(),
}))
vi.mock('@gb-locacoes/backend/outbox', () => ({ enqueueOutbox: mocks.enqueue }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.access,
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: async (
    _context: unknown,
    operation: (tx: unknown) => unknown
  ) =>
    operation({
      $executeRaw: vi.fn(),
      organization: { findUnique: async () => ({ status: 'ACTIVE' }) },
      rentals: { findFirst: mocks.rental },
      quote: { findFirst: mocks.quote },
      payment: {
        aggregate: mocks.aggregate,
        create: mocks.create,
        findFirst: mocks.existing,
        findMany: mocks.cancelled,
      },
      clientProfile: { findFirst: mocks.profile },
      tenantIntegration: { findMany: mocks.integrations },
      // No receiving account: the legacy environment reference keeps its rules (wave 134 barrier).
      paymentAccount: { findFirst: async () => null },
      paymentAttempt: { upsert: mocks.attempt },
      permission: { findFirst: vi.fn() },
    }),
}))
import { isObligationSettled } from '@gb-locacoes/domain/locacao'
import { POST as serviceBoleto } from '../../apps/services/api/src/app/api/payments/boleto/generate/route'
import { POST as servicePix } from '../../apps/services/api/src/app/api/payments/pix/route'
const principal = {
  userId: 'client-a',
  tenantId: 'tenant-a',
  role: 'CLIENT',
  membershipId: 'member-a',
}
const request = (body: object) =>
  new NextRequest('http://localhost/api/payments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'tenant-a' },
  })
const payload = {
  rentalId: 'rental-b',
  amount: 100,
  dueDate: '2026-10-01T00:00:00Z',
  customerName: 'Attacker',
  customerDocument: '000',
  customerEmail: 'attacker@example.test',
}
afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
  vi.resetAllMocks()
  mocks.access.mockResolvedValue({ ok: true, principal })
  mocks.rental.mockResolvedValue({
    id: 'rental-b',
    tenantId: 'tenant-a',
    userid: 'client-b',
    total: 100,
    status: 'PENDING',
  })
  mocks.aggregate.mockResolvedValue({ _sum: { amount: null } })
  mocks.create.mockImplementation(async ({ data }) => ({
    id: 'payment-id',
    ...data,
    transactionId: null,
  }))
  mocks.profile.mockResolvedValue({
    name: 'Customer B',
    email: 'b@example.test',
    document: '12345678909',
  })
  mocks.integrations.mockResolvedValue([
    { id: 'integration-a', credentialsRef: 'env:LOCADORA_INTEGRATION_UNIT' },
  ])
  vi.stubEnv('LOCADORA_INTEGRATION_UNIT_SECRET', 'local-unit-secret')
  vi.stubEnv('LOCADORA_INTEGRATION_UNIT_API_KEY', 'fixture')
  vi.stubEnv('LOCADORA_INTEGRATION_UNIT_ENVIRONMENT', 'sandbox')
  mocks.existing.mockResolvedValue(null)
  // Sem cobrança CANCELLED com transactionId: nada a provar no provedor.
  mocks.cancelled.mockResolvedValue([])
})
describe.each([
  ['service boleto', serviceBoleto],
  ['service pix', servicePix],
] as const)('%s authorization', (_name, handler) => {
  it('rejects anonymous requests before any resource lookup', async () => {
    mocks.access.mockResolvedValue({
      ok: false,
      response: Response.json({}, { status: 401 }),
    })
    expect((await handler(request(payload))).status).toBe(401)
    expect(mocks.rental).not.toHaveBeenCalled()
  })
  it('does not let client A create payment for client B', async () => {
    expect((await handler(request(payload))).status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('uses the validated tenant on resource lookup', async () => {
    mocks.rental.mockResolvedValue(null)
    expect((await handler(request(payload))).status).toBe(404)
    expect(mocks.rental).toHaveBeenCalledWith({
      where: { id: 'rental-b', tenantId: 'tenant-a' },
    })
  })
  it('does not create a second full obligation using another payment method', async () => {
    mocks.access.mockResolvedValue({
      ok: true,
      principal: { ...principal, userId: 'client-b' },
    })
    mocks.existing.mockResolvedValue({
      method: _name.endsWith('pix') ? 'BOLETO' : 'PIX',
    })
    expect((await handler(request(payload))).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('rejects mixed rental and quote references', async () => {
    expect(
      (await handler(request({ ...payload, quoteId: 'quote-b' }))).status
    ).toBe(400)
    expect(mocks.rental).not.toHaveBeenCalled()
  })
  it('rejects a tampered amount on an owned resource', async () => {
    mocks.access.mockResolvedValue({
      ok: true,
      principal: { ...principal, userId: 'client-b' },
    })
    expect((await handler(request({ ...payload, amount: 0.01 }))).status).toBe(
      400
    )
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects a fully paid obligation including deposits', async () => {
    mocks.access.mockResolvedValue({
      ok: true,
      principal: { ...principal, userId: 'client-b' },
    })
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
    expect((await handler(request(payload))).status).toBe(409)
    expect(mocks.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          type: { in: ['RENTAL', 'DEPOSIT'] },
        }),
      })
    )
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
it('queues the canonical balance without issuing a fake payment or using body payer fields', async () => {
  mocks.access.mockResolvedValue({
    ok: true,
    principal: { ...principal, userId: 'client-b' },
  })
  mocks.aggregate.mockResolvedValue({ _sum: { amount: 40 } })
  const response = await serviceBoleto(request({ ...payload, amount: 60 }))
  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({
    processing: 'PENDING',
    boleto: null,
    payment: { amount: '60' },
  })
  expect(mocks.profile).toHaveBeenCalledWith({
    where: { tenantId: 'tenant-a', userId: 'client-b' },
  })
  expect(mocks.enqueue).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ tenantId: 'tenant-a', topic: 'payment.issue' })
  )
})
it('charges the cents balance under the same settlement rule as the quote conversion', async () => {
  mocks.access.mockResolvedValue({
    ok: true,
    principal: { ...principal, userId: 'client-b' },
  })
  // Total legado fora de centavos e um pagamento anterior também fora de centavos.
  mocks.rental.mockResolvedValue({
    id: 'rental-b',
    tenantId: 'tenant-a',
    userid: 'client-b',
    total: '10.005',
    status: 'PENDING',
  })
  mocks.aggregate.mockResolvedValue({ _sum: { amount: '5.004' } })
  // Saldo = 10.01 (total em centavos) − 5.00 (pago em centavos) = 5.01.
  const response = await servicePix(request({ ...payload, amount: 5.01 }))
  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({ payment: { amount: '5.01' } })
  // Cobrar esse saldo quita a obrigação pela mesma regra que converte o orçamento e libera o estoque.
  expect(
    isObligationSettled('10.005', [
      { type: 'DEPOSIT', status: 'PAID', amount: '5.004' },
      { type: 'DEPOSIT', status: 'PAID', amount: '5.01' },
    ])
  ).toBe(true)
})
it('does not create payment when this tenant has no configured provider', async () => {
  mocks.access.mockResolvedValue({
    ok: true,
    principal: { ...principal, userId: 'client-b' },
  })
  mocks.integrations.mockResolvedValue([])
  expect((await servicePix(request(payload))).status).toBe(503)
  expect(mocks.create).not.toHaveBeenCalled()
})
