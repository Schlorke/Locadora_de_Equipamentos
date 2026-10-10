import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createRentalAvailability } from '@gb-locacoes/backend/rentals'

import { withTenantTransaction as serviceTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
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
// O serviço monta a disponibilidade com o próprio executor de transação por locadora (`host/tenant-transaction`),
// como `host/quotations` e `host/rentals` fazem.
const HOSTS = [
  {
    name: 'service',
    load: async () =>
      createRentalAvailability({
        withTenantTransaction: (context, operation) =>
          serviceTenantTransaction(context, operation),
      }).calculateEquipmentAvailability,
  },
] as const

describe.each(HOSTS)('$name: stock blocking rules', ({ load }) => {
  const tracker = createTestTracker()
  let calculateEquipmentAvailability: Awaited<ReturnType<typeof load>>
  beforeAll(async () => {
    calculateEquipmentAvailability = await load()
  })
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

  it('does not block stock for pending rental with quote and unpaid', async () => {
    const equipment = await createEquipment(tracker, categoryId, {
      maxStock: 2,
    })
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 2 * 86400000)

    const quote = await createQuoteWithItems(tracker, {
      equipmentId: equipment.id,
      userId,
      startDate,
      endDate,
    })

    await createRentalWithItem(tracker, {
      equipmentId: equipment.id,
      userId,
      quoteId: quote.id,
      status: 'PENDING',
      startDate,
      endDate,
    })

    const availability = await calculateEquipmentAvailability(
      { tenantId: tracker.tenantId },
      equipment.id,
      startDate,
      endDate
    )

    expect(availability.blockedByRentals).toBe(0)
    expect(availability.availableQuantity).toBe(2)
  })

  it('blocks stock for pending rental when payment is paid', async () => {
    const equipment = await createEquipment(tracker, categoryId, {
      maxStock: 2,
    })
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 86400000)

    const quote = await createQuoteWithItems(tracker, {
      equipmentId: equipment.id,
      userId,
      startDate,
      endDate,
    })

    const { rental } = await createRentalWithItem(tracker, {
      equipmentId: equipment.id,
      userId,
      quoteId: quote.id,
      status: 'PENDING',
      startDate,
      endDate,
    })

    await createPayment(tracker, {
      rentalId: rental.id,
      amount: 300,
      status: 'PAID',
      type: 'RENTAL',
    })

    const availability = await calculateEquipmentAvailability(
      { tenantId: tracker.tenantId },
      equipment.id,
      startDate,
      endDate
    )

    expect(availability.blockedByRentals).toBe(1)
    expect(availability.availableQuantity).toBe(1)
  })

  it('blocks stock for active rentals regardless of payment', async () => {
    const equipment = await createEquipment(tracker, categoryId, {
      maxStock: 1,
    })
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 86400000)

    await createRentalWithItem(tracker, {
      equipmentId: equipment.id,
      userId,
      status: 'ACTIVE',
      startDate,
      endDate,
    })

    const availability = await calculateEquipmentAvailability(
      { tenantId: tracker.tenantId },
      equipment.id,
      startDate,
      endDate
    )

    expect(availability.blockedByRentals).toBe(1)
    expect(availability.available).toBe(false)
  })
})
