import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

import { processPayment as serviceProcessPayment } from '../../apps/services/api/src/host/payment-webhooks'
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

// Contraparte da API compartilhada (onda 135, E5): a mesma regra pela composição do serviço
// (`apps/services/api/src/host/*`), sobre o mesmo banco descartável (`getDatabaseRuntime`). A fachada da raiz legada
// sai no bloco F; a do serviço fica.
const { prisma } = getDatabaseRuntime()
const HOSTS = [
  { name: 'service', processPayment: serviceProcessPayment },
] as const

describe.each(HOSTS)('$name: payment processing', ({ processPayment }) => {
  const tracker = createTestTracker()
  let categoryId: string
  let userId: string

  beforeAll(async () => {
    const category = await createCategory(tracker)
    categoryId = category.id
    const user = await createUser(tracker)
    userId = user.id
  })

  afterAll(async () => {
    await cleanupTestData(tracker)
  })

  it('approves quote after payment when approvedAt is set', async () => {
    const equipment = await createEquipment(tracker, categoryId)
    const quote = await createQuoteWithItems(tracker, {
      equipmentId: equipment.id,
      userId,
    })

    await prisma.quote.update({
      where: { id: quote.id },
      data: { approvedAt: new Date(), approvedBy: userId },
    })

    const payment = await createPayment(tracker, {
      quoteId: quote.id,
      status: 'PENDING',
      type: 'RENTAL',
    })

    await processPayment({ tenantId: tracker.tenantId }, payment.id, {
      status: 'PAID',
      paidAt: new Date(),
    })

    const updatedQuote = await prisma.quote.findUnique({
      where: { id: quote.id },
      select: { status: true },
    })

    expect(updatedQuote?.status).toBe('APPROVED')
  })

  it('does not activate a paid rental before physical checkout', async () => {
    const equipment = await createEquipment(tracker, categoryId)
    const { rental } = await createRentalWithItem(tracker, {
      equipmentId: equipment.id,
      userId,
      status: 'PENDING',
    })

    await createPayment(tracker, {
      rentalId: rental.id,
      status: 'PAID',
      type: 'RENTAL',
    })

    const pendingPayment = await createPayment(tracker, {
      rentalId: rental.id,
      status: 'PENDING',
      type: 'RENTAL',
    })

    await processPayment({ tenantId: tracker.tenantId }, pendingPayment.id, {
      status: 'PAID',
      paidAt: new Date(),
    })

    const updatedRental = await prisma.rentals.findUnique({
      where: { id: rental.id },
      select: { status: true },
    })

    expect(updatedRental?.status).toBe('PENDING')
  })
})
