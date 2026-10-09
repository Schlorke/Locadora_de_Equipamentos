import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createTestTracker,
} from '../helpers/fixtures'

// O banco descartável pelo runtime do backend, o mesmo que a API compartilhada usa (onda 135, E4).
const { prisma } = getDatabaseRuntime()
const tracker = createTestTracker()

describe('critical quote flow', () => {
  let equipmentId: string

  beforeAll(async () => {
    const category = await createCategory(tracker)
    const equipment = await createEquipment(tracker, category.id, {
      pricePerDay: 200,
      maxStock: 2,
    })
    equipmentId = equipment.id
  })

  afterAll(async () => {
    await cleanupTestData(tracker)
  })

  it('creates a tenant quote and durable notification before any billing approval', async () => {
    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3101'
    const response = await fetch(`${baseUrl}/api/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: tracker.tenantSlug,
        customerName: 'Test Customer',
        customerEmail: 'test.customer@example.com',
        customerPhone: '11999990000',
        cpf: '00816437050',
        items: [
          {
            equipmentId,
            quantity: 1,
            days: 7,
          },
        ],
      }),
    })

    expect(response.status).toBe(201)
    const data = (await response.json()) as { id?: string }
    expect(data.id).toBeTruthy()

    const quote = await prisma.quote.findUnique({
      where: { id: data.id },
      include: { items: true, payments: true },
    })

    expect(quote).toBeTruthy()
    if (!quote) return

    tracker.quotes.add(quote.id)
    quote.items.forEach((item) => tracker.quoteItems.add(item.id))
    quote.payments.forEach((payment) => tracker.payments.add(payment.id))

    expect(quote.status).toBe('PENDING')
    expect(quote.originalTotal).not.toBeNull()
    expect(quote.items.length).toBe(1)
    expect(quote.items[0]?.startDate).not.toBeNull()
    expect(quote.items[0]?.endDate).not.toBeNull()

    expect(quote.tenantId).toBe(tracker.tenantId)
    expect(quote.payments).toHaveLength(0)
    expect(
      await prisma.outboxEvent.count({
        where: {
          tenantId: tracker.tenantId,
          topic: 'quote.created.notify',
          aggregateId: quote.id,
        },
      })
    ).toBe(1)
  })
})
