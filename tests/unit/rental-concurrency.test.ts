import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import Decimal from 'decimal.js'

const mail = vi.hoisted(() => ({
  send: vi.fn(async (...args: unknown[]) => {
    void args
    return { data: { id: 'test-message' }, error: null }
  }),
}))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/resend', () => ({
  default: () => ({ emails: { send: mail.send } }),
}))
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const connectionString = requireTestDatabase(process.env)
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Explicit disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({ connectionString, max: 12 })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () =>
    sessionUserId === null ? null : { user: { id: sessionUserId ?? adminId } },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  adminApiRateLimit: {},
  strictRateLimit: {},
}))
import { NextRequest } from 'next/server'
import { runQuoteAdjustmentEffects } from '@/lib/quote-adjustment-effects'
import { loadTenantBranding } from '@/lib/email-branding'
import { createQuoteRequest } from '@/lib/quote-request'
import { runQuoteCreatedEffects } from '@/lib/quote-created-effects'
import { prisma } from '@/lib/prisma'
import { publishTestOrganizations } from '../helpers/public-site'
import { convertQuoteToRental } from '@/lib/rental-converter'
import {
  createManualRental,
  checkoutRental,
  extendRental,
  updateRental,
} from '@/lib/rental-lifecycle'
import { runQuoteStatusEffects } from '@/lib/quote-status-effects'
import { enqueueOutbox } from '@gb-locacoes/backend/outbox'
import { withTenantTransaction } from '@/lib/tenant'
import { processPayment } from '@/lib/payment-processor'
import { convertPaidQuotePayment } from '@/lib/quote-payment-conversion'
import { calculateEquipmentAvailability } from '@/lib/equipment-availability'
let sessionUserId: string | null | undefined
let adminId: string
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
  ...(await (async () => {
    const F = await (() => ({
      default: () => ({ emails: { send: mail.send } }),
    }))()
    return { createResendClient: () => F.default() }
  })()),
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  adminApiRateLimit: {},
  strictRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () =>
      sessionUserId === null
        ? null
        : { user: { id: sessionUserId ?? adminId } },
  }))()),
}))
import * as legacyRoute0 from '@/app/api/contact/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/contact/route'
import * as legacyRoute1 from '@/app/api/admin/quotes/[id]/adjustments/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/route'
import * as legacyRoute2 from '@/app/api/quotes/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/quotes/route'
import * as legacyRoute3 from '@/app/api/equipments/[id]/availability/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/equipments/[id]/availability/route'
import * as legacyRoute4 from '@/app/api/admin/quotes/[id]/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/quotes/[id]/route'
import * as legacyRoute5 from '@/app/api/admin/rentals/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/rentals/route'

