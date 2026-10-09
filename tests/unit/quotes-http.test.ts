/**
 * Caracterização HTTP das rotas de orçamento (portal do cliente e
 * administração) antes da extração para @gb-locacoes/backend/quotations.
 * Handlers reais sobre o PostgreSQL descartável; o principal é fixado pelo
 * teste (a resolução de sessão/host pertence a outro módulo).
 */
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

const mocked = vi.hoisted(() => ({ principal: vi.fn() }))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const connectionString = requireTestDatabase(process.env)
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Explicit disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({ connectionString, max: 8 })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => null,
}))
vi.mock('@/lib/tenant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tenant')>()),
  resolveTenantPrincipal: mocked.principal,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  strictRateLimit: {},
  adminApiRateLimit: {},
}))

import { prisma } from '@/lib/prisma'
import { publishTestOrganizations } from '../helpers/public-site'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  strictRateLimit: {},
  adminApiRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => null,
  }))()),
}))
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (async () => ({
      resolveTenantPrincipal: mocked.principal,
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/quotes/[id]/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/quotes/[id]/route'
import * as legacyRoute1 from '@/app/api/admin/quotes/[id]/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/quotes/[id]/route'
import * as legacyRoute2 from '@/app/api/admin/quotes/[id]/calculate-late-fee/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/quotes/[id]/calculate-late-fee/route'
import * as legacyRoute3 from '@/app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route'
import * as legacyRoute4 from '@/app/api/admin/quotes/[id]/send-boleto/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/quotes/[id]/send-boleto/route'
import * as legacyRoute5 from '@/app/api/admin/quotes/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/quotes/route'
import * as legacyRoute6 from '@/app/api/admin/quotes/[id]/adjustments/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/route'

const HOSTS = [
  [
    'legacy root',
    {
      readClientQuote: legacyRoute0.GET,
      hideClientQuote: legacyRoute0.DELETE,
      readAdminQuote: legacyRoute1.GET,
      patchAdminQuote: legacyRoute1.PATCH,
      deleteAdminQuote: legacyRoute1.DELETE,
      quoteLateFee: legacyRoute2.POST,
      deleteAdjustment: legacyRoute3.DELETE,
      sendBoleto: legacyRoute4.POST,
      listAdminQuotes: legacyRoute5.GET,
      listAdjustments: legacyRoute6.GET,
      createAdjustment: legacyRoute6.POST,
    },
  ],
  [
    'service',
    {
      readClientQuote: serviceRoute0.GET,
      hideClientQuote: serviceRoute0.DELETE,
      readAdminQuote: serviceRoute1.GET,
      patchAdminQuote: serviceRoute1.PATCH,
      deleteAdminQuote: serviceRoute1.DELETE,
      quoteLateFee: serviceRoute2.POST,
      deleteAdjustment: serviceRoute3.DELETE,
      sendBoleto: serviceRoute4.POST,
      listAdminQuotes: serviceRoute5.GET,
      listAdjustments: serviceRoute6.GET,
      createAdjustment: serviceRoute6.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      readClientQuote,
      hideClientQuote,
      readAdminQuote,
      patchAdminQuote,
      deleteAdminQuote,
      quoteLateFee,
      deleteAdjustment,
      sendBoleto,
      listAdminQuotes,
      listAdjustments,
      createAdjustment,
    }
  ) => {
    type Role = 'ADMIN' | 'OPERATOR' | 'CLIENT'
    const prefix = `quotes-http-${randomUUID()}`
    const origin = 'https://app.example.test'
    let tenantId: string
    let otherTenantId: string
    let adminId: string
    let clientId: string
    let otherClientId: string
    let categoryId: string
    let equipmentId: string
    let otherEquipmentId: string
    let principal: {
      tenantId: string
      userId: string
      membershipId: string
      role: Role
    } | null
    const quoteIds: string[] = []

    const as = (role: Role, userId?: string) => {
      principal = {
        tenantId,
        userId: userId ?? (role === 'CLIENT' ? clientId : adminId),
        membershipId: 'member-' + role,
        role,
      }
    }
    const request = (path: string, method = 'GET', body?: unknown) =>
      new Request(origin + path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { 'content-type': 'application/json' },
              body: typeof body === 'string' ? body : JSON.stringify(body),
            }),
      }) as unknown as import('next/server').NextRequest
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    async function call(response: Promise<Response> | Response) {
      const resolved = await response
      return {
        status: resolved.status,
        type: resolved.headers.get('content-type'),
        cache: resolved.headers.get('cache-control'),
        body: await resolved.json(),
      }
    }

    async function quote(
      options: {
        tenant?: string
        userId?: string | null
        status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
        paid?: boolean
        payments?: boolean
        endDate?: Date | null
      } = {}
    ) {
      const tenant = options.tenant ?? tenantId
      const row = await prisma.quote.create({
        data: {
          tenantId: tenant,
          quoteCode: `Q-2031-${randomUUID().slice(0, 8)}`,
          name: prefix,
          email: `${prefix}@example.test`,
          phone: '11988887777',
          cpf: '12345678909',
          userId: options.userId === undefined ? clientId : options.userId,
          status: options.status ?? 'APPROVED',
          approvedAt:
            options.status === 'PENDING'
              ? null
              : new Date('2031-01-02T00:00:00.000Z'),
          total: 30,
          originalTotal: 30,
          startDate: new Date('2031-01-05T00:00:00.000Z'),
          endDate:
            options.endDate === undefined
              ? new Date('2031-01-07T00:00:00.000Z')
              : options.endDate,
          validUntil: new Date('2031-01-09T00:00:00.000Z'),
          deliveryType: 'PICKUP',
          items: {
            create: {
              tenantId: tenant,
              equipmentId: tenant === tenantId ? equipmentId : otherEquipmentId,
              quantity: 1,
              days: 3,
              pricePerDay: 10,
              total: 30,
              startDate: new Date('2031-01-05T00:00:00.000Z'),
              endDate: new Date('2031-01-07T00:00:00.000Z'),
            },
          },
          ...(options.payments === false
            ? {}
            : {
                payments: {
                  create: {
                    tenantId: tenant,
                    amount: 30,
                    method: 'BOLETO',
                    type: 'RENTAL',
                    status: options.paid ? 'PAID' : 'PENDING',
                    dueDate: new Date('2031-01-04T00:00:00.000Z'),
                    metadata: { pdfUrl: 'https://boleto.example.test/1.pdf' },
                  },
                },
              }),
        },
        include: { items: true, payments: true },
      })
      quoteIds.push(row.id)
      return row
    }

    async function clean() {
      const tenants = [tenantId, otherTenantId]
      await prisma.outboxEvent.deleteMany({
        where: { tenantId: { in: tenants } },
      })
      await prisma.paymentAttempt.deleteMany({
        where: { tenantId: { in: tenants } },
      })
      await prisma.payment.deleteMany({ where: { tenantId: { in: tenants } } })
      const rentals = await prisma.rentals.findMany({
        where: { tenantId: { in: tenants } },
        select: { id: true },
      })
      await prisma.rental_items.deleteMany({
        where: { rentalid: { in: rentals.map((row) => row.id) } },
      })
      await prisma.rentals.deleteMany({ where: { tenantId: { in: tenants } } })
      await prisma.quoteAdjustment.deleteMany({
        where: { quoteId: { in: quoteIds } },
      })
      await prisma.quoteItem.deleteMany({
        where: { quoteId: { in: quoteIds } },
      })
      await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
      quoteIds.length = 0
    }

    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'HTTP characterization of quote routes (disposable PostgreSQL)',
      () => {
        beforeAll(async () => {
          tenantId = (
            await prisma.organization.create({
              data: { name: prefix, slug: prefix, status: 'ACTIVE' },
            })
          ).id
          otherTenantId = (
            await prisma.organization.create({
              data: {
                name: prefix + '-b',
                slug: prefix + '-b',
                status: 'ACTIVE',
              },
            })
          ).id
          // Locadoras vivas (S13): a vitrine pública só responde publicada.
          await publishTestOrganizations(prisma, [tenantId, otherTenantId])
          const user = async (suffix: string) =>
            (
              await prisma.user.create({
                data: {
                  email: `${prefix}-${suffix}@example.test`,
                  name: `${prefix} ${suffix}`,
                },
              })
            ).id
          adminId = await user('admin')
          clientId = await user('client')
          otherClientId = await user('other')
          await prisma.membership.createMany({
            data: [
              { tenantId, userId: adminId, role: 'ADMIN', status: 'ACTIVE' },
              { tenantId, userId: clientId, role: 'CLIENT', status: 'ACTIVE' },
              {
                tenantId: otherTenantId,
                userId: otherClientId,
                role: 'CLIENT',
                status: 'ACTIVE',
              },
            ],
          })
          categoryId = (
            await prisma.category.create({
              data: { tenantId, name: prefix, slug: prefix },
            })
          ).id
          equipmentId = (
            await prisma.equipment.create({
              data: {
                tenantId,
                name: prefix,
                categoryId,
                maxStock: 5,
                pricePerDay: 10,
                images: ['a.png'],
              },
            })
          ).id
          const otherCategoryId = (
            await prisma.category.create({
              data: {
                tenantId: otherTenantId,
                name: prefix,
                slug: prefix + '-b',
              },
            })
          ).id
          otherEquipmentId = (
            await prisma.equipment.create({
              data: {
                tenantId: otherTenantId,
                name: prefix,
                categoryId: otherCategoryId,
                maxStock: 5,
                pricePerDay: 10,
                images: [],
              },
            })
          ).id
          mocked.principal.mockImplementation(async () =>
            principal
              ? { ok: true, principal }
              : {
                  ok: false,
                  response: Response.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                  ),
                }
          )
        })
        beforeEach(async () => {
          as('ADMIN')
          await clean()
        })
        afterAll(async () => {
          if (tenantId) {
            await clean()
            await prisma.equipment.deleteMany({
              where: { tenantId: { in: [tenantId, otherTenantId] } },
            })
            await prisma.category.deleteMany({
              where: { tenantId: { in: [tenantId, otherTenantId] } },
            })
            await prisma.membership.deleteMany({
              where: { tenantId: { in: [tenantId, otherTenantId] } },
            })
            await prisma.user.deleteMany({
              where: { id: { in: [adminId, clientId, otherClientId] } },
            })
            await prisma.organization.deleteMany({
              where: { id: { in: [tenantId, otherTenantId] } },
            })
          }
        })

        describe('GET/DELETE /api/quotes/[id] (client portal)', () => {
          const read = (id: string) =>
            call(readClientQuote(request('/api/quotes/' + id), params(id)))
          const hide = (id: string) =>
            call(
              hideClientQuote(
                request('/api/quotes/' + id, 'DELETE'),
                params(id)
              )
            )
          it('returns the caller quote in the portal format with adjustments and payment metadata', async () => {
            const row = await quote()
            const adjustment = await prisma.quoteAdjustment.create({
              data: {
                tenantId,
                quoteId: row.id,
                category: 'TRAVEL',
                amount: '12.50',
                justification: 'Deslocamento',
                createdBy: adminId,
              },
            })
            as('CLIENT')
            const response = await read(row.id)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
              id: row.id,
              quoteCode: row.quoteCode,
              legacyExternalCode: null,
              name: prefix,
              email: `${prefix}@example.test`,
              phone: '11988887777',
              company: null,
              totalPrice: 30,
              originalTotal: 30,
              finalTotal: null,
              priceAdjustmentReason: null,
              priceAdjustedAt: null,
              lateFee: null,
              lateFeeApproved: false,
              status: 'approved',
              deliveryType: 'PICKUP',
              deliveryFee: null,
              pickupFee: null,
              deliveryAddress: null,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              approvedAt: '2031-01-02T00:00:00.000Z',
              rejectedAt: null,
              validUntil: '2031-01-09T00:00:00.000Z',
              items: [
                {
                  id: row.items[0]!.id,
                  quantity: 1,
                  days: 3,
                  startDate: '2031-01-05T00:00:00.000Z',
                  endDate: '2031-01-07T00:00:00.000Z',
                  pricePerDay: 10,
                  total: 30,
                  appliedDiscount: null,
                  appliedPeriod: null,
                  useDirectValue: false,
                  directValue: null,
                  includeWeekends: false,
                  equipment: {
                    id: equipmentId,
                    name: prefix,
                    images: ['a.png'],
                    category: { name: prefix },
                  },
                },
              ],
              payments: [
                {
                  id: row.payments[0]!.id,
                  amount: 30,
                  status: 'PENDING',
                  method: 'BOLETO',
                  dueDate: '2031-01-04T00:00:00.000Z',
                  paidAt: null,
                  metadata: { pdfUrl: 'https://boleto.example.test/1.pdf' },
                },
              ],
              adjustments: [
                {
                  id: adjustment.id,
                  category: 'TRAVEL',
                  amount: 12.5,
                  justification: 'Deslocamento',
                },
              ],
            })
          })
          it('hides boleto metadata of a rejected quote and 404s other owners, locadoras and removed quotes', async () => {
            const rejected = await quote({ status: 'REJECTED' })
            const foreign = await quote({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            const other = await quote({ userId: adminId })
            as('CLIENT')
            const response = await read(rejected.id)
            expect(response.body.status).toBe('rejected')
            expect(response.body.payments[0].metadata).toBeNull()
            for (const id of [foreign.id, other.id, 'missing'])
              expect(await read(id)).toMatchObject({
                status: 404,
                type: 'application/json',
                body: { error: 'Orçamento não encontrado' },
              })
            await prisma.quote.update({
              where: { id: rejected.id },
              data: { clientDeletedAt: new Date() },
            })
            expect((await read(rejected.id)).status).toBe(404)
          })
          it('soft-deletes only the caller quote, keeping it for the administration', async () => {
            const own = await quote({ status: 'REJECTED' })
            const other = await quote({ userId: adminId })
            as('CLIENT')
            expect(await hide(other.id)).toMatchObject({
              status: 404,
              body: { error: 'Orçamento não encontrado ou não autorizado' },
            })
            expect(await hide(own.id)).toMatchObject({
              status: 200,
              type: 'application/json',
              body: { message: 'Orçamento removido do histórico com sucesso' },
            })
            const stored = await prisma.quote.findUniqueOrThrow({
              where: { id: own.id },
            })
            expect(stored.clientDeletedAt).toEqual(expect.any(Date))
            expect(stored.status).toBe('REJECTED')
            expect((await hide(own.id)).status).toBe(200)
          })
        })

        describe('GET/DELETE /api/admin/quotes/[id]', () => {
          const read = (id: string) =>
            call(readAdminQuote(request('/api/admin/quotes/' + id), params(id)))
          const remove = (id: string) =>
            call(
              deleteAdminQuote(
                request('/api/admin/quotes/' + id, 'DELETE'),
                params(id)
              )
            )
          it('reads the locadora quote with items, user and payments for ADMIN/OPERATOR only', async () => {
            const row = await quote()
            const response = await read(row.id)
            expect(response.status).toBe(200)
            expect(Object.keys(response.body).sort()).toEqual(
              [
                ...Object.keys(row).filter(
                  (key) => key !== 'items' && key !== 'payments'
                ),
                'items',
                'user',
                'payments',
              ].sort()
            )
            expect(response.body.user).toEqual({
              id: clientId,
              name: `${prefix} client`,
              email: `${prefix}-client@example.test`,
            })
            expect(response.body.items[0].equipment).toEqual({
              id: equipmentId,
              name: prefix,
              description: null,
              pricePerDay: '10',
              images: ['a.png'],
              category: {
                name: prefix,
                iconColor: expect.anything(),
                bgColor: expect.anything(),
                fontColor: expect.anything(),
              },
            })
            expect(response.body.payments).toHaveLength(1)
            as('OPERATOR')
            expect((await read(row.id)).status).toBe(200)
            as('CLIENT')
            expect(await read(row.id)).toMatchObject({
              status: 403,
              body: { error: 'Forbidden' },
            })
            as('ADMIN')
            const foreign = await quote({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            expect(await read(foreign.id)).toMatchObject({
              status: 404,
              body: { error: 'Quote not found' },
            })
          })
          it('deletes only a quote without history and preserves quotes with charges', async () => {
            const plain = await quote({ payments: false })
            const charged = await quote()
            as('OPERATOR')
            expect(await remove(plain.id)).toMatchObject({
              status: 403,
              body: { error: 'Forbidden' },
            })
            as('ADMIN')
            expect(await remove(charged.id)).toMatchObject({
              status: 409,
              body: {
                error:
                  'Orçamento com locação ou cobrança deve ser cancelado; histórico não pode ser excluído',
              },
            })
            expect(await remove('missing')).toMatchObject({
              status: 404,
              body: { error: 'Orçamento não encontrado' },
            })
            expect(await remove(plain.id)).toMatchObject({
              status: 200,
              type: 'application/json',
              body: { message: 'Quote deleted successfully' },
            })
            expect(await prisma.quote.count({ where: { id: plain.id } })).toBe(
              0
            )
            expect(
              await prisma.quote.count({ where: { id: charged.id } })
            ).toBe(1)
          })
        })

        describe('POST /api/admin/quotes/[id]/calculate-late-fee', () => {
          const fee = (id: string, body?: unknown) =>
            call(
              quoteLateFee(
                request(
                  '/api/admin/quotes/' + id + '/calculate-late-fee',
                  'POST',
                  body
                ),
                params(id)
              )
            )
          it('calculates without writing, with the default or the informed configuration', async () => {
            const row = await quote()
            const response = await fee(row.id, {
              currentDate: '2031-01-10T00:00:00.000Z',
            })
            expect(response).toMatchObject({ status: 200, cache: 'no-store' })
            expect(response.body).toEqual({
              lateFee: expect.any(Number),
              daysLate: 3,
              calculationMethod: expect.any(String),
              config: expect.any(Object),
              baseValue: 30,
              endDate: '2031-01-07T00:00:00.000Z',
              calculationDate: '2031-01-10T00:00:00.000Z',
            })
            const custom = await fee(row.id, {
              currentDate: '2031-01-10T00:00:00.000Z',
              config: { fixedAmount: 7, maxDays: 30 },
            })
            expect(custom.body.config).toMatchObject({
              fixedAmount: 7,
              maxDays: 30,
            })
            expect(
              (await prisma.quote.findUniqueOrThrow({ where: { id: row.id } }))
                .lateFee
            ).toBeNull()
          })
          it('maps missing quote, missing end date, invalid input and client access', async () => {
            const noEnd = await quote({ endDate: null })
            expect(await fee('missing', {})).toMatchObject({
              status: 404,
              body: { error: 'Orçamento não encontrado' },
            })
            expect(await fee(noEnd.id, {})).toMatchObject({
              status: 400,
              body: { error: 'Orçamento não possui data de término definida' },
            })
            expect(
              await fee(noEnd.id, { config: { minAmount: 5, maxAmount: 1 } })
            ).toMatchObject({
              status: 400,
              body: { error: 'Dados de cálculo inválidos' },
            })
            expect(await fee(noEnd.id, '{bad')).toMatchObject({ status: 400 })
            as('CLIENT')
            expect(await fee(noEnd.id, {})).toMatchObject({
              status: 403,
              body: { error: 'Acesso administrativo não permitido' },
            })
          })
        })

        describe('DELETE /api/admin/quotes/[id]/adjustments/[adjustmentId]', () => {
          it('never deletes adjustment history and 404s adjustments of other quotes', async () => {
            const row = await quote()
            const adjustment = await prisma.quoteAdjustment.create({
              data: {
                tenantId,
                quoteId: row.id,
                category: 'OTHER',
                amount: 5,
                justification: 'x',
                createdBy: adminId,
              },
            })
            const remove = (quoteId: string, adjustmentId: string) =>
              call(
                deleteAdjustment(
                  request('/api/admin/quotes/x/adjustments/y', 'DELETE'),
                  {
                    params: Promise.resolve({ id: quoteId, adjustmentId }),
                  }
                )
              )
            expect(await remove(row.id, adjustment.id)).toEqual({
              status: 409,
              type: 'application/json',
              cache: null,
              body: {
                error:
                  'O histórico de reajustes deve ser preservado. Registre uma revisão financeira para corrigir valores.',
                code: 'ADJUSTMENT_HISTORY_PRESERVED',
              },
            })
            expect(await remove('other-quote', adjustment.id)).toMatchObject({
              status: 404,
              body: { error: 'Reajuste não encontrado' },
            })
            expect(
              await prisma.quoteAdjustment.count({
                where: { id: adjustment.id },
              })
            ).toBe(1)
          })
        })

        describe('POST /api/admin/quotes/[id]/send-boleto', () => {
          it('waits for the issued charge, then queues one notification per issuance attempt', async () => {
            const row = await quote({ payments: false })
            const send = () =>
              call(
                sendBoleto(
                  request(
                    '/api/admin/quotes/' + row.id + '/send-boleto',
                    'POST'
                  ),
                  params(row.id)
                )
              )
            expect(await send()).toMatchObject({
              status: 409,
              body: {
                error: 'Aguarde a emissão do boleto antes de solicitar o envio',
              },
            })
            const payment = await prisma.payment.findFirstOrThrow({
              where: { quoteId: row.id },
            })
            const attempt = await prisma.paymentAttempt.create({
              data: {
                tenantId,
                paymentId: payment.id,
                provider: 'ASAAS',
                externalId: 'external-' + row.id,
                status: 'ISSUED',
                amount: 30,
                dueDate: new Date('2031-01-04T00:00:00.000Z'),
                idempotencyKey: `${prefix}:${row.id}:attempt`,
              },
            })
            const sent = await send()
            expect(sent).toMatchObject({
              status: 202,
              body: {
                success: true,
                processing: 'PENDING',
                message: 'Envio solicitado',
                boleto: { paymentId: payment.id, created: false, amount: 30 },
              },
            })
            expect((await send()).status).toBe(202)
            const events = await prisma.outboxEvent.findMany({
              where: { tenantId, topic: 'payment.boleto.notify' },
            })
            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({
              aggregateId: payment.id,
              dedupeKey: `${tenantId}:payment.boleto.notify:${attempt.id}`,
              payload: {
                paymentId: payment.id,
                externalId: 'external-' + row.id,
                requestedBy: adminId,
              },
            })
            as('CLIENT')
            expect((await send()).status).toBe(403)
          })
        })

        describe('GET/POST /api/admin/quotes/[id]/adjustments', () => {
          const list = (id: string) =>
            call(
              listAdjustments(
                request('/api/admin/quotes/' + id + '/adjustments'),
                params(id)
              )
            )
          const create = (id: string, body: unknown) =>
            call(
              createAdjustment(
                request(
                  '/api/admin/quotes/' + id + '/adjustments',
                  'POST',
                  body
                ),
                params(id)
              )
            )
          it('lists the quote adjustments newest first with author and numeric amount', async () => {
            const row = await quote()
            const older = await prisma.quoteAdjustment.create({
              data: {
                tenantId,
                quoteId: row.id,
                category: 'LABOR',
                amount: '3.25',
                justification: 'antigo',
                createdBy: adminId,
                createdAt: new Date('2031-01-01T00:00:00.000Z'),
              },
            })
            const newer = await prisma.quoteAdjustment.create({
              data: {
                tenantId,
                quoteId: row.id,
                category: 'OTHER',
                amount: 4,
                justification: 'novo',
                createdBy: adminId,
                createdAt: new Date('2031-01-02T00:00:00.000Z'),
              },
            })
            as('FINANCIAL' as Role)
            const response = await list(row.id)
            expect(response.status).toBe(200)
            expect(
              response.body.adjustments.map((item: { id: string }) => item.id)
            ).toEqual([newer.id, older.id])
            expect(response.body.adjustments[1]).toEqual({
              ...JSON.parse(JSON.stringify(older)),
              amount: 3.25,
              createdByUser: {
                id: adminId,
                name: `${prefix} admin`,
                email: `${prefix}-admin@example.test`,
                image: null,
              },
            })
            as('CLIENT')
            expect(await list(row.id)).toMatchObject({
              status: 403,
              body: { error: 'Não autorizado' },
            })
            as('ADMIN')
            expect(await list('missing')).toMatchObject({
              status: 404,
              body: { error: 'Orçamento não encontrado' },
            })
          })
          it('creates the adjustment, reprices the pending base charge and queues the notification', async () => {
            const row = await quote()
            await prisma.quote.update({
              where: { id: row.id },
              data: { deliveryFee: 5, priceAdjustmentReason: 'Anterior' },
            })
            const response = await create(row.id, {
              category: 'TRAVEL',
              amount: 8,
              justification: 'Frete revisado',
              sendWhatsapp: false,
            })
            expect(response.status).toBe(202)
            expect(response.body).toEqual({
              adjustment: {
                id: expect.any(String),
                tenantId,
                quoteId: row.id,
                category: 'TRAVEL',
                amount: 8,
                justification: 'Frete revisado',
                sentEmailAt: null,
                sentEmailTo: null,
                sentWhatsappAt: null,
                sentWhatsappTo: null,
                createdBy: adminId,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
              quote: {
                id: row.id,
                quoteCode: row.quoteCode,
                originalTotal: 30,
                finalTotal: 33,
                priceAdjustmentReason:
                  'Anterior\n[Deslocamento (Frete)] Frete revisado',
              },
              emailStatus: 'queued',
              whatsappStatus: 'not_requested',
            })
            const stored = await prisma.quote.findUniqueOrThrow({
              where: { id: row.id },
            })
            expect(stored.deliveryFee?.toString()).toBe('8')
            const payment = await prisma.payment.findFirstOrThrow({
              where: { quoteId: row.id },
            })
            expect(payment.amount.toString()).toBe('33')
            expect(payment.grossAmount?.toString()).toBe('33')
            expect(payment.taxRegimeSnapshot).toBe('SIMPLES_NACIONAL')
            expect(payment.taxDocumentType).toBe('CPF')
            const events = await prisma.outboxEvent.findMany({
              where: { tenantId, topic: 'quote.adjustment.notify' },
            })
            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({
              aggregateId: row.id,
              dedupeKey: `${tenantId}:quote-adjustment:${response.body.adjustment.id}`,
              payload: {
                quoteId: row.id,
                adjustmentId: response.body.adjustment.id,
                sendEmail: true,
              },
            })
            const other = await create(row.id, {
              category: 'LABOR',
              amount: 2,
              justification: 'Hora extra',
              sendEmail: false,
            })
            expect(other.body).toMatchObject({
              quote: { finalTotal: 35 },
              emailStatus: 'not_requested',
              whatsappStatus: 'unavailable',
            })
          })
          it('records a fractional adjustment, the final total and the repriced base charge in cents', async () => {
            const row = await quote()
            const response = await create(row.id, {
              category: 'LABOR',
              amount: 10.005,
              justification: 'Hora extra',
              sendEmail: false,
              sendWhatsapp: false,
            })
            expect(response.status).toBe(202)
            // 10.005 → 10.01 (ROUND_HALF_UP); 30 + 10.01 = 40.01 é o que a cobrança pendente passa a cobrar.
            expect(response.body).toMatchObject({
              adjustment: { amount: 10.01 },
              quote: { finalTotal: 40.01 },
            })
            const stored = await prisma.quote.findUniqueOrThrow({
              where: { id: row.id },
              include: { adjustments: true, payments: true },
            })
            expect(stored.finalTotal?.toString()).toBe('40.01')
            expect(
              stored.adjustments.map((item) => item.amount.toString())
            ).toEqual(['10.01'])
            expect(
              stored.payments.map((item) => item.amount.toString())
            ).toEqual(['40.01'])
          })
          it('maps authorization, validation, missing quote, closed quote and issued charge', async () => {
            const row = await quote()
            as('CLIENT')
            expect(
              await create(row.id, {
                category: 'LABOR',
                amount: 1,
                justification: 'abc',
              })
            ).toMatchObject({
              status: 403,
              body: { error: 'Não autorizado' },
            })
            as('ADMIN')
            const invalid = await create(row.id, {
              category: 'LABOR',
              amount: -1,
              justification: 'abc',
            })
            expect(invalid.status).toBe(400)
            expect(invalid.body.error).toEqual(expect.any(String))
            expect(invalid.body.details[0]).toMatchObject({ path: ['amount'] })
            expect(
              await create('missing', {
                category: 'LABOR',
                amount: 1,
                justification: 'abc',
              })
            ).toEqual({
              status: 404,
              type: 'application/json',
              cache: null,
              body: {
                error: 'Orçamento não encontrado',
                code: 'invalid_rental',
              },
            })
            const closed = await quote({ status: 'COMPLETED' })
            expect(
              await create(closed.id, {
                category: 'LABOR',
                amount: 1,
                justification: 'abc',
              })
            ).toMatchObject({
              status: 409,
              body: {
                error:
                  'Orçamento convertido ou encerrado requer fluxo de aditivo',
                code: 'QUOTE_AMENDMENT_REQUIRED',
              },
            })
            await prisma.payment.updateMany({
              where: { quoteId: row.id },
              data: { transactionId: 'issued-1' },
            })
            expect(
              await create(row.id, {
                category: 'LABOR',
                amount: 1,
                justification: 'abc',
              })
            ).toMatchObject({
              status: 409,
              body: {
                error:
                  'Cobrança emitida ou paga requer reconciliação antes do reajuste',
                code: 'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION',
              },
            })
            expect(
              await prisma.quoteAdjustment.count({ where: { quoteId: row.id } })
            ).toBe(0)
            expect(await create(row.id, '{bad')).toMatchObject({
              status: 500,
              body: { error: 'Erro ao criar reajuste' },
            })
          })
        })

        describe('GET /api/admin/quotes', () => {
          const list = (query = '') =>
            call(listAdminQuotes(request('/api/admin/quotes' + query)))
          it('lists the locadora quotes in the administration format with pagination and status totals', async () => {
            const row = await quote({ status: 'REJECTED' })
            await prisma.quote.update({
              where: { id: row.id },
              data: {
                company: 'Construtora ABC',
                rejectedAt: new Date('2031-01-03T00:00:00.000Z'),
                rejectedBy: adminId,
                rejectionReason: 'Sem estoque',
                deliveryType: 'DELIVERY',
                deliveryAddress: {
                  logradouro: 'Rua A',
                  numero: '10',
                  bairro: 'Centro',
                  cidade: 'Porto Alegre',
                  estado: 'RS',
                  cep: '90000000',
                },
                deliveryFee: 15,
                serviceAmount: 5,
                operationType: 'RENTAL_WITH_SERVICE',
                message: 'Obra',
              },
            })
            const stored = await prisma.quote.findUniqueOrThrow({
              where: { id: row.id },
            })
            await quote({ status: 'PENDING' })
            await quote({ tenant: otherTenantId, userId: otherClientId })
            const response = await list('?status=rejected')
            expect(response).toMatchObject({ status: 200, cache: 'no-store' })
            expect(response.body.pagination).toEqual({
              page: 1,
              limit: 10,
              totalItems: 1,
              totalPages: 1,
            })
            expect(response.body.stats).toEqual({
              total: 2,
              pending: 1,
              approved: 0,
              rejected: 1,
              expired: 0,
            })
            expect(response.body.quotes).toEqual([
              {
                id: row.id,
                quoteCode: row.quoteCode,
                legacyExternalCode: null,
                paymentTerms: 'UPFRONT',
                name: prefix,
                email: `${prefix}@example.test`,
                phone: '11988887777',
                company: 'Construtora ABC',
                customerImage: null,
                cpf: '12345678909',
                cnpj: null,
                cep: null,
                equipments: [
                  {
                    id: equipmentId,
                    name: prefix,
                    quantity: 1,
                    dailyPrice: 10,
                  },
                ],
                startDate: '2031-01-05T00:00:00.000Z',
                endDate: '2031-01-07T00:00:00.000Z',
                totalPrice: 30,
                originalTotal: 30,
                finalTotal: null,
                priceAdjustmentReason: null,
                priceAdjustedAt: null,
                priceAdjustedBy: null,
                lateFee: null,
                lateFeeApproved: false,
                lateFeeApprovedAt: null,
                lateFeeApprovedBy: null,
                validUntil: '2031-01-09T00:00:00.000Z',
                rejectedAt: '2031-01-03T00:00:00.000Z',
                rejectionReason: 'Sem estoque',
                rejectedBy: {
                  id: adminId,
                  name: `${prefix} admin`,
                  image: null,
                },
                approvedAt: '2031-01-02T00:00:00.000Z',
                payments: [
                  {
                    id: row.payments[0]!.id,
                    amount: 30,
                    status: 'PENDING',
                    method: 'BOLETO',
                    dueDate: '2031-01-04T00:00:00.000Z',
                    paidAt: null,
                    metadata: { pdfUrl: 'https://boleto.example.test/1.pdf' },
                  },
                ],
                status: 'rejected',
                message: 'Obra',
                deliveryType: 'DELIVERY',
                deliveryAddress: {
                  street: 'Rua A',
                  number: '10',
                  complement: null,
                  neighborhood: 'Centro',
                  city: 'Porto Alegre',
                  state: 'RS',
                  zipCode: '90000000',
                },
                deliveryFee: 15,
                pickupFee: null,
                operationType: 'RENTAL_WITH_SERVICE',
                serviceAmount: 5,
                createdAt: stored.createdAt.toISOString(),
                updatedAt: stored.updatedAt.toISOString(),
                items: [
                  {
                    id: row.items[0]!.id,
                    quantity: 1,
                    days: 3,
                    startDate: '2031-01-05T00:00:00.000Z',
                    endDate: '2031-01-07T00:00:00.000Z',
                    includeWeekends: false,
                    appliedDiscount: null,
                    appliedPeriod: null,
                    useDirectValue: false,
                    directValue: null,
                    pricePerDay: 10,
                    total: 30,
                    equipment: {
                      id: equipmentId,
                      name: prefix,
                      images: ['a.png'],
                    },
                  },
                ],
              },
            ])
          })
          it('searches, filters by period and value and pages newest first', async () => {
            const first = await quote({ status: 'PENDING' })
            await prisma.quote.update({
              where: { id: first.id },
              data: {
                createdAt: new Date(Date.now() - 60_000),
                startDate: new Date('2020-01-01T00:00:00.000Z'),
              },
            })
            const second = await quote({ status: 'APPROVED' })
            await prisma.quote.update({
              where: { id: second.id },
              data: { total: 2500, name: 'Cliente Especial' },
            })
            const ids = async (query: string) =>
              (await list(query)).body.quotes.map(
                (row: { id: string }) => row.id
              )
            expect(await ids('')).toEqual([second.id, first.id])
            expect(await ids('?search=especial')).toEqual([second.id])
            expect(await ids('?search=' + first.quoteCode)).toEqual([first.id])
            expect(await ids('?valueRange=high')).toEqual([second.id])
            expect(await ids('?valueRange=low')).toEqual([first.id])
            expect(await ids('?valueRange=medium')).toEqual([])
            expect(await ids('?status=all&period=week')).toEqual([second.id])
            expect(await ids('?period=unknown')).toEqual([second.id, first.id])
            const paged = await list('?limit=1&page=2')
            expect(
              paged.body.quotes.map((row: { id: string }) => row.id)
            ).toEqual([first.id])
            expect(paged.body.pagination).toEqual({
              page: 2,
              limit: 1,
              totalItems: 2,
              totalPages: 2,
            })
          })
          it('rejects invalid page, limit and status and forbids clients', async () => {
            expect(await list('?page=0')).toMatchObject({
              status: 400,
              body: { error: "Parâmetro 'page' inválido." },
            })
            expect(await list('?limit=101')).toMatchObject({
              status: 400,
              body: { error: "Parâmetro 'limit' inválido." },
            })
            expect(await list('?status=expired')).toMatchObject({
              status: 400,
              body: { error: 'Status inválido' },
            })
            as('CLIENT')
            expect(await list()).toMatchObject({
              status: 403,
              body: { error: 'Acesso administrativo não permitido' },
            })
          })
        })

        describe('PATCH /api/admin/quotes/[id]', () => {
          const patch = (id: string, body: unknown) =>
            call(
              patchAdminQuote(
                request('/api/admin/quotes/' + id, 'PATCH', body),
                params(id)
              )
            )
          const stored = (id: string) =>
            prisma.quote.findUniqueOrThrow({
              where: { id },
              include: { items: true, payments: true },
            })
          const events = (topic: string) =>
            prisma.outboxEvent.findMany({
              where: { tenantId, topic },
              orderBy: { createdAt: 'asc' },
            })

          it('forbids clients, passes through denied principals and rejects fields outside the allow-list', async () => {
            const row = await quote({ status: 'PENDING' })
            as('CLIENT')
            expect(await patch(row.id, { adminNotes: 'x' })).toMatchObject({
              status: 403,
              body: { error: 'Forbidden' },
            })
            principal = null
            expect((await patch(row.id, { adminNotes: 'x' })).status).toBe(401)
            as('OPERATOR')
            expect(await patch(row.id, { tenantId: otherTenantId })).toEqual({
              status: 400,
              type: 'application/json',
              cache: null,
              body: { error: 'Campo não editável no orçamento' },
            })
            expect(await patch('missing', { adminNotes: 'x' })).toMatchObject({
              status: 404,
              body: { error: 'Quote not found' },
            })
            expect(
              await patch(row.id, { paymentTerms: 'later' })
            ).toMatchObject({
              status: 400,
              body: { error: 'paymentTerms inválido' },
            })
            expect(
              await patch(row.id, { operationType: 'SALE' })
            ).toMatchObject({
              status: 400,
              body: { error: 'operationType inválido' },
            })
            expect((await stored(row.id)).adminNotes).toBeNull()
          })

          it('updates allowed fields and answers with the re-read quote, items and payments', async () => {
            const row = await quote({ status: 'PENDING' })
            const response = await patch(row.id, {
              adminNotes: 'nota',
              paymentTerms: 'on_delivery',
              operationType: 'RENTAL_WITH_SERVICE',
              serviceAmount: '7.5',
            })
            expect(response.status).toBe(200)
            const after = await stored(row.id)
            expect(after).toMatchObject({
              adminNotes: 'nota',
              paymentTerms: 'ON_DELIVERY',
              operationType: 'RENTAL_WITH_SERVICE',
            })
            expect(after.serviceAmount?.toString()).toBe('7.5')
            expect(Object.keys(response.body).sort()).toEqual(
              [
                ...Object.keys(after).filter(
                  (key) => key !== 'items' && key !== 'payments'
                ),
                'items',
                'payments',
              ].sort()
            )
            expect(response.body.items[0].equipment).toEqual({
              id: equipmentId,
              name: prefix,
              pricePerDay: '10',
            })
            expect(response.body.payments).toHaveLength(1)
            expect(response.body.updatedAt).toBe(after.updatedAt.toISOString())
            expect(await events('quote.status.notify')).toHaveLength(0)
          })

          it('adjusts the final total with a justification and refreshes the boleto obligation', async () => {
            // Aprovado: só um orçamento aprovado tem boleto a garantir (o consumidor recusa os demais com 409).
            const row = await quote()
            const missing = await patch(row.id, { finalTotal: 40 })
            expect(missing.status).toBe(400)
            expect(missing.body.error).toBe(
              'Justificativa é obrigatória ao editar o valor final do orçamento'
            )
            for (const finalTotal of [0, 'abc'])
              expect(
                await patch(row.id, { finalTotal, priceAdjustmentReason: 'x' })
              ).toMatchObject({
                status: 400,
                body: { error: 'Valor final deve ser maior que zero' },
              })
            await prisma.quote.update({
              where: { id: row.id },
              data: { originalTotal: null },
            })
            const response = await patch(row.id, {
              finalTotal: '45.5',
              priceAdjustmentReason: '  Frete revisado  ',
            })
            expect(response.status).toBe(200)
            const after = await stored(row.id)
            expect(after.finalTotal?.toString()).toBe('45.5')
            expect(after.originalTotal?.toString()).toBe('30')
            expect(after).toMatchObject({
              priceAdjustmentReason: 'Frete revisado',
              priceAdjustedBy: adminId,
            })
            expect(after.priceAdjustedAt).toEqual(expect.any(Date))
            // A cobrança pendente nunca emitida passa a cobrar o valor final (antes ficava em 30 e o ensure falhava).
            expect(after.payments[0]!.amount.toString()).toBe('45.5')
            const ensure = await events('quote.boleto.ensure')
            expect(ensure).toHaveLength(1)
            expect(ensure[0]).toMatchObject({
              aggregateId: row.id,
              payload: { quoteId: row.id },
              dedupeKey: `${tenantId}:quote-boleto:${row.id}:${after.updatedAt.toISOString()}`,
            })
          })

          it('records the final total, the approved late fee and recalculated item totals in cents', async () => {
            const row = await quote({ status: 'PENDING' })
            expect(
              (
                await patch(row.id, {
                  finalTotal: '128.5714',
                  priceAdjustmentReason: 'Semana direta',
                })
              ).status
            ).toBe(200)
            expect((await stored(row.id)).finalTotal?.toString()).toBe('128.57')
            expect(
              (
                await patch(row.id, {
                  lateFee: '7.7142',
                  lateFeeApproved: true,
                })
              ).status
            ).toBe(200)
            let after = await stored(row.id)
            expect(after.lateFee?.toString()).toBe('7.71')
            // 128.57 + 7.71: o valor final com multa é o que a obrigação cobra.
            expect(after.finalTotal?.toString()).toBe('136.28')

            const item = after.items[0]!
            await prisma.quoteItem.update({
              where: { id: item.id },
              data: { pricePerDay: '14.285714285714286' },
            })
            expect(
              (
                await patch(row.id, {
                  updateItemDates: {
                    itemId: item.id,
                    startDate: '2031-01-05',
                    endDate: '2031-01-07',
                    includeWeekends: true,
                  },
                })
              ).status
            ).toBe(200)
            after = await stored(row.id)
            // 3 dias · 100/7 = 42.857… → 42.86
            expect(after.items[0]!.total.toString()).toBe('42.86')
            expect(after.total.toString()).toBe('42.86')
          })

          it('approves a late fee only with a positive value and adds it to the final total', async () => {
            const row = await quote({ status: 'PENDING' })
            const refused = await patch(row.id, { lateFeeApproved: true })
            expect(refused.status).toBe(400)
            expect(refused.body.error).toBe(
              'Não é possível aprovar multa sem valor calculado ou com valor zero'
            )
            expect(
              (await patch(row.id, { lateFee: 10, lateFeeApproved: true }))
                .status
            ).toBe(200)
            let after = await stored(row.id)
            expect(after.lateFee?.toString()).toBe('10')
            expect(after.finalTotal?.toString()).toBe('40')
            expect(after).toMatchObject({
              lateFeeApproved: true,
              lateFeeApprovedBy: adminId,
            })
            expect(after.priceAdjustmentReason).toMatch(
              /^Multa por atraso aprovada: R\$\s10,00$/
            )
            expect(
              (await patch(row.id, { lateFeeApproved: false })).status
            ).toBe(200)
            after = await stored(row.id)
            expect(after).toMatchObject({
              lateFeeApproved: false,
              lateFeeApprovedAt: null,
              lateFeeApprovedBy: null,
            })
            // Revogar tira a multa do valor final (antes ficava em 40 e a obrigação cobrava a multa revogada).
            expect(after.finalTotal?.toString()).toBe('30')
          })

          it('approves after checking stock, records the approver and notifies once per status change', async () => {
            vi.stubEnv('AUTO_GENERATE_BOLETO_ON_QUOTE', 'true')
            try {
              const row = await quote({ status: 'PENDING' })
              await prisma.quote.update({
                where: { id: row.id },
                data: { approvedAt: null },
              })
              const response = await patch(row.id, { status: 'APPROVED' })
              expect(response.status).toBe(200)
              const after = await stored(row.id)
              expect(after).toMatchObject({
                status: 'APPROVED',
                approvedBy: adminId,
              })
              expect(after.approvedAt).toEqual(expect.any(Date))
              const notify = await events('quote.status.notify')
              expect(notify).toHaveLength(1)
              expect(notify[0]).toMatchObject({
                payload: { quoteId: row.id, status: 'APPROVED' },
                dedupeKey: `${tenantId}:quote-status:${row.id}:APPROVED:${after.updatedAt.toISOString()}`,
              })
              expect(await events('quote.boleto.ensure')).toHaveLength(1)
              expect((await patch(row.id, { status: 'APPROVED' })).status).toBe(
                200
              )
              expect(await events('quote.status.notify')).toHaveLength(1)
              expect((await stored(row.id)).approvedAt).toEqual(
                after.approvedAt
              )
            } finally {
              vi.unstubAllEnvs()
            }
          })

          it('refuses approval when the period has no stock and when AT_END lacks a customer', async () => {
            await prisma.equipment.update({
              where: { id: equipmentId },
              data: { maxStock: 0 },
            })
            try {
              const row = await quote({ status: 'PENDING' })
              expect(await patch(row.id, { status: 'APPROVED' })).toEqual({
                status: 400,
                type: 'application/json',
                cache: null,
                body: {
                  error: `Equipamento ${prefix}: Apenas 0 unidade(s) disponível(is). Solicitado: 1`,
                },
              })
            } finally {
              await prisma.equipment.update({
                where: { id: equipmentId },
                data: { maxStock: 5 },
              })
            }
            const guest = await quote({ status: 'PENDING', userId: null })
            expect(
              await patch(guest.id, {
                status: 'APPROVED',
                paymentTerms: 'AT_END',
              })
            ).toMatchObject({
              status: 400,
              body: {
                error:
                  'Fluxo AT_END requer orçamento vinculado a um cliente autenticado',
              },
            })
            expect((await stored(guest.id)).status).toBe('PENDING')
          })

          it('converts an AT_END approval in the same transaction and protects the converted quote', async () => {
            const row = await quote({ status: 'PENDING', payments: false })
            const response = await patch(row.id, {
              status: 'APPROVED',
              paymentTerms: 'AT_END',
            })
            expect(response.status).toBe(200)
            const after = await stored(row.id)
            expect(after).toMatchObject({
              status: 'COMPLETED',
              paymentTerms: 'AT_END',
            })
            expect(after.convertedToRentalId).toEqual(expect.any(String))
            expect(response.body).toMatchObject({
              status: 'COMPLETED',
              convertedToRentalId: after.convertedToRentalId,
            })
            expect(await events('quote.status.notify')).toHaveLength(1)
            expect((await events('quote.status.notify'))[0]!.dedupeKey).toBe(
              `${tenantId}:quote-converted:${after.convertedToRentalId}`
            )
            expect(await patch(row.id, { status: 'PENDING' })).toMatchObject({
              status: 409,
              body: {
                error:
                  'Orçamento convertido não pode voltar a um estado anterior',
              },
            })
            expect(
              await patch(row.id, {
                finalTotal: 50,
                priceAdjustmentReason: 'x',
              })
            ).toMatchObject({
              status: 409,
              body: {
                error:
                  'Orçamento convertido exige ajuste próprio; a locação e o contrato existentes são preservados',
              },
            })
          })

          it('rejects with reason, cancels the linked rental and notifies', async () => {
            const row = await quote({ status: 'APPROVED' })
            const rental = await prisma.rentals.create({
              data: {
                tenantId,
                id: `rental_${randomUUID()}`,
                userid: clientId,
                quoteId: row.id,
                startdate: new Date('2031-01-05T00:00:00.000Z'),
                enddate: new Date('2031-01-07T00:00:00.000Z'),
                total: 30,
                status: 'PENDING',
              },
            })
            const response = await patch(row.id, {
              status: 'REJECTED',
              rejectionReason: '  Sem estoque  ',
            })
            expect(response.status).toBe(200)
            const after = await stored(row.id)
            expect(after).toMatchObject({
              status: 'REJECTED',
              rejectionReason: 'Sem estoque',
              rejectedBy: adminId,
            })
            expect(after.rejectedAt).toEqual(expect.any(Date))
            expect(
              (
                await prisma.rentals.findUniqueOrThrow({
                  where: { id: rental.id },
                })
              ).status
            ).toBe('CANCELLED')
            expect((await events('quote.status.notify'))[0]).toMatchObject({
              payload: { quoteId: row.id, status: 'REJECTED' },
            })
          })

          it('removes an item, recalculates the total and reprices pending charges', async () => {
            const row = await quote({ status: 'PENDING' })
            const extra = await prisma.quoteItem.create({
              data: {
                tenantId,
                quoteId: row.id,
                equipmentId,
                quantity: 1,
                days: 2,
                pricePerDay: 10,
                total: 20,
              },
            })
            const unknown = await patch(row.id, {
              removeItemId: 'missing-item',
            })
            expect(unknown.status).toBe(400)
            expect(unknown.body.error).toBe(
              'Item não encontrado neste orçamento'
            )
            expect(
              (await patch(row.id, { removeItemId: row.items[0]!.id })).status
            ).toBe(200)
            const after = await stored(row.id)
            expect(after.items.map((item) => item.id)).toEqual([extra.id])
            expect(after.total.toString()).toBe('20')
            expect(after.payments[0]!.amount.toString()).toBe('20')
            expect(await events('quote.boleto.ensure')).toHaveLength(0)
          })

          it('reprices an item for new dates and validates the date input', async () => {
            const row = await quote({ status: 'PENDING' })
            const itemId = row.items[0]!.id
            expect(
              await patch(row.id, {
                updateItemDates: {
                  itemId: 'missing',
                  startDate: '2031-02-03',
                  endDate: '2031-02-04',
                },
              })
            ).toMatchObject({
              status: 400,
              body: { error: 'Item não encontrado neste orçamento' },
            })
            expect(
              await patch(row.id, {
                updateItemDates: { itemId, startDate: '2031-02-03' },
              })
            ).toMatchObject({
              status: 400,
              body: { error: 'Data início e data fim são obrigatórias' },
            })
            expect(
              await patch(row.id, {
                updateItemDates: {
                  itemId,
                  startDate: '2031-02-05',
                  endDate: '2031-02-03',
                },
              })
            ).toMatchObject({
              status: 400,
              body: {
                error: 'Data fim deve ser igual ou posterior à data início',
              },
            })
            expect(
              (
                await patch(row.id, {
                  updateItemDates: {
                    itemId,
                    startDate: '2031-02-03',
                    endDate: '2031-02-09',
                  },
                })
              ).status
            ).toBe(200)
            let after = await stored(row.id)
            expect(after.items[0]).toMatchObject({
              days: 6,
              includeWeekends: false,
            })
            expect(after.items[0]!.startDate).toEqual(new Date(2031, 1, 3))
            expect(after.items[0]!.total.toString()).toBe('60')
            expect(after.total.toString()).toBe('60')
            expect(after.payments[0]!.amount.toString()).toBe('60')
            expect(
              (
                await patch(row.id, {
                  updateItemDates: {
                    itemId,
                    startDate: '2031-02-03T00:00',
                    endDate: '2031-02-09',
                    includeWeekends: true,
                  },
                })
              ).status
            ).toBe(200)
            after = await stored(row.id)
            expect(after.items[0]).toMatchObject({
              days: 7,
              includeWeekends: true,
            })
            expect(after.total.toString()).toBe('70')
          })

          it('recomputes totals with delivery and pickup fees and propagates includeWeekends to every item', async () => {
            const row = await quote({ status: 'PENDING' })
            await prisma.quote.update({
              where: { id: row.id },
              data: { finalTotal: 99 },
            })
            const response = await patch(row.id, {
              deliveryFee: 12.5,
              pickupFee: '7.5',
              includeWeekends: true,
            })
            expect(response.status).toBe(200)
            const after = await stored(row.id)
            expect(after.total.toString()).toBe('50')
            expect(after.originalTotal?.toString()).toBe('50')
            // O valor final passa a incluir o frete sem descartar o valor final gravado (99 sobre 30):
            // a diferença de 69 fica como reajuste vigente e a obrigação é 50 + 69 (antes o frete
            // sobrescrevia o valor final com o total — achado 13).
            expect(after.finalTotal?.toString()).toBe('119')
            expect(
              (
                await prisma.quoteAdjustment.findMany({
                  where: { quoteId: row.id },
                })
              ).map((item) => [item.category, item.amount.toString()])
            ).toEqual([['OTHER', '69']])
            expect(after.deliveryFee?.toString()).toBe('12.5')
            expect(after.items.every((item) => item.includeWeekends)).toBe(true)
            expect(after.payments[0]!.amount.toString()).toBe('119')
            expect(response.body.items[0].includeWeekends).toBe(true)
          })

          it('removes the approval without changing the status', async () => {
            const row = await quote({ status: 'PENDING' })
            await prisma.quote.update({
              where: { id: row.id },
              data: { approvedAt: new Date(), approvedBy: adminId },
            })
            expect((await patch(row.id, { removeApproval: true })).status).toBe(
              200
            )
            expect(await stored(row.id)).toMatchObject({
              status: 'PENDING',
              approvedAt: null,
              approvedBy: null,
            })
          })
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
