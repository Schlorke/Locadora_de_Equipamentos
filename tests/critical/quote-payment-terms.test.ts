import type { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createQuoteWithItems,
  createTestTracker,
  createUser,
} from '../helpers/fixtures'

const sessionState = vi.hoisted(() => ({ userId: 'test-admin' }))

vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => ({ user: { id: sessionState.userId } }),
}))

// Contraparte da API compartilhada (onda 135, E5): a mesma sessão no leitor do serviço (`host/session`), a mesma
// rota montada pelo serviço e o mesmo banco descartável (`getDatabaseRuntime`). A metade da raiz legada sai no F.
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  getServerSession: async () => ({ user: { id: sessionState.userId } }),
}))

const { prisma } = getDatabaseRuntime()
const HOSTS = [
  {
    name: 'legacy root',
    route: () => import('@/app/api/admin/quotes/[id]/route'),
  },
  {
    name: 'service',
    route: () =>
      import('../../apps/services/api/src/app/api/admin/quotes/[id]/route'),
  },
] as const

describe.each(HOSTS)('$name: quote payment terms', ({ route }) => {
  const tracker = createTestTracker()
  let PATCH: Awaited<ReturnType<typeof route>>['PATCH']
  beforeAll(async () => {
    ;({ PATCH } = await route())
  })
  let equipmentId: string
  let clientUserId: string

  beforeAll(async () => {
    const adminUser = await createUser(tracker, {
      role: 'ADMIN',
      email: `admin-at-end-${Date.now()}@example.com`,
    })
    sessionState.userId = adminUser.id

    const clientUser = await createUser(tracker, {
      role: 'CLIENT',
      email: `client-at-end-${Date.now()}@example.com`,
    })
    clientUserId = clientUser.id

    const category = await createCategory(tracker)
    const equipment = await createEquipment(tracker, category.id)
    equipmentId = equipment.id
  })

  afterAll(async () => {
    await cleanupTestData(tracker)
  })

  it('approves and converts quote without upfront payment when paymentTerms is AT_END', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 3,
      userId: clientUserId,
      paymentTerms: 'UPFRONT',
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({
        status: 'APPROVED',
        paymentTerms: 'AT_END',
      }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(200)

    const updatedQuote = await prisma.quote.findUnique({
      where: { id: quote.id },
      select: {
        status: true,
        paymentTerms: true,
        approvedAt: true,
        convertedToRentalId: true,
      },
    })

    expect(updatedQuote?.paymentTerms).toBe('AT_END')
    expect(updatedQuote?.approvedAt).toBeTruthy()
    expect(updatedQuote?.status).toBe('COMPLETED')
    expect(updatedQuote?.convertedToRentalId).toBeTruthy()

    if (!updatedQuote?.convertedToRentalId) {
      return
    }

    const rental = await prisma.rentals.findUnique({
      where: { id: updatedQuote.convertedToRentalId },
      include: { rental_items: true },
    })

    expect(rental).toBeTruthy()
    expect(rental?.quoteId).toBe(quote.id)
    expect(rental?.status).toBe('PENDING')

    // Fluxo AT_END: não deve gerar boleto na aprovação operacional.
    const rentalPayments = await prisma.payment.findMany({
      where: { rentalId: updatedQuote.convertedToRentalId },
    })
    expect(rentalPayments.length).toBe(0)

    tracker.rentals.add(updatedQuote.convertedToRentalId)
    rental?.rental_items.forEach((item) => tracker.rentalItems.add(item.id))
  })
})
