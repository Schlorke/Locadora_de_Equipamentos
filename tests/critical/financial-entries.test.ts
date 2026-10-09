import { randomUUID } from 'node:crypto'

import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createPayment,
  createQuoteWithItems,
  createRentalWithItem,
  createTestTracker,
  createUser,
} from '../helpers/fixtures'

let sessionUserId: string
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => ({ user: { id: sessionUserId } }),
}))

// Contraparte da API compartilhada (onda 135, E5): a mesma sessão no leitor do serviço (`host/session`), as mesmas
// rotas montadas pelo serviço e o mesmo banco descartável (`getDatabaseRuntime`). A metade da raiz legada sai no F.
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  getServerSession: async () => ({ user: { id: sessionUserId } }),
}))

const { prisma } = getDatabaseRuntime()
const HOSTS = [
  {
    name: 'legacy root',
    adminFinancialEntries: () =>
      import('@/app/api/admin/financial/entries/route'),
  },
  {
    name: 'service',
    adminFinancialEntries: () =>
      import('../../apps/services/api/src/app/api/admin/financial/entries/route'),
  },
] as const

describe.each(HOSTS)(
  '$name: admin financial entries',
  ({ name: _host, ...routes }) => {
    const tracker = createTestTracker()
    let equipmentId: string
    let userId: string

    beforeAll(async () => {
      const operator = await createUser(tracker, { role: 'FINANCIAL' })
      sessionUserId = operator.id
      await prisma.permission.createMany({
        data: ['READ', 'WRITE'].map((action) => ({
          tenantId: tracker.tenantId,
          role: 'FINANCIAL' as const,
          module: 'FINANCIAL',
          action,
        })),
      })
      const category = await createCategory(tracker)
      const equipment = await createEquipment(tracker, category.id, {
        pricePerDay: 200,
        maxStock: 3,
      })
      const user = await createUser(tracker, { role: 'CLIENT' })

      equipmentId = equipment.id
      userId = user.id
    })

    afterAll(async () => {
      await cleanupTestData(tracker)
    })

    it('returns converted payments linked only by rentalId', async () => {
      const quote = await createQuoteWithItems(tracker, {
        equipmentId,
        quantity: 1,
        days: 5,
        userId,
        status: 'COMPLETED',
      })

      const quoteCode = `Q-TST-${randomUUID().slice(0, 8).toUpperCase()}`
      await prisma.quote.update({
        where: { id: quote.id },
        data: { quoteCode },
      })

      const { rental } = await createRentalWithItem(tracker, {
        equipmentId,
        userId,
        quoteId: quote.id,
        status: 'PENDING',
      })

      const convertedPayment = await createPayment(tracker, {
        rentalId: rental.id,
        amount: 450,
        method: 'BOLETO',
        type: 'RENTAL',
        status: 'PENDING',
      })

      await prisma.payment.update({
        where: { id: convertedPayment.id },
        data: {
          billingStatus: 'AWAITING_PAYMENT',
        },
      })

      const { GET } = await routes.adminFinancialEntries()
      const request = new NextRequest(
        `http://localhost/api/admin/financial/entries?search=${encodeURIComponent(quoteCode)}`,
        { headers: { 'x-tenant-id': tracker.tenantId } }
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const payload = (await response.json()) as {
        entries: Array<{
          paymentId: string
          quoteId: string | null
          quoteCode: string | null
          rentalId?: string | null
        }>
        totals: { count: number }
      }

      expect(payload.entries.length).toBe(1)
      expect(payload.entries[0]?.paymentId).toBe(convertedPayment.id)
      expect(payload.entries[0]?.quoteId).toBe(quote.id)
      expect(payload.entries[0]?.quoteCode).toBe(quoteCode)
      expect(payload.entries[0]?.rentalId).toBe(rental.id)
      expect(payload.totals.count).toBe(1)
    })
  }
)
