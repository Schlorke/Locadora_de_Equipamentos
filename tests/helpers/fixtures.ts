import { randomUUID } from 'node:crypto'

import Decimal from 'decimal.js'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { buildQuotePricing } from '@gb-locacoes/domain/orcamento'
import { publishTestOrganizations } from './public-site'

type TrackerKey =
  | 'categories'
  | 'equipments'
  | 'users'
  | 'quotes'
  | 'quoteItems'
  | 'payments'
  | 'rentals'
  | 'rentalItems'

/**
 * O cliente do runtime do backend (o mesmo singleton que a API compartilhada usa), lido na hora da chamada e nunca no
 * import: as fixtures não dependem da fachada `@/lib/prisma` da raiz legada (onda 135, E4).
 */
const database = () => getDatabaseRuntime().prisma

export type TestTracker = Record<TrackerKey, Set<string>> & {
  tenantId: string
  tenantSlug: string
}

export function createTestTracker(): TestTracker {
  const tenantId = `fixture-${randomUUID()}`
  return {
    tenantId,
    tenantSlug: tenantId,
    categories: new Set<string>(),
    equipments: new Set<string>(),
    users: new Set<string>(),
    quotes: new Set<string>(),
    quoteItems: new Set<string>(),
    payments: new Set<string>(),
    rentals: new Set<string>(),
    rentalItems: new Set<string>(),
  }
}

export function getTestRunId() {
  return process.env.TEST_RUN_ID || `test-${Date.now()}`
}

export async function cleanupTestData(tracker: TestTracker) {
  if (!tracker.tenantId?.startsWith('fixture-') || !tracker.tenantSlug)
    throw new Error('Explicit fixture tenant required for cleanup')
  const where = { tenantId: tracker.tenantId }
  // Only this test's explicitly created organization; never infer ownership from production IDs.
  await database().outboxEvent.deleteMany({ where })
  await database().notification.deleteMany({ where })
  await database().auditLog.deleteMany({ where })
  await database().externalResourceTenant.deleteMany({ where })
  await database().paymentAttempt.deleteMany({ where })
  await database().payment.deleteMany({ where })
  await database().tenantIntegration.deleteMany({ where })
  await database().permission.deleteMany({ where })
  await database().quoteAdjustment.deleteMany({ where })
  await database().quote.updateMany({
    where,
    data: { convertedToRentalId: null },
  })
  await database().rental_items.deleteMany({ where })
  await database().rentals.deleteMany({ where })
  await database().quoteItem.deleteMany({ where })
  await database().quote.deleteMany({ where })
  await database().equipmentUnit.deleteMany({ where })
  await database().equipment.deleteMany({ where })
  await database().category.deleteMany({ where })
  await database().financialSetting.deleteMany({ where })
  await database().setting.deleteMany({ where })
  await database().address.deleteMany({ where })
  await database().clientProfile.deleteMany({ where })
  await database().membership.deleteMany({ where })
  await database().user.deleteMany({
    where: { id: { in: [...tracker.users] } },
  })
  await database().organization.deleteMany({ where: { id: tracker.tenantId } })
  tenantSetup.delete(tracker)
}

const tenantSetup = new WeakMap<TestTracker, Promise<void>>()
export async function ensureTestTenant(tracker: TestTracker) {
  if (!tracker.tenantId?.startsWith('fixture-') || !tracker.tenantSlug)
    throw new Error('Explicit fixture tenant required')
  let ready = tenantSetup.get(tracker)
  if (!ready) {
    ready = database()
      .organization.upsert({
        where: { id: tracker.tenantId },
        create: {
          id: tracker.tenantId,
          slug: tracker.tenantSlug,
          name: 'Test locadora',
        },
        update: {},
      })
      // Locadora viva, como as que a migration 0104 publicou: a vitrine pública fica no ar (S13).
      .then(() => publishTestOrganizations(database(), [tracker.tenantId]))
    tenantSetup.set(tracker, ready)
  }
  await ready
}

export async function createCategory(
  tracker: TestTracker,
  overrides: Partial<{
    name: string
    slug: string
  }> = {}
) {
  await ensureTestTenant(tracker)
  const runId = getTestRunId()
  const unique = randomUUID().slice(0, 8)
  const category = await database().category.create({
    data: {
      tenantId: tracker.tenantId,
      name: overrides.name || `Test Category ${runId} ${unique}`,
      slug: overrides.slug || `test-category-${runId}-${unique}`,
      iconColor: '#ea580c',
      bgColor: '#fff7ed',
      fontColor: '#7c2d12',
    },
  })
  tracker.categories.add(category.id)
  return category
}

export async function createEquipment(
  tracker: TestTracker,
  categoryId: string,
  overrides: Partial<{
    name: string
    pricePerDay: number
    maxStock: number
    available: boolean
  }> = {}
) {
  await ensureTestTenant(tracker)
  const runId = getTestRunId()
  const unique = randomUUID().slice(0, 8)
  const equipment = await database().equipment.create({
    data: {
      tenantId: tracker.tenantId,
      name: overrides.name || `Test Equipment ${runId} ${unique}`,
      pricePerDay: new Decimal(overrides.pricePerDay ?? 150),
      images: ['https://example.com/test-image.png'],
      available: overrides.available ?? true,
      maxStock: overrides.maxStock ?? 2,
      categoryId,
    },
  })
  tracker.equipments.add(equipment.id)
  return equipment
}

