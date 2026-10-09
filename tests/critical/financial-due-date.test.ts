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
    adminFinancialEntriesIdDueDate: () =>
      import('@/app/api/admin/financial/entries/[id]/due-date/route'),
  },
  {
    name: 'service',
    adminFinancialEntriesIdDueDate: () =>
      import('../../apps/services/api/src/app/api/admin/financial/entries/[id]/due-date/route'),
  },
] as const

describe.each(HOSTS)(
  '$name: admin financial due date update',
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
        pricePerDay: 210,
        maxStock: 3,
      })
      const user = await createUser(tracker, {
        role: 'CLIENT',
        email: `due-date-${randomUUID()}@example.com`,
      })

      equipmentId = equipment.id
      userId = user.id
    })

    afterAll(async () => {
      await cleanupTestData(tracker)
    })

    it('queues due-date reissue and preserves the previous issued obligation until cancellation confirmation', async () => {
      const quote = await createQuoteWithItems(tracker, {
        equipmentId,
        quantity: 1,
        days: 3,
        userId,
      })

      const payment = await createPayment(tracker, {
        quoteId: quote.id,
        amount: 300,
        method: 'BOLETO',
        type: 'RENTAL',
        status: 'OVERDUE',
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          billingStatus: 'UNPAID',
          transactionId: 'old-' + payment.id,
        },
      })

      const integration = await prisma.tenantIntegration.create({
        data: {
          tenantId: tracker.tenantId,
          provider: 'ASAAS',
          credentialsRef: 'env:LOCADORA_INTEGRATION_TEST_NOT_READ',
        },
      })
      await prisma.paymentAttempt.create({
        data: {
          tenantId: tracker.tenantId,
          paymentId: payment.id,
          integrationId: integration.id,
          provider: 'ASAAS',
          externalId: 'old-' + payment.id,
          idempotencyKey: 'initial-' + payment.id,
          status: 'ISSUED',
          amount: payment.amount,
          dueDate: payment.dueDate,
        },
      })

      const nextDueDate = new Date()
      nextDueDate.setDate(nextDueDate.getDate() + 7)
      nextDueDate.setHours(12, 0, 0, 0)

      const { PATCH } = await routes.adminFinancialEntriesIdDueDate()
      const request = new NextRequest(
        `http://localhost/api/admin/financial/entries/${payment.id}/due-date`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tracker.tenantId,
          },
          body: JSON.stringify({ dueDate: nextDueDate.toISOString() }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: payment.id }),
      })
      expect(response.status).toBe(202)

      const updated = await prisma.payment.findUnique({
        where: { id: payment.id },
      })
      expect(updated).toBeTruthy()
      expect(updated?.status).toBe('OVERDUE')
      expect(updated?.billingStatus).toBe('UNPAID')
      expect(updated?.dueDate).toEqual(payment.dueDate)
      const result = await response.json()
      const event = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: result.operationId },
      })
      expect(event).toMatchObject({
        tenantId: tracker.tenantId,
        topic: 'payment.boleto.reissue',
        aggregateId: payment.id,
      })
      expect(event.payload).toMatchObject({
        dueDate: nextDueDate.toISOString().slice(0, 10) + 'T12:00:00.000Z',
      })
    })

    it('rejects due date updates for paid entries', async () => {
      const quote = await createQuoteWithItems(tracker, {
        equipmentId,
        quantity: 1,
        days: 2,
        userId,
      })

      const payment = await createPayment(tracker, {
        quoteId: quote.id,
        amount: 250,
        method: 'BOLETO',
        type: 'RENTAL',
        status: 'PAID',
      })

      const nextDueDate = new Date()
      nextDueDate.setDate(nextDueDate.getDate() + 10)
      nextDueDate.setHours(12, 0, 0, 0)

      const { PATCH } = await routes.adminFinancialEntriesIdDueDate()
      const request = new NextRequest(
        `http://localhost/api/admin/financial/entries/${payment.id}/due-date`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tracker.tenantId,
          },
          body: JSON.stringify({ dueDate: nextDueDate.toISOString() }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: payment.id }),
      })
      expect(response.status).toBe(409)
    })
  }
)
