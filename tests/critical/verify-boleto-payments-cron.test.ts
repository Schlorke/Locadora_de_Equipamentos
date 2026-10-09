import { randomUUID } from 'node:crypto'

import { NextRequest } from 'next/server'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createPayment,
  createTestTracker,
  ensureTestTenant,
} from '../helpers/fixtures'

const { verifyPaymentMock, processPaymentMock } = vi.hoisted(() => ({
  verifyPaymentMock: vi.fn(),
  processPaymentMock: vi.fn(),
}))

vi.mock('@/lib/security/tenant-boleto-verification', () => ({
  verifyTenantBoleto: verifyPaymentMock,
}))

vi.mock('@/lib/payment-processor', () => ({
  processPayment: processPaymentMock,
}))

vi.mock('@/lib/quote-payment-conversion', () => ({
  convertPaidQuotePayment: vi.fn(),
}))

// Contraparte da API compartilhada (onda 135, E5): a mesma rota de cron montada pelo serviço, com o mesmo verificador
// de boleto e processador como dublês (`host/payment-webhooks`) e o mesmo banco descartável. A metade legada sai no F.
vi.mock(
  '../../apps/services/api/src/host/payment-webhooks',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/payment-webhooks')
    >()),
    verifyTenantBoleto: verifyPaymentMock,
    processPayment: processPaymentMock,
  })
)

const { prisma } = getDatabaseRuntime()
const HOSTS = [
  {
    name: 'legacy root',
    route: () => import('@/app/api/cron/verify-boleto-payments/route'),
  },
  {
    name: 'service',
    route: () =>
      import('../../apps/services/api/src/app/api/cron/verify-boleto-payments/route'),
  },
] as const

function createCronRequest() {
  const headers = new Headers()
  if (process.env.CRON_SECRET) {
    headers.set('authorization', `Bearer ${process.env.CRON_SECRET}`)
  }

  return new NextRequest('http://localhost/api/cron/verify-boleto-payments', {
    headers,
  })
}

describe.each(HOSTS)('$name: verify boleto payments cron', ({ route }) => {
  const tracker = createTestTracker()
  beforeAll(() => {
    // Run the real job and SQL only for this fixture, leaving concurrently tested locadoras alone.
    const findOrganizations = prisma.organization.findMany.bind(
      prisma.organization
    )
    vi.spyOn(prisma.organization, 'findMany').mockImplementation((args) =>
      findOrganizations({
        ...args,
        where: { ...args?.where, id: tracker.tenantId },
      })
    )
  })

  beforeEach(async () => {
    await ensureTestTenant(tracker)
    vi.stubEnv('CRON_SECRET', 'test-cron-fixture-secret')
    verifyPaymentMock.mockReset()
    processPaymentMock.mockReset()
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await cleanupTestData(tracker)
  })

  it('marks boleto as overdue with matching billingStatus', async () => {
    const payment = await createPayment(tracker, {
      amount: 250,
      method: 'BOLETO',
      type: 'RENTAL',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      transactionId: `txn-${randomUUID()}`,
    })

    verifyPaymentMock.mockResolvedValue({
      status: 'overdue',
      paidAt: null,
    })

    const { GET } = await route()
    const request = createCronRequest()

    const response = await GET(request)
    expect(response.status).toBe(200)

    const updated = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: {
        status: true,
        billingStatus: true,
      },
    })

    expect(updated?.status).toBe('OVERDUE')
    expect(updated?.billingStatus).toBe('UNPAID')
  })

  it('marks expired pending boleto as overdue even when gateway returns pending', async () => {
    const dueDateInPast = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const payment = await createPayment(tracker, {
      amount: 300,
      method: 'BOLETO',
      type: 'RENTAL',
      status: 'PENDING',
      dueDate: dueDateInPast,
      transactionId: `txn-${randomUUID()}`,
    })

    verifyPaymentMock.mockResolvedValue({
      status: 'pending',
      paidAt: null,
    })

    const { GET } = await route()
    const request = createCronRequest()

    const response = await GET(request)
    expect(response.status).toBe(200)

    const updated = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: {
        status: true,
        billingStatus: true,
      },
    })

    expect(updated?.status).toBe('OVERDUE')
    expect(updated?.billingStatus).toBe('UNPAID')
  })
})