export async function createUser(
  tracker: TestTracker,
  overrides: Partial<{
    name: string
    email: string
    role: 'ADMIN' | 'FINANCIAL' | 'OPERATOR' | 'CLIENT'
  }> = {}
) {
  await ensureTestTenant(tracker)
  const runId = getTestRunId()
  const unique = randomUUID().slice(0, 8)
  const user = await database().user.create({
    data: {
      name: overrides.name || `Test User ${runId} ${unique}`,
      email: overrides.email || `test-${runId}-${unique}@example.com`,
      role: overrides.role || 'CLIENT',
      emailVerified: new Date(),
    },
  })
  await database().membership.create({
    data: {
      tenantId: tracker.tenantId,
      userId: user.id,
      role: overrides.role || 'CLIENT',
    },
  })
  await database().clientProfile.create({
    data: {
      tenantId: tracker.tenantId,
      userId: user.id,
      name: user.name!,
      email: user.email,
    },
  })
  tracker.users.add(user.id)
  return user
}

export async function createQuoteWithItems(
  tracker: TestTracker,
  options: {
    equipmentId: string
    quantity?: number
    days?: number
    startDate?: Date
    endDate?: Date
    includeWeekends?: boolean
    userId?: string
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
    paymentTerms?: 'UPFRONT' | 'ON_DELIVERY' | 'AT_END'
  }
) {
  await ensureTestTenant(tracker)
  const runId = getTestRunId()
  const equipment = await database().equipment.findUnique({
    where: { id: options.equipmentId },
  })

  if (!equipment) {
    throw new Error('Equipment not found for quote fixture')
  }

  const quantity = options.quantity ?? 1
  const days = options.days ?? 7
  const startDate = options.startDate || new Date()
  const endDate =
    options.endDate || new Date(startDate.getTime() + (days - 1) * 86400000)

  const pricing = buildQuotePricing(equipment, days, quantity)
  const totalAmount = pricing.total

  const quote = await database().quote.create({
    data: {
      tenantId: tracker.tenantId,
      name: `Test Quote ${runId}`,
      email: `quote-${runId}@example.com`,
      phone: '11999999999',
      total: totalAmount,
      originalTotal: totalAmount,
      status: options.status || 'PENDING',
      approvedAt: ['APPROVED', 'COMPLETED'].includes(
        options.status ?? 'PENDING'
      )
        ? new Date()
        : null,
      paymentTerms: options.paymentTerms || 'UPFRONT',
      startDate,
      endDate,
      userId: options.userId,
      items: {
        create: [
          {
            tenantId: tracker.tenantId,
            equipmentId: options.equipmentId,
            quantity,
            days,
            pricePerDay: pricing.pricePerDay,
            total: pricing.total,
            startDate,
            endDate,
            includeWeekends: options.includeWeekends ?? false,
            appliedDiscount: pricing.pricingConfig.useDirectValue
              ? null
              : pricing.pricingConfig.discount || null,
            appliedPeriod: pricing.appliedPeriod || null,
            useDirectValue: pricing.pricingConfig.useDirectValue || false,
            directValue: pricing.pricingConfig.useDirectValue
              ? pricing.pricingConfig.directValue || null
              : null,
          },
        ],
      },
    },
    include: {
      items: true,
    },
  })

  tracker.quotes.add(quote.id)
  quote.items.forEach((item) => tracker.quoteItems.add(item.id))

  return quote
}

export async function createRentalWithItem(
  tracker: TestTracker,
  options: {
    equipmentId: string
    userId: string
    quoteId?: string
    quantity?: number
    startDate?: Date
    endDate?: Date
    status?: string
  }
) {
  await ensureTestTenant(tracker)
  const startDate = options.startDate || new Date()
  const endDate = options.endDate || new Date(startDate.getTime() + 86400000)
  const rentalId = `rental-${randomUUID()}`
  const rental = await database().rentals.create({
    data: {
      tenantId: tracker.tenantId,
      id: rentalId,
      startdate: startDate,
      enddate: endDate,
      total: new Decimal(300),
      status: options.status || 'PENDING',
      userid: options.userId,
      quoteId: options.quoteId,
    },
  })
  tracker.rentals.add(rental.id)

  const rentalItem = await database().rental_items.create({
    data: {
      tenantId: tracker.tenantId,
      id: `rental-item-${randomUUID()}`,
      rentalid: rental.id,
      equipmentid: options.equipmentId,
      startDate,
      endDate,
      quantity: options.quantity ?? 1,
      priceperday: new Decimal(150),
      totaldays: 1,
      totalprice: new Decimal(150),
    },
  })
  tracker.rentalItems.add(rentalItem.id)

  return { rental, rentalItem }
}

export async function createPayment(
  tracker: TestTracker,
  options: {
    amount?: number
    status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED'
    method?:
      'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CASH'
    type?: 'RENTAL' | 'DEPOSIT' | 'FINE' | 'DAMAGE' | 'LATE_FEE'
    dueDate?: Date
    quoteId?: string
    rentalId?: string
    transactionId?: string
  }
) {
  await ensureTestTenant(tracker)
  const payment = await database().payment.create({
    data: {
      tenantId: tracker.tenantId,
      amount: new Decimal(options.amount ?? 150),
      status: options.status || 'PENDING',
      method: options.method || 'BOLETO',
      type: options.type || 'RENTAL',
      dueDate: options.dueDate || new Date(),
      quoteId: options.quoteId,
      rentalId: options.rentalId,
      transactionId: options.transactionId,
    },
  })
  tracker.payments.add(payment.id)
  return payment
}
