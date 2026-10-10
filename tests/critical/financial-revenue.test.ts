import { randomUUID } from 'node:crypto'

import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import Decimal from 'decimal.js'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createPayment,
  createRentalWithItem,
  createTestTracker,
  createUser,
} from '../helpers/fixtures'

let sessionUserId: string

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
    name: 'service',
    adminFinancialRevenue: () =>
      import('../../apps/services/api/src/app/api/admin/financial/revenue/route'),
  },
] as const

describe.each(HOSTS)(
  '$name: admin financial revenue',
  ({ name: _host, ...routes }) => {
    const tracker = createTestTracker()
    let userId: string
    let equipmentAId: string
    let equipmentBId: string
    let categoryAName: string
    let categoryBName: string

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
      const unique = randomUUID().slice(0, 8)
      const categoryA = await createCategory(tracker, {
        name: `Categoria A ${unique}`,
        slug: `categoria-a-${unique}`,
      })
      const categoryB = await createCategory(tracker, {
        name: `Categoria B ${unique}`,
        slug: `categoria-b-${unique}`,
      })
      const equipmentA = await createEquipment(tracker, categoryA.id, {
        pricePerDay: 100,
        maxStock: 2,
      })
      const equipmentB = await createEquipment(tracker, categoryB.id, {
        pricePerDay: 300,
        maxStock: 2,
      })
      const user = await createUser(tracker, { role: 'CLIENT' })

      userId = user.id
      equipmentAId = equipmentA.id
      equipmentBId = equipmentB.id
      categoryAName = categoryA.name
      categoryBName = categoryB.name
    })

    afterAll(async () => {
      await cleanupTestData(tracker)
    })

    it('allocates payment amount proportionally across rental item categories', async () => {
      const { rental, rentalItem } = await createRentalWithItem(tracker, {
        equipmentId: equipmentAId,
        userId,
        status: 'PENDING',
      })

      await prisma.rental_items.update({
        where: { id: rentalItem.id },
        data: {
          priceperday: new Decimal(100),
          totalprice: new Decimal(100),
          totaldays: 1,
        },
      })

      const secondRentalItem = await prisma.rental_items.create({
        data: {
          id: `rental-item-${randomUUID()}`,
          tenantId: tracker.tenantId,
          rentalid: rental.id,
          equipmentid: equipmentBId,
          quantity: 1,
          priceperday: new Decimal(300),
          totaldays: 1,
          totalprice: new Decimal(300),
        },
      })
      tracker.rentalItems.add(secondRentalItem.id)

      const payment = await createPayment(tracker, {
        rentalId: rental.id,
        amount: 400,
        method: 'BOLETO',
        type: 'RENTAL',
        status: 'PAID',
        dueDate: new Date(),
        transactionId: `txn-${randomUUID()}`,
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          billingStatus: 'PAID',
          paidAt: new Date(),
        },
      })

      const { GET } = await routes.adminFinancialRevenue()
      const request = new NextRequest(
        'http://localhost/api/admin/financial/revenue?status=PAID&months=1',
        { headers: { 'x-tenant-id': tracker.tenantId } }
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const payload = (await response.json()) as {
        revenueByCategory: Array<{ categoryName: string; revenue: number }>
      }

      const categoryA = payload.revenueByCategory.find(
        (item) => item.categoryName === categoryAName
      )
      const categoryB = payload.revenueByCategory.find(
        (item) => item.categoryName === categoryBName
      )

      expect(categoryA).toBeTruthy()
      expect(categoryB).toBeTruthy()
      expect(categoryA?.revenue).toBeCloseTo(100, 2)
      expect(categoryB?.revenue).toBeCloseTo(300, 2)

      // Somar apenas as categorias do teste (outras podem existir de testes paralelos)
      const totalByCategory =
        (categoryA?.revenue ?? 0) + (categoryB?.revenue ?? 0)
      expect(totalByCategory).toBeCloseTo(400, 2)
    })
  }
)