const HOSTS = [
  [
    'legacy root',
    {
      postContact: legacyRoute0.POST,
      postAdjustment: legacyRoute1.POST,
      postQuote: legacyRoute2.POST,
      publicAvailability: legacyRoute3.GET,
      patchQuote: legacyRoute4.PATCH,
      listAdminRentals: legacyRoute5.GET,
    },
  ],
  [
    'service',
    {
      postContact: serviceRoute0.POST,
      postAdjustment: serviceRoute1.POST,
      postQuote: serviceRoute2.POST,
      publicAvailability: serviceRoute3.GET,
      patchQuote: serviceRoute4.PATCH,
      listAdminRentals: serviceRoute5.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      postContact,
      postAdjustment,
      postQuote,
      publicAvailability,
      patchQuote,
      listAdminRentals,
    }
  ) => {
    const date = (day: number) => new Date(Date.UTC(2030, 0, day))
    const prefix = `reservation-test-${randomUUID()}`
    let context: TenantContext
    let otherContext: TenantContext
    let otherUserId: string
    let otherEquipmentId: string
    let otherCategoryId: string
    let userId: string
    let categoryId: string
    let equipmentId: string
    const quoteIds: string[] = []
    const manual = (start = 1, end = 3) => ({
      userId,
      startDate: date(start),
      endDate: date(end),
      items: [
        { equipmentId, quantity: 1, days: 3, pricePerDay: new Decimal(10) },
      ],
    })
    async function quote(
      paymentTerms: 'UPFRONT' | 'ON_DELIVERY' | 'AT_END' = 'UPFRONT',
      paid = true
    ) {
      const row = await prisma.quote.create({
        data: {
          tenantId: context.tenantId,
          name: prefix,
          email: `${prefix}@example.test`,
          phone: '00000000000',
          userId,
          status: 'APPROVED',
          approvedAt: new Date(),
          paymentTerms,
          total: 30,
          startDate: date(1),
          endDate: date(3),
          items: {
            create: {
              tenantId: context.tenantId,
              equipmentId,
              quantity: 1,
              days: 3,
              pricePerDay: 10,
              total: 30,
              startDate: date(1),
              endDate: date(3),
            },
          },
          payments: {
            create: {
              tenantId: context.tenantId,
              amount: 30,
              method: 'PIX',
              type: 'DEPOSIT',
              status: paid ? 'PAID' : 'PENDING',
              dueDate: date(1),
            },
          },
        },
        include: { payments: true },
      })
      quoteIds.push(row.id)
      return row
    }
    async function cleanRentals() {
      const rentals = await prisma.rentals.findMany({
        where: { userid: { in: [userId, otherUserId] } },
        select: { id: true },
      })
      const rentalIds = rentals.map((row) => row.id)
      await prisma.clientDocument.deleteMany({
        where: { userId: { in: [userId, otherUserId] } },
      })
      await prisma.outboxEvent.deleteMany({
        where: { tenantId: { in: [context.tenantId, otherContext.tenantId] } },
      })
      await prisma.notification.deleteMany({
        where: { tenantId: { in: [context.tenantId, otherContext.tenantId] } },
      })
      await prisma.paymentAttempt.deleteMany({
        where: { tenantId: { in: [context.tenantId, otherContext.tenantId] } },
      })
      await prisma.payment.deleteMany({
        where: {
          OR: [{ rentalId: { in: rentalIds } }, { quoteId: { in: quoteIds } }],
        },
      })
      await prisma.rental_items.deleteMany({
        where: { rentalid: { in: rentalIds } },
      })
      await prisma.rentals.deleteMany({
        where: { userid: { in: [userId, otherUserId] } },
      })
      await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
      quoteIds.length = 0
    }
    async function documents(rentalId: string) {
      for (const type of [
        'ID_DOCUMENT',
        'SELFIE',
        'SIGNED_CONTRACT',
        'CPF_CNPJ_PROOF',
      ] as const) {
        await prisma.clientDocument.create({
          data: {
            tenantId: context.tenantId,
            userId,
            rentalId,
            type,
            filePath: '/test/fixture',
            fileName: 'fixture',
            mimeType: 'text/plain',
            fileSize: 1,
            uploadedBy: userId,
          },
        })
      }
    }

    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'PostgreSQL rental concurrency (disposable local database)',
      () => {
        beforeAll(async () => {
          context = {
            tenantId: (
              await prisma.organization.create({
                data: { name: prefix, slug: prefix, status: 'ACTIVE' },
              })
            ).id,
          }
          otherContext = {
            tenantId: (
              await prisma.organization.create({
                data: {
                  name: prefix + '-other',
                  slug: prefix + '-other',
                  status: 'ACTIVE',
                },
              })
            ).id,
          }
          // Locadoras vivas (S13): a vitrine pública só responde publicada.
          await publishTestOrganizations(prisma, [
            context.tenantId,
            otherContext.tenantId,
          ])
          await prisma.setting.createMany({
            data: [
              {
                tenantId: context.tenantId,
                publicBaseUrl: 'https://locadora-a.example.test',
              },
              {
                tenantId: otherContext.tenantId,
                publicBaseUrl: 'https://locadora-b.example.test',
              },
            ],
          })
          adminId = (
            await prisma.user.create({
              data: { email: `${prefix}-admin@example.test`, name: prefix },
            })
          ).id
          otherUserId = (
            await prisma.user.create({
              data: { email: `${prefix}-other@example.test`, name: prefix },
            })
          ).id

          userId = (
            await prisma.user.create({
              data: { email: `${prefix}@example.test`, name: prefix },
            })
          ).id
          await prisma.membership.createMany({
            data: [
              {
                tenantId: context.tenantId,
                userId,
                role: 'CLIENT',
                status: 'ACTIVE',
              },
              {
                tenantId: otherContext.tenantId,
                userId: otherUserId,
                role: 'CLIENT',
                status: 'ACTIVE',
              },
              {
                tenantId: context.tenantId,
                userId: adminId,
                role: 'ADMIN',
                status: 'ACTIVE',
              },
              {
                tenantId: otherContext.tenantId,
                userId: adminId,
                role: 'ADMIN',
                status: 'ACTIVE',
              },
            ],
          })
          otherCategoryId = (
            await prisma.category.create({
              data: {
                tenantId: otherContext.tenantId,
                name: prefix,
                slug: prefix + '-other',
              },
            })
          ).id
          otherEquipmentId = (
            await prisma.equipment.create({
              data: {
                tenantId: otherContext.tenantId,
                name: prefix,
                categoryId: otherCategoryId,
                maxStock: 1,
                pricePerDay: 10,
                images: [],
              },
            })
          ).id
          categoryId = (
            await prisma.category.create({
              data: { tenantId: context.tenantId, name: prefix, slug: prefix },
            })
          ).id
          equipmentId = (
            await prisma.equipment.create({
              data: {
                tenantId: context.tenantId,
                name: prefix,
                categoryId,
                maxStock: 1,
                pricePerDay: 10,
                images: [],
              },
            })
          ).id
        })
        beforeEach(async () => {
          sessionUserId = adminId
          vi.stubEnv('FROM_EMAIL', 'test@example.test')
          mail.send.mockClear()
          await cleanRentals()
          await prisma.equipment.update({
            where: { id: equipmentId },
            data: { maxStock: 1 },
          })
        })
        afterAll(async () => {
          vi.unstubAllEnvs()
          if (userId) await cleanRentals()
          if (equipmentId)
            await prisma.equipment.delete({ where: { id: equipmentId } })
          if (categoryId)
            await prisma.category.delete({ where: { id: categoryId } })
          if (otherEquipmentId)
            await prisma.equipment.delete({ where: { id: otherEquipmentId } })
          if (otherCategoryId)
            await prisma.category.delete({ where: { id: otherCategoryId } })
          if (context)
            await prisma.membership.deleteMany({
              where: {
                tenantId: { in: [context.tenantId, otherContext.tenantId] },
              },
            })
          if (userId) await prisma.user.delete({ where: { id: userId } })
          if (otherUserId)
            await prisma.user.delete({ where: { id: otherUserId } })
          if (adminId) await prisma.user.delete({ where: { id: adminId } })
          if (context)
            await prisma.setting.deleteMany({
              where: {
                tenantId: { in: [context.tenantId, otherContext.tenantId] },
              },
            })
          if (context)
            await prisma.organization.deleteMany({
              where: { id: { in: [context.tenantId, otherContext.tenantId] } },
            })
        })
        it('isolates identical inventory demands across two locadoras and rejects crossed resource IDs', async () => {
          const [first, second] = await Promise.all([
            createManualRental(context, manual()),
            createManualRental(otherContext, {
              ...manual(),
              userId: otherUserId,
              items: [{ ...manual().items[0]!, equipmentId: otherEquipmentId }],
            }),
          ])
          expect(first.tenantId).toBe(context.tenantId)
          expect(second.tenantId).toBe(otherContext.tenantId)
          await expect(
            checkoutRental(otherContext, first.id)
          ).rejects.toMatchObject({ status: 404 })
          await expect(
            createManualRental(context, {
              ...manual(10, 12),
              userId: otherUserId,
            })
          ).rejects.toMatchObject({ code: 'customer_not_found' })
          await expect(
            createManualRental(context, {
              ...manual(10, 12),
              items: [{ ...manual().items[0]!, equipmentId: otherEquipmentId }],
            })
          ).rejects.toMatchObject({ status: 404 })
          await expect(
            convertQuoteToRental(otherContext, (await quote()).id)
          ).rejects.toMatchObject({ code: 'quote_not_found' })
        })
        it('rejects missing tenant context and suspended organizations', async () => {
          expect(() => createManualRental({ tenantId: '' }, manual())).toThrow(
            'Locadora não selecionada'
          )
          await withTestPlatformTransaction(prisma, async (tx) =>
            tx.organization.update({
              where: { id: otherContext.tenantId },
              data: { status: 'SUSPENDED' },
            })
          )
          await expect(
            createManualRental(otherContext, {
              ...manual(),
              userId: otherUserId,
            })
          ).rejects.toMatchObject({ code: 'tenant_inactive' })
          await withTestPlatformTransaction(prisma, async (tx) =>
            tx.organization.update({
              where: { id: otherContext.tenantId },
              data: { status: 'ACTIVE' },
            })
          )
        })
        it('creates guest quotes only in the explicit public locadora and scopes sequential codes', async () => {
          sessionUserId = null
          const input = {
            customerName: 'Customer fixture',
            customerEmail: 'fixture@example.test',
            customerPhone: '00000000000',
            items: [
              {
                equipmentId,
                quantity: 1,
                days: 3,
                startDate: date(1).toISOString(),
                endDate: date(3).toISOString(),
              },
            ],
          }
          const missing = await postQuote(
            new NextRequest('http://localhost/api/quotes', {
              method: 'POST',
              body: JSON.stringify(input),
            })
          )
          expect(missing.status).toBe(409)
          const crossed = await postQuote(
            new NextRequest('http://localhost/api/quotes', {
              method: 'POST',
              body: JSON.stringify({ ...input, tenantSlug: prefix + '-other' }),
            })
          )
          expect(crossed.status).toBe(404)
          const response = await postQuote(
            new NextRequest('http://localhost/api/quotes', {
              method: 'POST',
              body: JSON.stringify({ ...input, tenantSlug: prefix }),
            })
          )
          expect(response.status).toBe(201)
          const first = await response.json()
          quoteIds.push(first.id)
          expect(first).toMatchObject({
            tenantId: context.tenantId,
            userId: null,
            status: 'PENDING',
          })
          const second = await createQuoteRequest(otherContext, {
            ...input,
            items: [{ ...input.items[0]!, equipmentId: otherEquipmentId }],
          })
          quoteIds.push(second.id)
          expect(second.quoteCode).toBe(first.quoteCode)
          expect(
            await prisma.outboxEvent.findFirst({
              where: { aggregateId: first.id },
            })
          ).toMatchObject({
            tenantId: context.tenantId,
            topic: 'quote.created.notify',
          })
        })
        it('rejects delivery without an explicitly configured tenant origin', async () => {
          await expect(
            createQuoteRequest(context, {
              customerName: 'Customer fixture',
              customerEmail: 'fixture@example.test',
              customerPhone: '00000000000',
              deliveryType: 'DELIVERY',
              items: [{ equipmentId, quantity: 1, days: 1 }],
            })
          ).rejects.toMatchObject({
            code: 'DELIVERY_ORIGIN_NOT_CONFIGURED',
            status: 409,
          })
        })
        it('public calendar applies reservation policy without exposing rental identifiers', async () => {
          await createManualRental(context, manual())
          const response = await publicAvailability(
            new NextRequest(
              `http://localhost/api/equipments/${equipmentId}/availability?tenantSlug=${prefix}&month=2030-01`
            ),
            { params: Promise.resolve({ id: equipmentId }) }
          )
          expect(response.status).toBe(200)
          const body = await response.json()
          expect(body.availability['2030-01-02']).toMatchObject({
            available: false,
            availableQuantity: 0,
          })
          expect(body.availability['2030-01-02'].blockedBy).toBeUndefined()
          const crossed = await publicAvailability(
            new NextRequest(
              `http://localhost/api/equipments/${equipmentId}/availability?tenantSlug=${prefix}-other&month=2030-01`
            ),
            { params: Promise.resolve({ id: equipmentId }) }
          )
          expect(crossed.status).toBe(404)
        })
        it('quote creation effects notify only administrators of the owning locadora', async () => {
          const input = {
            customerName: 'Customer fixture',
            customerEmail: 'fixture@example.test',
            customerPhone: '00000000000',
            items: [
              {
                equipmentId,
                quantity: 1,
                days: 3,
                startDate: date(1),
                endDate: date(3),
              },
            ],
          }
          const source = await createQuoteRequest(context, input)
          quoteIds.push(source.id)
          const event = await prisma.outboxEvent.findFirstOrThrow({
            where: { aggregateId: source.id },
          })
          await prisma.membership.update({
            where: {
              tenantId_userId: {
                tenantId: otherContext.tenantId,
                userId: otherUserId,
              },
            },
            data: { role: 'ADMIN' },
          })
          try {
            await runQuoteCreatedEffects(context, event.id, event.payload)
            await runQuoteCreatedEffects(context, event.id, event.payload)
            expect(
              await prisma.notification.count({
                where: { tenantId: context.tenantId, userId: adminId },
              })
            ).toBe(1)
            expect(
              await prisma.notification.count({
                where: { userId: otherUserId },
              })
            ).toBe(0)
            const recipients = mail.send.mock.calls.map(
              (call) => (call[0] as { to: string }).to
            )
            expect(recipients).not.toContain(`${prefix}-other@example.test`)
            expect(recipients).toContain(`${prefix}-admin@example.test`)
            expect(recipients).toContain('fixture@example.test')
          } finally {
            await prisma.membership.update({
              where: {
                tenantId_userId: {
                  tenantId: otherContext.tenantId,
                  userId: otherUserId,
                },
              },
              data: { role: 'CLIENT' },
            })
          }
        })
        it('persists the extension payment and tenant-scoped delivery intent together', async () => {
          const rental = await createManualRental(context, manual())
          await documents(rental.id)
          await checkoutRental(context, rental.id)
          const extension = await extendRental(context, rental.id, {
            additionalDays: 1,
            generateBoleto: true,
          })
          expect(extension.paymentId).toBeTruthy()
          expect(
            await prisma.payment.findUnique({
              where: { id: extension.paymentId! },
            })
          ).toMatchObject({
            tenantId: context.tenantId,
            rentalId: rental.id,
            status: 'PENDING',
          })
          expect(
            await prisma.outboxEvent.findFirst({
              where: { aggregateId: extension.paymentId },
            })
          ).toMatchObject({
            tenantId: context.tenantId,
            topic: 'payment.boleto.issue',
            payload: { paymentId: extension.paymentId },
          })
        })
        it('deduplicates status notifications and ignores obsolete approval effects', async () => {
          const source = await quote()
          const event = await withTenantTransaction(context, (tx) =>
            enqueueOutbox(tx, {
              tenantId: context.tenantId,
              topic: 'quote.status.notify',
              aggregateId: source.id,
              payload: { quoteId: source.id, status: 'APPROVED' },
              dedupeKey: `test-status:${source.id}`,
            })
          )
          await runQuoteStatusEffects(context, event.id, event.payload)
          await runQuoteStatusEffects(context, event.id, event.payload)
          expect(
            await prisma.notification.count({
              where: { userId, tenantId: context.tenantId },
            })
          ).toBe(1)
          expect(mail.send).toHaveBeenCalledTimes(2)
          expect(mail.send.mock.calls[0]![1]).toEqual({
            idempotencyKey: `quote-status-${event.id}`,
          })
          expect(mail.send.mock.calls[1]![1]).toEqual(
            mail.send.mock.calls[0]![1]
          )
          await prisma.quote.update({
            where: { id: source.id },
            data: { status: 'REJECTED' },
          })
          await runQuoteStatusEffects(context, event.id, event.payload)
          expect(mail.send).toHaveBeenCalledTimes(2)
        })
        it('rolls back AT_END approval when combined quote items exceed stock', async () => {
          const source = await quote('AT_END', false)
          await prisma.quote.update({
            where: { id: source.id },
            data: { status: 'PENDING', approvedAt: null },
          })
          await prisma.quoteItem.create({
            data: {
              tenantId: context.tenantId,
              quoteId: source.id,
              equipmentId,
              quantity: 1,
              days: 3,
              pricePerDay: 10,
              total: 30,
              startDate: date(1),
              endDate: date(3),
            },
          })
          const response = await patchQuote(
            new NextRequest('http://localhost/api/admin/quotes/' + source.id, {
              method: 'PATCH',
              headers: { 'x-tenant-id': context.tenantId },
              body: JSON.stringify({ status: 'APPROVED' }),
            }),
            { params: Promise.resolve({ id: source.id }) }
          )
          expect(response.status).toBe(409)
          expect(
            await prisma.quote.findUnique({ where: { id: source.id } })
          ).toMatchObject({
            status: 'PENDING',
            approvedAt: null,
            convertedToRentalId: null,
          })
          expect(
            await prisma.rentals.count({ where: { quoteId: source.id } })
          ).toBe(0)
        })
        it('quote rejection and checkout cannot resurrect a cancelled rental', async () => {
          const source = await quote('AT_END', false)
          const rental = await convertQuoteToRental(context, source.id)
          await documents(rental.rentalId)
          const results = await Promise.allSettled([
            patchQuote(
              new NextRequest(
                'http://localhost/api/admin/quotes/' + source.id,
                {
                  method: 'PATCH',
                  headers: { 'x-tenant-id': context.tenantId },
                  body: JSON.stringify({ status: 'REJECTED' }),
                }
              ),
              { params: Promise.resolve({ id: source.id }) }
            ),
            checkoutRental(context, rental.rentalId),
          ])
          expect(results[0]!.status).toBe('fulfilled')
          expect(
            (
              await prisma.rentals.findUniqueOrThrow({
                where: { id: rental.rentalId },
              })
            ).status
          ).toBe('CANCELLED')
        })
        it('two simultaneous conversions of one quote converge with payments linked once', async () => {
          const source = await quote()
          const results = await Promise.all(
            Array.from({ length: 5 }, () =>
              convertQuoteToRental(context, source.id)
            )
          )
          expect(new Set(results.map((result) => result.rentalId)).size).toBe(1)
          expect(
            await prisma.rentals.count({ where: { quoteId: source.id } })
          ).toBe(1)
          expect(
            await prisma.payment.findUnique({
              where: { id: source.payments[0]!.id },
            })
          ).toMatchObject({
            rentalId: results[0]!.rentalId,
            quoteId: null,
            type: 'DEPOSIT',
          })
        })
        it('the database refuses a second rental for the same quote and repeated conversion returns the same rental', async () => {
          const source = await quote()
          const first = await convertQuoteToRental(context, source.id)
          await expect(
            prisma.rentals.create({
              data: {
                tenantId: context.tenantId,
                id: `rental_${randomUUID()}`,
                userid: userId,
                quoteId: source.id,
                startdate: date(1),
                enddate: date(3),
                total: 30,
              },
            })
          ).rejects.toMatchObject({ code: 'P2002' })
          const second = await convertQuoteToRental(context, source.id)
          expect(second.rentalId).toBe(first.rentalId)
          expect(
            await prisma.rentals.count({ where: { quoteId: source.id } })
          ).toBe(1)
          expect(
            await prisma.quote.findUniqueOrThrow({ where: { id: source.id } })
          ).toMatchObject({
            status: 'COMPLETED',
            convertedToRentalId: first.rentalId,
          })
        })
        it('conversion reuses the rental of a concurrent writer that won the unique index', async () => {
          const source = await quote()
          const { testPool } = (await import('@/lib/prisma')) as unknown as {
            testPool: import('pg').Pool
          }
          const writer = await testPool.connect()
          const competitorId = `rental_${randomUUID()}`
          let finished = false
          try {
            await writer.query('BEGIN')
            // Escritor sem coordenação pelo orçamento (importação/legado): não bloqueia a linha do orçamento.
            await writer.query('SET LOCAL session_replication_role = replica')
            await writer.query(
              `INSERT INTO rentals (id, "tenantId", startdate, enddate, total, userid, "quoteId")
           VALUES ($1, $2, $3, $4, 30, $5, $6)`,
              [
                competitorId,
                context.tenantId,
                date(1),
                date(3),
                userId,
                source.id,
              ]
            )
            const { rows } = await writer.query<{ xid: string }>(
              'SELECT pg_current_xact_id()::xid::text AS xid'
            )
            const conversion = convertQuoteToRental(context, source.id).then(
              (value) => ({ value }),
              (error: unknown) => ({ error })
            )
            let waiting = 0
            for (let attempt = 0; attempt < 200 && !waiting; attempt++) {
              await new Promise((resolve) => setTimeout(resolve, 25))
              const lock = await testPool.query<{ waiting: number }>(
                `SELECT count(*)::int AS waiting FROM pg_locks
             WHERE locktype = 'transactionid' AND NOT granted AND transactionid = $1::xid`,
                [rows[0]!.xid]
              )
              waiting = lock.rows[0]!.waiting
            }
            expect(waiting).toBe(1)
            await writer.query('COMMIT')
            finished = true
            const outcome = await conversion
            expect(outcome).toEqual({
              value: { rentalId: competitorId, boletoGenerated: false },
            })
          } finally {
            if (!finished) await writer.query('ROLLBACK').catch(() => undefined)
            writer.release()
          }
          expect(
            await prisma.rentals.findMany({
              where: { quoteId: source.id },
              select: { id: true, rental_items: { select: { id: true } } },
            })
          ).toEqual([{ id: competitorId, rental_items: [] }])
          expect(
            await prisma.quote.findUniqueOrThrow({ where: { id: source.id } })
          ).toMatchObject({
            status: 'COMPLETED',
            convertedToRentalId: competitorId,
          })
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: source.payments[0]!.id },
            })
          ).toMatchObject({ rentalId: competitorId, quoteId: null })
        })
        it('rental status is a closed lifecycle enum, required and PENDING by default', async () => {
          const { testPool } = (await import('@/lib/prisma')) as unknown as {
            testPool: import('pg').Pool
          }
          const insert = (status: string | null | undefined) => {
            const id = `rental_${randomUUID()}`
            const columns = status === undefined ? '' : ', status'
            const values = status === undefined ? '' : ', $4'
            return testPool
              .query(
                `INSERT INTO rentals (id, "tenantId", startdate, enddate, total, userid${columns})
             VALUES ($1, $2, now(), now(), 1, $3${values}) RETURNING status::text AS status`,
                status === undefined
                  ? [id, context.tenantId, userId]
                  : [id, context.tenantId, userId, status]
              )
              .then((result) => result.rows[0] as { status: string })
          }
          await expect(insert('FINISHED')).rejects.toMatchObject({
            code: '22P02',
          })
          await expect(insert(null)).rejects.toMatchObject({ code: '23502' })
          await expect(insert(undefined)).resolves.toEqual({
            status: 'PENDING',
          })
          for (const status of [
            'PENDING',
            'ACTIVE',
            'COMPLETED',
            'CANCELLED',
            'OVERDUE',
            'PENDING_RETURN',
          ])
            await expect(insert(status)).resolves.toEqual({ status })
        })
        it('admin rental list treats a status outside the enum as an empty filter', async () => {
          const { rentalId } = await convertQuoteToRental(
            context,
            (await quote()).id
          )
          const list = async (status: string) => {
            const response = await listAdminRentals(
              new NextRequest(
                `http://localhost/api/admin/rentals?status=${status}`,
                { headers: { 'x-tenant-id': context.tenantId } }
              )
            )
            return { status: response.status, body: await response.json() }
          }
          expect(await list('PENDING')).toMatchObject({
            status: 200,
            body: { rentals: [{ id: rentalId }], pagination: { total: 1 } },
          })
          expect(await list('FINISHED')).toMatchObject({
            status: 200,
            body: { rentals: [], pagination: { total: 0 } },
          })
        })
        it('last stock unit is awarded only once between different quotes', async () => {
          const sources = await Promise.all([quote(), quote()])
          const results = await Promise.allSettled(
            sources.map((source) => convertQuoteToRental(context, source.id))
          )
          expect(
            results.filter((result) => result.status === 'fulfilled')
          ).toHaveLength(1)
          expect(
            results.filter((result) => result.status === 'rejected')
          ).toHaveLength(1)
          expect(
            await prisma.rentals.count({
              where: { userid: { in: [userId, otherUserId] } },
            })
          ).toBe(1)
          expect(
            await prisma.quote.count({
              where: {
                id: { in: quoteIds },
                status: 'APPROVED',
                convertedToRentalId: null,
              },
            })
          ).toBe(1)
        })
        it('contact requires explicit tenant and queues only that locadora administrator email', async () => {
          const body = {
            name: 'Contato',
            email: 'contact@example.test',
            message: 'Interesse em equipamentos',
          }
          const request = (data: unknown) =>
            new NextRequest('http://localhost/api/contact', {
              method: 'POST',
              body: JSON.stringify(data),
              headers: { 'content-type': 'application/json' },
            })
          expect((await postContact(request(body)))!.status).toBe(409)
          const response = await postContact(
            request({ ...body, tenantSlug: prefix })
          )
          expect(response!.status).toBe(202)
          const { data } = await response!.json()
          quoteIds.push(data.messageId)
          const event = await prisma.outboxEvent.findFirstOrThrow({
            where: {
              tenantId: context.tenantId,
              aggregateId: data.messageId,
              topic: 'quote.created.notify',
            },
          })
          expect(mail.send).not.toHaveBeenCalled()
          await runQuoteCreatedEffects(context, event.id, event.payload)
          expect(mail.send).toHaveBeenCalledTimes(1)
          expect(mail.send.mock.calls[0]![0]).toMatchObject({
            to: `${prefix}-admin@example.test`,
          })
          expect(
            (mail.send.mock.calls[0]![0] as { html: string }).html
          ).toContain(prefix)
        })
        it('tenant branding is isolated and missing configuration remains recoverable', async () => {
          expect((await loadTenantBranding(context)).publicBaseUrl).toBe(
            'https://locadora-a.example.test'
          )
          expect((await loadTenantBranding(otherContext)).publicBaseUrl).toBe(
            'https://locadora-b.example.test'
          )
          await prisma.setting.updateMany({
            where: { tenantId: context.tenantId },
            data: { publicBaseUrl: null },
          })
          try {
            await expect(loadTenantBranding(context)).rejects.toMatchObject({
              code: 'EMAIL_BRANDING_NOT_CONFIGURED',
            })
          } finally {
            await prisma.setting.updateMany({
              where: { tenantId: context.tenantId },
              data: { publicBaseUrl: 'https://locadora-a.example.test' },
            })
          }
        })
        it('adjustments serialize freight replacement and queue replayable tenant email without global WhatsApp', async () => {
          const source = await quote('UPFRONT', false)
          const request = (amount: number) =>
            new NextRequest(
              `http://localhost/api/admin/quotes/${source.id}/adjustments`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-tenant-id': context.tenantId,
                },
                body: JSON.stringify({
                  category: 'TRAVEL',
                  amount,
                  justification: 'Frete revisado',
                  sendEmail: true,
                  sendWhatsapp: true,
                }),
              }
            )
          const first = await postAdjustment(request(10), {
            params: Promise.resolve({ id: source.id }),
          })
          const second = await postAdjustment(request(20), {
            params: Promise.resolve({ id: source.id }),
          })
          expect(first.status).toBe(202)
          expect(second.status).toBe(202)
          expect(await second.json()).toMatchObject({
            emailStatus: 'queued',
            whatsappStatus: 'unavailable',
            quote: { originalTotal: 30, finalTotal: 50 },
          })
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: source.payments[0]!.id },
              })
            ).amount.toNumber()
          ).toBe(50)
          const recalculated = await prisma.payment.findUniqueOrThrow({
            where: { id: source.payments[0]!.id },
          })
          expect(recalculated.grossAmount?.toNumber()).toBe(50)
          expect(recalculated.netAmount?.isFinite()).toBe(true)
          const events = await prisma.outboxEvent.findMany({
            where: {
              tenantId: context.tenantId,
              aggregateId: source.id,
              topic: 'quote.adjustment.notify',
            },
            orderBy: { createdAt: 'asc' },
          })
          expect(events).toHaveLength(2)
          await runQuoteAdjustmentEffects(
            context,
            events[0]!.id,
            events[0]!.payload
          )
          expect(mail.send).not.toHaveBeenCalled()
          for (let i = 0; i < 2; i++)
            await runQuoteAdjustmentEffects(
              context,
              events[1]!.id,
              events[1]!.payload
            )
          expect(mail.send).toHaveBeenCalledTimes(2)
          expect(mail.send.mock.calls[0]![1]).toEqual(
            mail.send.mock.calls[1]![1]
          )
          expect(
            (mail.send.mock.calls[0]![0] as { html: string }).html
          ).toContain('https://locadora-a.example.test/area-cliente/')
          expect(
            await prisma.notification.count({
              where: {
                tenantId: context.tenantId,
                id: `outbox_${events[1]!.id}_adjustment`,
              },
            })
          ).toBe(1)
        })
        it('adjustments reject cross-tenant IDs and preserve an externally issued obligation', async () => {
          const source = await quote('UPFRONT', false)
          await prisma.payment.update({
            where: { id: source.payments[0]!.id },
            data: { transactionId: 'external-already-issued' },
          })
          const request = (tenantId: string) =>
            new NextRequest(
              `http://localhost/api/admin/quotes/${source.id}/adjustments`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-tenant-id': tenantId,
                },
                body: JSON.stringify({
                  category: 'OTHER',
                  amount: 20,
                  justification: 'Taxa adicional',
                }),
              }
            )
          expect(
            (
              await postAdjustment(request(otherContext.tenantId), {
                params: Promise.resolve({ id: source.id }),
              })
            ).status
          ).toBe(404)
          expect(
            (
              await postAdjustment(request(context.tenantId), {
                params: Promise.resolve({ id: source.id }),
              })
            ).status
          ).toBe(409)
          expect(
            await prisma.quoteAdjustment.count({
              where: { quoteId: source.id },
            })
          ).toBe(0)
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: source.payments[0]!.id },
              })
            ).amount.toNumber()
          ).toBe(30)
        })
        it('commits a recoverable conversion intent with payment confirmation and deduplicates replay', async () => {
          const source = await quote('UPFRONT', false)
          const paymentId = source.payments[0]!.id
          await prisma.payment.update({
            where: { id: paymentId },
            data: { transactionId: 'charge-current' },
          })
          const attempt = await prisma.paymentAttempt.create({
            data: {
              tenantId: context.tenantId,
              paymentId,
              provider: 'test',
              externalId: 'charge-current',
              status: 'ISSUED',
              amount: 30,
              dueDate: date(1),
              idempotencyKey: `${prefix}:attempt-current`,
            },
          })
          const otherAttempt = await prisma.paymentAttempt.create({
            data: {
              tenantId: context.tenantId,
              paymentId,
              provider: 'test',
              externalId: 'charge-old',
              status: 'REFUNDED',
              amount: 30,
              dueDate: date(1),
              idempotencyKey: `${prefix}:attempt-old`,
            },
          })
          await Promise.all([
            processPayment(context, paymentId, { status: 'PAID' }),
            processPayment(context, paymentId, { status: 'PAID' }),
          ])
          const events = await prisma.outboxEvent.findMany({
            where: {
              tenantId: context.tenantId,
              topic: 'quote.payment.convert',
              aggregateId: source.id,
            },
          })
          expect(events).toHaveLength(1)
          expect(events[0]!.payload).toEqual({ paymentId })
          expect(
            (
              await prisma.paymentAttempt.findUniqueOrThrow({
                where: { id: attempt.id },
              })
            ).status
          ).toBe('PAID')
          expect(
            (
              await prisma.paymentAttempt.findUniqueOrThrow({
                where: { id: otherAttempt.id },
              })
            ).status
          ).toBe('REFUNDED')
          const first = await convertPaidQuotePayment(context, paymentId)
          const replay = await convertPaidQuotePayment(context, paymentId)
          expect(first.converted).toBe(true)
          expect(replay.rentalId).toBe(first.rentalId)
          expect(
            (
              await prisma.rentals.findUniqueOrThrow({
                where: { id: first.rentalId! },
              })
            ).status
          ).toBe('PENDING')
        })
        it('manual creations share the same stock lock', async () => {
          const results = await Promise.allSettled([
            createManualRental(context, manual()),
            createManualRental(context, manual()),
          ])
          expect(
            results.filter((result) => result.status === 'fulfilled')
          ).toHaveLength(1)
        })
        it('AT_END reserves unpaid; UPFRONT and ON_DELIVERY do not convert unpaid', async () => {
          for (const terms of ['UPFRONT', 'ON_DELIVERY'] as const)
            await expect(
              convertQuoteToRental(context, (await quote(terms, false)).id)
            ).rejects.toMatchObject({ code: 'pending_payments' })
          const reserved = await convertQuoteToRental(
            context,
            (await quote('AT_END', false)).id
          )
          expect(
            (
              await calculateEquipmentAvailability(
                context,
                equipmentId,
                date(1),
                date(3)
              )
            ).availableQuantity
          ).toBe(0)
          await expect(
            checkoutRental(context, reserved.rentalId)
          ).rejects.toMatchObject({
            code: 'missing_documents',
          })
          expect(
            (
              await prisma.rentals.findUniqueOrThrow({
                where: { id: reserved.rentalId },
              })
            ).status
          ).toBe('PENDING')
          await documents(reserved.rentalId)
          expect(
            await checkoutRental(context, reserved.rentalId)
          ).toMatchObject({
            status: 'ACTIVE',
          })
          expect(
            await checkoutRental(context, reserved.rentalId)
          ).toMatchObject({
            status: 'ACTIVE',
          })
        })
        it('revalidates extension, excludes own reservation and rolls back conflicting dates', async () => {
          const first = await createManualRental(context, manual(1, 3))
          await documents(first.id)
          await checkoutRental(context, first.id)
          await extendRental(context, first.id, {
            additionalDays: 1,
            generateBoleto: false,
          })
          await createManualRental(context, manual(6, 7))
          await expect(
            extendRental(context, first.id, {
              additionalDays: 3,
              generateBoleto: false,
            })
          ).rejects.toMatchObject({ code: 'stock_unavailable' })
          expect(
            (
              await prisma.rentals.findUniqueOrThrow({
                where: { id: first.id },
              })
            ).enddate
          ).toEqual(date(4))
          expect(
            (
              await prisma.rental_items.findFirstOrThrow({
                where: { rentalid: first.id },
              })
            ).endDate
          ).toEqual(date(4))
        })
        it('rejects confirmation from an old external charge before any mutation or effect', async () => {
          const source = await quote('UPFRONT', false)
          const id = source.payments[0]!.id
          await prisma.payment.update({
            where: { id },
            data: { transactionId: 'current-charge' },
          })
          await expect(
            processPayment(context, id, {
              status: 'PAID',
              externalId: 'old-charge',
            })
          ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' })
          expect(
            (await prisma.payment.findUniqueOrThrow({ where: { id } })).status
          ).toBe('PENDING')
          expect(
            await prisma.outboxEvent.count({
              where: { tenantId: context.tenantId, aggregateId: source.id },
            })
          ).toBe(0)
          await processPayment(context, id, {
            status: 'PAID',
            externalId: 'current-charge',
          })
          await expect(
            processPayment(context, id, {
              status: 'PAID',
              externalId: 'old-charge',
            })
          ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' })
        })
        it('payment replay never reopens cancelled/refunded payments or activates a rental', async () => {
          const source = await quote('UPFRONT', false)
          const id = source.payments[0]!.id
          await Promise.all([
            processPayment(context, id, { status: 'PAID' }),
            processPayment(context, id, { status: 'PAID' }),
          ])
          expect(
            (await prisma.payment.findUniqueOrThrow({ where: { id } })).status
          ).toBe('PAID')
          expect(
            await prisma.rentals.count({
              where: { userid: { in: [userId, otherUserId] } },
            })
          ).toBe(0)
          await processPayment(context, id, { status: 'OVERDUE' })
          expect(
            (await prisma.payment.findUniqueOrThrow({ where: { id } })).status
          ).toBe('PAID')
          await processPayment(context, id, { status: 'REFUNDED' })
          await processPayment(context, id, { status: 'PAID' })
          expect(
            (await prisma.payment.findUniqueOrThrow({ where: { id } })).status
          ).toBe('REFUNDED')
        })
        it('duplicate equipment items cannot bypass stock and zero stock stays zero', async () => {
          const input = manual()
          input.items.push({ ...input.items[0]! })
          await expect(
            createManualRental(context, input)
          ).rejects.toMatchObject({
            code: 'stock_unavailable',
          })
          await prisma.equipment.update({
            where: { id: equipmentId },
            data: { maxStock: 0 },
          })
          await expect(
            createManualRental(context, manual())
          ).rejects.toMatchObject({
            code: 'stock_unavailable',
          })
        })
        it('rolls back item date writes if checkout validation fails later in the transaction', async () => {
          const rental = await createManualRental(context, manual())
          await expect(
            updateRental(context, rental.id, {
              status: 'ACTIVE',
              endDate: date(5),
            })
          ).rejects.toMatchObject({ code: 'missing_documents' })
          expect(
            (
              await prisma.rental_items.findFirstOrThrow({
                where: { rentalid: rental.id },
              })
            ).endDate
          ).toEqual(date(3))
          expect(
            (
              await prisma.rentals.findUniqueOrThrow({
                where: { id: rental.id },
              })
            ).enddate
          ).toEqual(date(3))
        })
        it('uses individual item dates even when the historical rental envelope is stale', async () => {
          const rental = await createManualRental(context, manual())
          await prisma.rental_items.updateMany({
            where: { rentalid: rental.id },
            data: { startDate: date(10), endDate: date(12) },
          })
          expect(
            (
              await calculateEquipmentAvailability(
                context,
                equipmentId,
                date(1),
                date(3)
              )
            ).availableQuantity
          ).toBe(1)
          expect(
            (
              await calculateEquipmentAvailability(
                context,
                equipmentId,
                date(10),
                date(12)
              )
            ).availableQuantity
          ).toBe(0)
        })
        it('alternate PATCH activation cannot bypass documents or reopen a terminal state', async () => {
          const rental = await createManualRental(context, manual())
          await expect(
            updateRental(context, rental.id, { status: 'ACTIVE' })
          ).rejects.toMatchObject({ code: 'missing_documents' })
          await updateRental(context, rental.id, { status: 'CANCELLED' })
          await expect(
            updateRental(context, rental.id, { status: 'ACTIVE' })
          ).rejects.toMatchObject({ status: 409 })
        })
      }
    )
  }
)

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = (await import('@/lib/prisma')) as unknown as {
    prisma: { $disconnect(): Promise<void> }
    testPool: { end(): Promise<void> }
  }
  await database.prisma.$disconnect()
  await database.testPool.end()
})
