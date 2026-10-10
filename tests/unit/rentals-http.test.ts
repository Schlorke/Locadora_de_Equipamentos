import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { withTestPlatformTransaction } from '../helpers/platform-fixture'
/**
 * Caracterização HTTP das rotas de locação e de conversão/envio de orçamento.
 * Os handlers reais rodam sobre o PostgreSQL descartável; o principal é fixado
 * pelo teste (a resolução de sessão/host é de outro módulo). Cada caso fixa
 * status, corpo e efeitos persistidos para que a extração para
 * @gb-locacoes/backend/rentals e /quotations não altere o contrato.
 */
import { randomUUID } from 'node:crypto'
import Decimal from 'decimal.js'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocked = vi.hoisted(() => ({
  principal: vi.fn(),
  cronTenant: { id: '' },
}))
// O agendador multi-locadora é de outro módulo: aqui o job roda só para a locadora do teste.
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
import { NextRequest } from 'next/server'
let tenantId: string
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()
  if (!process.env.TEST_DATABASE_URL)
    return { ...actual, getDatabaseRuntime: () => ({ prisma: undefined }) }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const connectionString = requireTestDatabase(process.env)
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Explicit disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({ connectionString, max: 8 })
  fixtureDatabase.pool = pool
  const fixturePrisma = (fixtureDatabase.prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  }))
  fixtureDatabase.prisma = fixturePrisma
  return { ...actual, getDatabaseRuntime: () => ({ prisma: fixturePrisma }) }
})
vi.mock('../../apps/services/api/src/host/tenant-cron', () => ({
  runTenantCron: (
    _request: Request,
    job: (
      _context: { tenantId: string },
      _budget: { deadline: number; minRemainingMs: number }
    ) => Promise<Response>
  ) =>
    job(
      { tenantId: mocked.cronTenant.id },
      { deadline: Infinity, minRemainingMs: 0 }
    ),
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
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/quotes/[id]/convert-to-rental/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/quotes/[id]/send-adjusted-quote/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/rentals/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/rentals/[id]/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/rentals/[id]/checkin/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/rentals/[id]/checkout/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/rentals/[id]/extend/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/admin/rentals/[id]/calculate-late-fee/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/client/rentals/[id]/extend/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/client/rentals/route'
import * as serviceRoute10 from '../../apps/services/api/src/app/api/client/rentals/[id]/route'
import * as serviceRoute11 from '../../apps/services/api/src/app/api/cron/auto-convert-quotes/route'
import * as serviceRoute12 from '../../apps/services/api/src/app/api/cron/expire-quotes/route'

const HOSTS = [
  [
    'service',
    {
      convertToRental: serviceRoute0.POST,
      sendAdjustedQuote: serviceRoute1.POST,
      listRentals: serviceRoute2.GET,
      createRental: serviceRoute2.POST,
      readRental: serviceRoute3.GET,
      patchRental: serviceRoute3.PATCH,
      cancelRental: serviceRoute3.DELETE,
      checkinRoute: serviceRoute4.POST,
      checkoutRoute: serviceRoute5.POST,
      adminExtend: serviceRoute6.POST,
      calculateLateFee: serviceRoute7.POST,
      clientExtend: serviceRoute8.POST,
      clientRentals: serviceRoute9.GET,
      clientRental: serviceRoute10.GET,
      hideClientRental: serviceRoute10.DELETE,
      autoConvertCron: serviceRoute11.GET,
      expireQuotesCron: serviceRoute12.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      convertToRental,
      sendAdjustedQuote,
      listRentals,
      createRental,
      readRental,
      patchRental,
      cancelRental,
      checkinRoute,
      checkoutRoute,
      adminExtend,
      calculateLateFee,
      clientExtend,
      clientRentals,
      clientRental,
      hideClientRental,
      autoConvertCron,
      expireQuotesCron,
    }
  ) => {
    type Role = 'ADMIN' | 'OPERATOR' | 'CLIENT'
    type Handler = (
      _request: NextRequest,
      _context: { params: Promise<{ id: string }> }
    ) => Promise<Response>

    const day = 86_400_000
    const date = (offset: number) =>
      new Date(Date.UTC(2032, 5, 1) + offset * day)
    const prefix = `rentals-http-${randomUUID()}`
    const origin = 'https://app.example.test'
    let otherTenantId: string
    let adminId: string
    let clientId: string
    let otherClientId: string
    let equipmentId: string
    let scarceEquipmentId: string
    let otherEquipmentId: string
    let categoryId: string
    let principal: {
      tenantId: string
      userId: string
      membershipId: string
      role: Role
    } | null
    const quoteIds: string[] = []

    const as = (role: Role, userId?: string, tenant?: string) => {
      principal = {
        tenantId: tenant ?? tenantId,
        userId: userId ?? (role === 'CLIENT' ? clientId : adminId),
        membershipId: 'member-' + role,
        role,
      }
    }
    const deny = () => {
      principal = null
    }
    const request = (path: string, method = 'GET', body?: unknown) =>
      new NextRequest(origin + path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { 'content-type': 'application/json' },
              body: typeof body === 'string' ? body : JSON.stringify(body),
            }),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    async function call(response: Promise<Response> | Response) {
      const resolved = await response
      return {
        status: resolved.status,
        type: resolved.headers.get('content-type'),
        body: await resolved.json(),
      }
    }
    const post = (handler: Handler, id: string, body?: unknown) =>
      call(handler(request(`/api/x/${id}`, 'POST', body ?? {}), params(id)))

    async function paidQuote(
      options: {
        paid?: boolean
        paymentTerms?: 'UPFRONT' | 'AT_END'
        status?: 'APPROVED' | 'PENDING' | 'REJECTED'
        equipment?: string
        tenant?: string
        userId?: string
        adjusted?: boolean
      } = {}
    ) {
      const tenant = options.tenant ?? tenantId
      const quote = await prisma.quote.create({
        data: {
          tenantId: tenant,
          name: prefix,
          email: `${prefix}@example.test`,
          phone: '00000000000',
          userId: options.userId ?? clientId,
          status: options.status ?? 'APPROVED',
          approvedAt: new Date(),
          paymentTerms: options.paymentTerms ?? 'UPFRONT',
          total: 30,
          startDate: date(1),
          endDate: date(3),
          ...(options.adjusted
            ? {
                finalTotal: 30,
                priceAdjustmentReason: 'Frete revisado',
                priceAdjustedAt: new Date('2032-01-01T10:00:00.000Z'),
              }
            : {}),
          items: {
            create: {
              tenantId: tenant,
              equipmentId:
                options.equipment ??
                (tenant === tenantId ? equipmentId : otherEquipmentId),
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
              tenantId: tenant,
              amount: 30,
              method: 'PIX',
              type: 'DEPOSIT',
              status: options.paid === false ? 'PENDING' : 'PAID',
              dueDate: date(1),
            },
          },
        },
      })
      quoteIds.push(quote.id)
      return quote
    }

    async function rental(
      options: {
        status?: 'PENDING' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED'
        start?: Date
        end?: Date
        userId?: string
        quoteId?: string
        equipment?: string
        tenant?: string
      } = {}
    ) {
      const tenant = options.tenant ?? tenantId
      const start = options.start ?? date(10)
      const end = options.end ?? date(12)
      return prisma.rentals.create({
        data: {
          tenantId: tenant,
          id: `rental_${randomUUID()}`,
          userid: options.userId ?? clientId,
          quoteId: options.quoteId,
          startdate: start,
          enddate: end,
          total: 30,
          status: options.status ?? 'ACTIVE',
          ...(options.status === 'ACTIVE' || options.status === undefined
            ? { checkOutAt: start }
            : {}),
          rental_items: {
            create: {
              tenantId: tenant,
              id: `rental_item_${randomUUID()}`,
              equipmentid:
                options.equipment ??
                (tenant === tenantId ? equipmentId : otherEquipmentId),
              quantity: 1,
              priceperday: 10,
              totaldays: 3,
              totalprice: 30,
              startDate: start,
              endDate: end,
            },
          },
        },
      })
    }

    async function documents(rentalId: string) {
      for (const type of [
        'ID_DOCUMENT',
        'SELFIE',
        'SIGNED_CONTRACT',
        'CPF_CNPJ_PROOF',
      ] as const)
        await prisma.clientDocument.create({
          data: {
            tenantId,
            userId: clientId,
            rentalId,
            type,
            filePath: '/test/fixture',
            fileName: 'fixture',
            mimeType: 'text/plain',
            fileSize: 1,
            uploadedBy: clientId,
          },
        })
    }

    async function clean() {
      const tenants = [tenantId, otherTenantId]
      const rentals = await prisma.rentals.findMany({
        where: { tenantId: { in: tenants } },
        select: { id: true },
      })
      const rentalIds = rentals.map((row) => row.id)
      await prisma.clientDocument.deleteMany({
        where: { tenantId: { in: tenants } },
      })
      await prisma.outboxEvent.deleteMany({
        where: { tenantId: { in: tenants } },
      })
      await prisma.payment.deleteMany({ where: { tenantId: { in: tenants } } })
      await prisma.rental_items.deleteMany({
        where: { rentalid: { in: rentalIds } },
      })
      await prisma.rentals.deleteMany({ where: { id: { in: rentalIds } } })
      await prisma.quoteItem.deleteMany({
        where: { quoteId: { in: quoteIds } },
      })
      await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
      quoteIds.length = 0
    }

    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'HTTP characterization of rental and quote conversion routes (disposable PostgreSQL)',
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
          const user = async (suffix: string) =>
            (
              await prisma.user.create({
                data: {
                  email: `${prefix}-${suffix}@example.test`,
                  name: `${prefix} ${suffix}`,
                  phone: '11999999999',
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
                images: [],
              },
            })
          ).id
          scarceEquipmentId = (
            await prisma.equipment.create({
              data: {
                tenantId,
                name: prefix + ' scarce',
                categoryId,
                maxStock: 1,
                pricePerDay: 10,
                images: [],
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

        describe('POST /api/admin/quotes/[id]/convert-to-rental', () => {
          it('passes through a denied principal and forbids non-admins before reading the body', async () => {
            const quote = await paidQuote()
            deny()
            expect(await post(convertToRental, quote.id)).toMatchObject({
              status: 401,
              body: { error: 'Authentication required' },
            })
            as('OPERATOR')
            expect(await post(convertToRental, quote.id, '{bad')).toEqual({
              status: 403,
              type: 'application/json',
              body: { error: 'Forbidden' },
            })
            expect(
              await prisma.rentals.count({ where: { quoteId: quote.id } })
            ).toBe(0)
          })
          it('converts a paid quote with 201, never generating a boleto, and repeats idempotently', async () => {
            const quote = await paidQuote()
            const first = await post(convertToRental, quote.id, {
              generateBoleto: true,
              boletoDueDate: '2032-07-01',
            })
            expect(first.status).toBe(201)
            expect(first.body).toEqual({
              rentalId: expect.stringMatching(/^rental_/),
              boletoGenerated: false,
            })
            expect(await post(convertToRental, quote.id)).toEqual({
              status: 201,
              type: 'application/json',
              body: first.body,
            })
            expect(
              await prisma.payment.count({
                where: { rentalId: first.body.rentalId, method: 'BOLETO' },
              })
            ).toBe(0)
          })
          it('maps rule failures to their status and message', async () => {
            const other = await paidQuote({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            expect(await post(convertToRental, other.id)).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Orçamento não encontrado' },
            })
            const unpaid = await paidQuote({ paid: false })
            expect(await post(convertToRental, unpaid.id)).toMatchObject({
              status: 400,
              body: {
                error:
                  'Pagamento ainda não confirmado para reservar o orçamento',
              },
            })
            const rejected = await paidQuote({ status: 'REJECTED' })
            expect(await post(convertToRental, rejected.id)).toMatchObject({
              status: 400,
              body: { error: 'Orçamento rejeitado não pode ser convertido' },
            })
          })
          it('answers 400 with Zod details for an invalid body and 500 for malformed JSON', async () => {
            const quote = await paidQuote()
            const invalid = await post(convertToRental, quote.id, {
              generateBoleto: 'yes',
            })
            expect(invalid.status).toBe(400)
            expect(invalid.body.error).toBe('Validation error')
            expect(invalid.body.details[0]).toMatchObject({
              path: ['generateBoleto'],
            })
            expect(await post(convertToRental, quote.id, '{bad')).toMatchObject(
              {
                status: 500,
                body: { error: 'Internal server error' },
              }
            )
            expect(
              await prisma.rentals.count({ where: { quoteId: quote.id } })
            ).toBe(0)
          })
        })

        describe('POST /api/admin/quotes/[id]/send-adjusted-quote', () => {
          it('allows ADMIN and OPERATOR, forbids CLIENT and queues one notification per adjustment', async () => {
            const quote = await paidQuote({ adjusted: true })
            as('CLIENT')
            expect(await post(sendAdjustedQuote, quote.id)).toEqual({
              status: 403,
              type: 'application/json',
              body: { error: 'Não autorizado' },
            })
            as('OPERATOR')
            expect(await post(sendAdjustedQuote, quote.id)).toEqual({
              status: 202,
              type: 'application/json',
              body: { success: true, emailStatus: 'queued' },
            })
            as('ADMIN')
            expect((await post(sendAdjustedQuote, quote.id)).status).toBe(202)
            const events = await prisma.outboxEvent.findMany({
              where: {
                tenantId,
                topic: 'quote.adjustment.notify',
                aggregateId: quote.id,
              },
            })
            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({
              dedupeKey: `${tenantId}:quote-adjustment-send:${quote.id}:2032-01-01T10:00:00.000Z`,
              payload: {
                quoteId: quote.id,
                adjustedAt: '2032-01-01T10:00:00.000Z',
                sendEmail: true,
              },
            })
          })
          it('returns 404/409 with code for a foreign or unadjusted quote without queueing', async () => {
            const foreign = await paidQuote({
              tenant: otherTenantId,
              userId: otherClientId,
              adjusted: true,
            })
            expect(await post(sendAdjustedQuote, foreign.id)).toEqual({
              status: 404,
              type: 'application/json',
              body: {
                error: 'Orçamento não encontrado',
                code: 'invalid_rental',
              },
            })
            const plain = await paidQuote()
            expect(await post(sendAdjustedQuote, plain.id)).toEqual({
              status: 409,
              type: 'application/json',
              body: {
                error: 'Orçamento não possui ajuste vigente para envio',
                code: 'invalid_rental',
              },
            })
            const rejected = await paidQuote({
              adjusted: true,
              status: 'REJECTED',
            })
            expect((await post(sendAdjustedQuote, rejected.id)).status).toBe(
              409
            )
            expect(
              await prisma.outboxEvent.count({ where: { tenantId } })
            ).toBe(0)
          })
          it('refuses a suspended locadora with the rental transaction error', async () => {
            const quote = await paidQuote({ adjusted: true })
            await withTestPlatformTransaction(prisma, async (tx) =>
              tx.organization.update({
                where: { id: tenantId },
                data: { status: 'SUSPENDED' },
              })
            )
            try {
              expect(await post(sendAdjustedQuote, quote.id)).toEqual({
                status: 403,
                type: 'application/json',
                body: {
                  error: 'Locadora indisponível',
                  code: 'tenant_inactive',
                },
              })
            } finally {
              await withTestPlatformTransaction(prisma, async (tx) =>
                tx.organization.update({
                  where: { id: tenantId },
                  data: { status: 'ACTIVE' },
                })
              )
            }
          })
        })

        describe('GET/POST /api/admin/rentals', () => {
          const list = (query = '') =>
            call(listRentals(request('/api/admin/rentals' + query)))
          it('forbids non-admins and passes through a denied principal', async () => {
            as('OPERATOR')
            expect(await list()).toEqual({
              status: 403,
              type: 'application/json',
              body: { error: 'Forbidden' },
            })
            deny()
            expect((await list()).status).toBe(401)
            as('OPERATOR')
            expect(
              await call(
                createRental(request('/api/admin/rentals', 'POST', {}))
              )
            ).toMatchObject({ status: 403, body: { error: 'Forbidden' } })
          })
          it('lists quote-linked rentals of the locadora, hiding cancelled, orphan and rejected ones by default', async () => {
            const linkedQuote = await paidQuote()
            const linked = await rental({
              status: 'PENDING',
              quoteId: linkedQuote.id,
            })
            const orphan = await rental({ status: 'ACTIVE' })
            const cancelledQuote = await paidQuote()
            await rental({ status: 'CANCELLED', quoteId: cancelledQuote.id })
            const rejectedQuote = await paidQuote({ status: 'REJECTED' })
            await rental({ status: 'PENDING', quoteId: rejectedQuote.id })
            const foreignQuote = await paidQuote({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            await rental({
              tenant: otherTenantId,
              userId: otherClientId,
              quoteId: foreignQuote.id,
            })

            const response = await list()
            expect(response.status).toBe(200)
            expect(response.body.pagination).toEqual({
              page: 1,
              limit: 50,
              total: 1,
              totalPages: 1,
            })
            expect(
              response.body.rentals.map((row: { id: string }) => row.id)
            ).toEqual([linked.id])
            const row = response.body.rentals[0]
            expect(Object.keys(row).sort()).toEqual(
              [
                ...Object.keys(linked),
                'users',
                'rental_items',
                'quote',
                'payments',
                'contract',
              ].sort()
            )
            expect(row.users).toEqual({
              id: clientId,
              name: `${prefix} client`,
              email: `${prefix}-client@example.test`,
              phone: '11999999999',
            })
            expect(row.quote).toEqual({
              id: linkedQuote.id,
              name: prefix,
              email: `${prefix}@example.test`,
              company: null,
              status: 'APPROVED',
            })
            expect(row.contract).toBeNull()
            expect(row.rental_items[0].equipments).toEqual({
              id: equipmentId,
              name: prefix,
              images: [],
            })
            expect(row.total).toBe('30')

            const withOrphans = await list('?includeOrphans=true')
            expect(
              withOrphans.body.rentals
                .map((item: { id: string }) => item.id)
                .sort()
            ).toEqual([linked.id, orphan.id].sort())
            expect(withOrphans.body.pagination.total).toBe(2)
          })
          it('filters by status, user and start window and paginates', async () => {
            const quotes = [
              await paidQuote(),
              await paidQuote(),
              await paidQuote(),
            ]
            const first = await rental({
              status: 'PENDING',
              quoteId: quotes[0]!.id,
              start: date(10),
              end: date(11),
            })
            const second = await rental({
              status: 'ACTIVE',
              quoteId: quotes[1]!.id,
              start: date(20),
              end: date(21),
            })
            const cancelled = await rental({
              status: 'CANCELLED',
              quoteId: quotes[2]!.id,
              start: date(30),
              end: date(31),
            })
            const ids = async (query: string) =>
              (await list(query)).body.rentals.map(
                (row: { id: string }) => row.id
              )
            expect(await ids('?status=CANCELLED')).toEqual([cancelled.id])
            expect(await ids('?status=UNKNOWN')).toEqual([])
            expect(await ids(`?userId=${otherClientId}`)).toEqual([])
            expect((await ids(`?userId=${clientId}`)).sort()).toEqual(
              [first.id, second.id].sort()
            )
            expect(
              await ids(
                `?startDate=${date(15).toISOString()}&endDate=${date(25).toISOString()}`
              )
            ).toEqual([second.id])
            const page = await list('?limit=1&page=2')
            expect(page.body.pagination).toEqual({
              page: 2,
              limit: 1,
              total: 2,
              totalPages: 2,
            })
            expect(page.body.rentals).toHaveLength(1)
          })
          it('records a manual rental total and item totals in cents', async () => {
            const created = await call(
              createRental(
                request('/api/admin/rentals', 'POST', {
                  userId: clientId,
                  startDate: date(60).toISOString(),
                  endDate: date(62).toISOString(),
                  items: [
                    {
                      equipmentId,
                      quantity: 1,
                      days: 3,
                      pricePerDay: '10.555',
                    },
                  ],
                })
              )
            )
            expect(created.status).toBe(201)
            // 3 · 10.555 = 31.665 → 31.67 (ROUND_HALF_UP): o total da locação é o valor cobrado.
            expect(created.body.rental).toMatchObject({
              total: '31.67',
              rental_items: [{ priceperday: '10.555', totalprice: '31.67' }],
            })
          })
          it('creates a manual rental (201), converts through quoteId and maps stock and validation failures', async () => {
            const created = await call(
              createRental(
                request('/api/admin/rentals', 'POST', {
                  userId: clientId,
                  startDate: date(40).toISOString(),
                  endDate: date(42).toISOString(),
                  items: [
                    { equipmentId, quantity: 2, days: 3, pricePerDay: '12.5' },
                  ],
                  notes: 'manual',
                })
              )
            )
            expect(created.status).toBe(201)
            expect(created.body.rental).toMatchObject({
              userid: clientId,
              total: '75',
              status: 'PENDING',
              notes: 'manual',
              quoteId: null,
              contract: null,
              users: {
                id: clientId,
                name: `${prefix} client`,
                email: `${prefix}-client@example.test`,
              },
              rental_items: [
                {
                  equipmentid: equipmentId,
                  quantity: 2,
                  priceperday: '12.5',
                  totaldays: 3,
                  totalprice: '75',
                  equipments: { id: equipmentId, name: prefix },
                },
              ],
            })

            const quote = await paidQuote()
            const converted = await call(
              createRental(
                request('/api/admin/rentals', 'POST', {
                  userId: clientId,
                  quoteId: quote.id,
                  startDate: date(1).toISOString(),
                  endDate: date(3).toISOString(),
                  items: [],
                })
              )
            )
            expect(converted.status).toBe(201)
            expect(converted.body.rental).toMatchObject({
              quoteId: quote.id,
              contract: null,
              status: 'PENDING',
            })

            const scarce = {
              userId: clientId,
              startDate: date(50).toISOString(),
              endDate: date(51).toISOString(),
              items: [
                {
                  equipmentId: scarceEquipmentId,
                  quantity: 2,
                  days: 2,
                  pricePerDay: 10,
                },
              ],
            }
            expect(
              await call(
                createRental(request('/api/admin/rentals', 'POST', scarce))
              )
            ).toEqual({
              status: 409,
              type: 'application/json',
              body: {
                error: `Equipamento ${prefix} scarce: estoque insuficiente no período solicitado`,
              },
            })
            expect(
              await call(
                createRental(
                  request('/api/admin/rentals', 'POST', {
                    ...scarce,
                    userId: otherClientId,
                  })
                )
              )
            ).toMatchObject({
              status: 404,
              body: { error: 'Cliente não pertence à locadora ativa' },
            })
            const invalid = await call(
              createRental(request('/api/admin/rentals', 'POST', { userId: 1 }))
            )
            expect(invalid.status).toBe(400)
            expect(invalid.body.error).toBe('Validation error')
            expect(
              await call(
                createRental(request('/api/admin/rentals', 'POST', '{bad'))
              )
            ).toMatchObject({
              status: 500,
              body: { error: 'Internal server error' },
            })
          })
        })

        describe('GET/PATCH/DELETE /api/admin/rentals/[id]', () => {
          const get = (id: string) =>
            call(readRental(request('/api/admin/rentals/' + id), params(id)))
          const patch = (id: string, body: unknown) =>
            call(
              patchRental(
                request('/api/admin/rentals/' + id, 'PATCH', body),
                params(id)
              )
            )
          const remove = (id: string) =>
            call(
              cancelRental(
                request('/api/admin/rentals/' + id, 'DELETE'),
                params(id)
              )
            )
          it('reads a rental of the locadora with its detail includes and hides others', async () => {
            const quote = await paidQuote()
            const row = await rental({ status: 'PENDING', quoteId: quote.id })
            const response = await get(row.id)
            expect(response.status).toBe(200)
            expect(Object.keys(response.body.rental).sort()).toEqual(
              [
                ...Object.keys(row),
                'users',
                'rental_items',
                'quote',
                'payments',
                'deliveries',
              ].sort()
            )
            expect(response.body.rental.users).toEqual({
              id: clientId,
              name: `${prefix} client`,
              email: `${prefix}-client@example.test`,
              phone: '11999999999',
              cpf: null,
              cnpj: null,
            })
            expect(
              response.body.rental.rental_items[0].equipments
            ).toMatchObject({
              id: equipmentId,
              category: { id: categoryId, name: prefix },
            })
            expect(response.body.rental.quote.items[0].equipment).toEqual({
              id: equipmentId,
              name: prefix,
            })
            expect(response.body.rental.payments).toEqual([])
            expect(response.body.rental.deliveries).toEqual([])
            const foreign = await rental({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            expect(await get(foreign.id)).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Rental not found' },
            })
            as('OPERATOR')
            expect(await get(row.id)).toMatchObject({
              status: 403,
              body: { error: 'Forbidden' },
            })
          })
          it('updates notes and dates, maps lifecycle failures with missingDocuments and validates the body', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(60),
              end: date(62),
            })
            const updated = await patch(row.id, {
              notes: 'nova nota',
              endDate: date(63).toISOString(),
            })
            expect(updated.status).toBe(200)
            expect(updated.body.rental).toMatchObject({
              id: row.id,
              notes: 'nova nota',
              enddate: date(63).toISOString(),
              users: { id: clientId },
            })
            expect(await patch(row.id, { status: 'PENDING' })).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação não pode voltar a pendente' },
            })
            const pending = await rental({
              status: 'PENDING',
              start: date(70),
              end: date(71),
            })
            expect(await patch(pending.id, { status: 'ACTIVE' })).toEqual({
              status: 400,
              type: 'application/json',
              body: {
                error:
                  'Fechamento bloqueado: faltam documentos obrigatórios (ID_DOCUMENT, SELFIE, SIGNED_CONTRACT, CPF_CNPJ_PROOF).',
                missingDocuments: [
                  'ID_DOCUMENT',
                  'SELFIE',
                  'SIGNED_CONTRACT',
                  'CPF_CNPJ_PROOF',
                ],
              },
            })
            const invalid = await patch(row.id, { status: 'FINISHED' })
            expect(invalid.status).toBe(400)
            expect(invalid.body.error).toBe('Validation error')
            const foreign = await rental({
              tenant: otherTenantId,
              userId: otherClientId,
            })
            expect(await patch(foreign.id, { notes: 'x' })).toMatchObject({
              status: 404,
              body: { error: 'Locação não encontrada' },
            })
          })
          it('cancels through the lifecycle and refuses to reopen a terminal rental', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(80),
              end: date(81),
            })
            expect(await remove(row.id)).toEqual({
              status: 200,
              type: 'application/json',
              body: { message: 'Rental cancelled successfully' },
            })
            expect(
              (
                await prisma.rentals.findUniqueOrThrow({
                  where: { id: row.id },
                })
              ).status
            ).toBe('CANCELLED')
            expect(await remove(row.id)).toEqual({
              status: 200,
              type: 'application/json',
              body: { message: 'Rental cancelled successfully' },
            })
            const done = await rental({
              status: 'COMPLETED',
              start: date(82),
              end: date(83),
            })
            expect(await remove(done.id)).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação encerrada não pode ser reaberta' },
            })
          })
        })

        describe('POST /api/admin/rentals/[id]/{checkin,checkout,extend,calculate-late-fee}', () => {
          it('checkout demands documents, then activates once', async () => {
            const quote = await paidQuote()
            const row = await rental({
              status: 'PENDING',
              quoteId: quote.id,
              start: date(90),
              end: date(91),
            })
            await prisma.payment.updateMany({
              where: { quoteId: quote.id },
              data: { rentalId: row.id, quoteId: null },
            })
            as('OPERATOR')
            expect(await post(checkoutRoute, row.id)).toMatchObject({
              status: 403,
              body: { error: 'Forbidden' },
            })
            as('ADMIN')
            const blocked = await post(checkoutRoute, row.id)
            expect(blocked).toEqual({
              status: 400,
              type: 'application/json',
              body: {
                error:
                  'Fechamento bloqueado: faltam documentos obrigatórios (ID_DOCUMENT, SELFIE, SIGNED_CONTRACT, CPF_CNPJ_PROOF).',
                missingDocuments: [
                  'ID_DOCUMENT',
                  'SELFIE',
                  'SIGNED_CONTRACT',
                  'CPF_CNPJ_PROOF',
                ],
              },
            })
            await documents(row.id)
            const done = await post(checkoutRoute, row.id)
            expect(done.status).toBe(200)
            expect(done.body.rental).toMatchObject({
              id: row.id,
              status: 'ACTIVE',
              users: { id: clientId },
            })
            expect(done.body.rental.checkOutAt).toEqual(expect.any(String))
            const unpaidQuote = await paidQuote({ paid: false })
            const unpaid = await rental({
              status: 'PENDING',
              quoteId: unpaidQuote.id,
              start: date(92),
              end: date(93),
            })
            expect(await post(checkoutRoute, unpaid.id)).toEqual({
              status: 400,
              type: 'application/json',
              body: { error: 'Pagamento ainda não confirmado para retirada' },
            })
          })
          it('checkin completes the rental, records a damage charge and validates input', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(100),
              end: date(102),
            })
            const invalid = await post(checkinRoute, row.id, { damageFee: -1 })
            expect(invalid.status).toBe(400)
            expect(invalid.body.error).toBe('Validation error')
            const response = await post(checkinRoute, row.id, {
              damageFee: 50,
              notes: 'riscos',
            })
            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
              rental: {
                id: row.id,
                status: 'COMPLETED',
                notes: 'riscos',
                lateFee: null,
              },
              lateFee: null,
              damageFee: 50,
            })
            expect(
              await prisma.payment.findMany({
                where: { rentalId: row.id },
                select: {
                  type: true,
                  method: true,
                  status: true,
                  amount: true,
                },
              })
            ).toEqual([
              {
                type: 'DAMAGE',
                method: 'BOLETO',
                status: 'PENDING',
                amount: expect.anything(),
              },
            ])
            expect(await post(checkinRoute, row.id, {})).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação não está em uso' },
            })
          })
          it('admin extension charges the item daily prices, queues a boleto (202) or not (200) and answers rule errors with the domain status', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(110),
              end: date(112),
            })
            const boleto = await post(adminExtend, row.id, {
              additionalDays: 2,
            })
            expect(boleto.status).toBe(202)
            expect(boleto.body).toMatchObject({
              rental: {
                id: row.id,
                extensionDays: 2,
                extensionFee: '20',
                enddate: date(114).toISOString(),
              },
              paymentId: expect.any(String),
              extensionFee: 20,
              boletoPending: true,
            })
            expect(
              await prisma.outboxEvent.count({
                where: {
                  tenantId,
                  topic: 'payment.boleto.issue',
                  aggregateId: boleto.body.paymentId,
                },
              })
            ).toBe(1)
            const quiet = await post(adminExtend, row.id, {
              additionalDays: 1,
              generateBoleto: false,
            })
            expect(quiet).toMatchObject({
              status: 200,
              body: { extensionFee: 10, boletoPending: false },
            })
            expect(quiet.body).not.toHaveProperty('paymentId')
            const pending = await rental({
              status: 'PENDING',
              start: date(120),
              end: date(121),
            })
            expect(
              await post(adminExtend, pending.id, { additionalDays: 1 })
            ).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação não pode ser prorrogada neste estado' },
            })
            expect(
              await post(adminExtend, randomUUID(), { additionalDays: 1 })
            ).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Locação não encontrada' },
            })
            const invalid = await post(adminExtend, row.id, {
              additionalDays: 0,
            })
            expect(invalid.status).toBe(400)
            as('CLIENT')
            expect(
              (await post(adminExtend, row.id, { additionalDays: 1 })).status
            ).toBe(403)
          })
          it('calculates the late fee only for overdue rentals in use and charges it once', async () => {
            const start = new Date(Date.now() - 10 * day)
            const end = new Date(Date.now() - 3 * day)
            const row = await rental({ status: 'ACTIVE', start, end })
            const first = await post(calculateLateFee, row.id)
            const daysOverdue = Math.ceil((Date.now() - end.getTime()) / day)
            const totalDays = Math.ceil((end.getTime() - start.getTime()) / day)
            expect(first.status).toBe(200)
            expect(first.body).toMatchObject({
              rental: { id: row.id, status: 'OVERDUE' },
              daysOverdue,
              message: 'Late fee calculated and applied successfully',
            })
            // A multa sai em centavos (ROUND_HALF_UP): é o mesmo valor gravado e cobrado.
            const expectedFee = new Decimal(30)
              .div(totalDays)
              .times(daysOverdue)
              .times('0.05')
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            expect(first.body.lateFee).toBe(expectedFee.toNumber())
            expect(first.body.rental.lateFee).toBe(expectedFee.toString())
            expect(first.body.rental).not.toHaveProperty('users')
            await post(calculateLateFee, row.id)
            expect(
              await prisma.payment.findMany({
                where: { rentalId: row.id },
                select: { type: true, method: true, status: true },
              })
            ).toEqual([{ type: 'LATE_FEE', method: 'PIX', status: 'OVERDUE' }])
            const [charged] = await prisma.payment.findMany({
              where: { rentalId: row.id },
              select: { amount: true },
            })
            expect(charged!.amount.toString()).toBe(expectedFee.toString())

            const current = await rental({
              status: 'ACTIVE',
              start: date(130),
              end: date(131),
            })
            expect(await post(calculateLateFee, current.id)).toEqual({
              status: 200,
              type: 'application/json',
              body: {
                lateFee: 0,
                daysOverdue: 0,
                message: 'Rental is not overdue',
              },
            })
            const pending = await rental({
              status: 'PENDING',
              start: date(132),
              end: date(133),
            })
            expect(await post(calculateLateFee, pending.id)).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação não está em uso' },
            })
            expect(await post(calculateLateFee, 'missing-rental')).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Rental not found' },
            })
          })
          it('fees over a converted quote with a fractional daily price are recorded and charged in cents', async () => {
            // Orçamento de 7 dias com semana direta de R$ 100: o item convertido guarda
            // priceperday = 100/7, que o provedor não cobra sem arredondar a centavos.
            const fractional = (start: Date, end: Date) =>
              prisma.rentals.create({
                data: {
                  tenantId,
                  id: `rental_${randomUUID()}`,
                  userid: clientId,
                  startdate: start,
                  enddate: end,
                  total: 100,
                  status: 'ACTIVE',
                  checkOutAt: start,
                  rental_items: {
                    create: {
                      tenantId,
                      id: `rental_item_${randomUUID()}`,
                      equipmentid: equipmentId,
                      quantity: 1,
                      priceperday: '14.285714285714286',
                      totaldays: 7,
                      totalprice: 100,
                      startDate: start,
                      endDate: end,
                    },
                  },
                },
              })
            const amounts = async (rentalId: string) =>
              (
                await prisma.payment.findMany({
                  where: { rentalId },
                  select: { amount: true },
                })
              ).map((row) => row.amount.toString())

            const admin = await fractional(date(400), date(406))
            const extended = await post(adminExtend, admin.id, {
              additionalDays: 1,
            })
            expect(extended.status).toBe(202)
            expect(extended.body).toMatchObject({
              rental: { id: admin.id, extensionFee: '14.29' },
              extensionFee: 14.29,
            })
            expect(await amounts(admin.id)).toEqual(['14.29'])

            const client = await fractional(date(420), date(426))
            as('CLIENT')
            const requested = await post(clientExtend, client.id, {
              extensionDays: 1,
            })
            expect(requested.status).toBe(200)
            // 100 / 6 dias · 1 dia · 10% = 1.6666… → 1.67
            expect(requested.body.extensionFee).toBe(1.67)
            expect(await amounts(client.id)).toEqual(['1.67'])

            as('ADMIN')
            const late = await fractional(
              new Date(Date.now() - 8.5 * day),
              new Date(Date.now() - 1.5 * day)
            )
            const returned = await post(checkinRoute, late.id, {
              damageFee: 10.005,
            })
            expect(returned.status).toBe(200)
            // 100 / 7 dias · 10% · 2 dias = 2.857… → 2.86; avaria 10.005 → 10.01
            expect(returned.body).toMatchObject({
              rental: { lateFee: '2.86' },
              lateFee: 2.86,
            })
            expect((await amounts(late.id)).sort()).toEqual(['10.01', '2.86'])
          })
        })

        describe('POST /api/client/rentals/[id]/extend', () => {
          it('extends only the caller rental in use, charging a PIX fee of 10% of the daily rate', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(140),
              end: date(143),
            })
            as('CLIENT')
            const response = await post(clientExtend, row.id, {
              extensionDays: 2,
            })
            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
              rental: {
                id: row.id,
                extensionDays: 2,
                enddate: date(145).toISOString(),
              },
              paymentId: expect.any(String),
              extensionFee: 2,
              message: 'Prorrogação solicitada com sucesso',
            })
            expect(
              await prisma.payment.findUniqueOrThrow({
                where: { id: response.body.paymentId },
                select: { method: true, type: true, status: true },
              })
            ).toEqual({ method: 'PIX', type: 'LATE_FEE', status: 'PENDING' })
            expect(
              await prisma.outboxEvent.count({ where: { tenantId } })
            ).toBe(0)
          })
          it('maps ownership, state and validation failures', async () => {
            const row = await rental({
              status: 'ACTIVE',
              start: date(150),
              end: date(151),
            })
            as('CLIENT', adminId)
            expect(
              await post(clientExtend, row.id, { extensionDays: 1 })
            ).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Locação não encontrada' },
            })
            as('CLIENT')
            const tooLong = await post(clientExtend, row.id, {
              extensionDays: 31,
            })
            expect(tooLong.status).toBe(400)
            expect(tooLong.body.error).toBe('Validation error')
            const pending = await rental({
              status: 'PENDING',
              start: date(152),
              end: date(153),
            })
            expect(
              await post(clientExtend, pending.id, { extensionDays: 1 })
            ).toEqual({
              status: 409,
              type: 'application/json',
              body: { error: 'Locação não pode ser prorrogada neste estado' },
            })
            deny()
            expect(
              (await post(clientExtend, row.id, { extensionDays: 1 })).status
            ).toBe(401)
          })
        })

        describe('GET /api/client/rentals and GET/DELETE /api/client/rentals/[id]', () => {
          const list = (query = '') =>
            call(clientRentals(request('/api/client/rentals' + query)))
          const read = (id: string) =>
            call(clientRental(request('/api/client/rentals/' + id), params(id)))
          const hide = (id: string) =>
            call(
              hideClientRental(
                request('/api/client/rentals/' + id, 'DELETE'),
                params(id)
              )
            )
          it('lists only the caller rentals of the locadora, newest first, with portal includes', async () => {
            const quote = await paidQuote()
            const older = await rental({
              status: 'ACTIVE',
              start: date(160),
              end: date(161),
              quoteId: quote.id,
            })
            const newer = await rental({
              status: 'PENDING',
              start: date(162),
              end: date(163),
            })
            const hidden = await rental({
              status: 'ACTIVE',
              start: date(164),
              end: date(165),
            })
            await prisma.rentals.update({
              where: { id: hidden.id },
              data: { clientDeletedAt: new Date() },
            })
            await prisma.rentals.update({
              where: { id: older.id },
              data: { createdat: new Date(Date.now() - 60_000) },
            })
            await rental({
              status: 'ACTIVE',
              start: date(166),
              end: date(167),
              userId: adminId,
            })
            await rental({ tenant: otherTenantId, userId: otherClientId })
            as('CLIENT')
            const response = await list()
            expect(response.status).toBe(200)
            expect(
              response.body.rentals.map((row: { id: string }) => row.id)
            ).toEqual([newer.id, older.id])
            const first = response.body.rentals[1]
            expect(Object.keys(first).sort()).toEqual(
              [
                ...Object.keys(older),
                'rental_items',
                'payments',
                'deliveries',
                'quote',
              ].sort()
            )
            expect(first.quote).toEqual({
              id: quote.id,
              name: prefix,
              email: `${prefix}@example.test`,
            })
            expect(first.rental_items[0].equipments).toMatchObject({
              id: equipmentId,
              category: { id: categoryId, name: prefix },
            })
            expect(response.body.rentals[0].quote).toBeNull()
            expect(
              (await list('?status=PENDING')).body.rentals.map(
                (row: { id: string }) => row.id
              )
            ).toEqual([newer.id])
            expect((await list('?status=UNKNOWN')).body).toEqual({
              rentals: [],
            })
            deny()
            expect((await list()).status).toBe(401)
          })
          it('reads the caller rental with contract and hides foreign, other-owner or removed rentals', async () => {
            const quote = await paidQuote()
            const own = await rental({
              status: 'ACTIVE',
              start: date(170),
              end: date(171),
              quoteId: quote.id,
            })
            const foreignOwner = await rental({
              status: 'ACTIVE',
              start: date(172),
              end: date(173),
              userId: adminId,
            })
            as('CLIENT')
            const response = await read(own.id)
            expect(response.status).toBe(200)
            expect(Object.keys(response.body.rental).sort()).toEqual(
              [
                ...Object.keys(own),
                'rental_items',
                'payments',
                'deliveries',
                'quote',
                'contract',
              ].sort()
            )
            expect(response.body.rental.contract).toBeNull()
            expect(response.body.rental.quote.items[0].equipment).toEqual({
              id: equipmentId,
              name: prefix,
            })
            for (const id of [foreignOwner.id, 'missing-rental'])
              expect(await read(id)).toEqual({
                status: 404,
                type: 'application/json',
                body: { error: 'Rental not found' },
              })
            await prisma.rentals.update({
              where: { id: own.id },
              data: { clientDeletedAt: new Date() },
            })
            expect((await read(own.id)).status).toBe(404)
          })
          it('soft-deletes only the caller rental and keeps it for the administration', async () => {
            const own = await rental({
              status: 'COMPLETED',
              start: date(180),
              end: date(181),
            })
            const foreignOwner = await rental({
              status: 'COMPLETED',
              start: date(182),
              end: date(183),
              userId: adminId,
            })
            as('CLIENT')
            expect(await hide(foreignOwner.id)).toEqual({
              status: 404,
              type: 'application/json',
              body: { error: 'Rental not found or unauthorized' },
            })
            expect(await hide(own.id)).toEqual({
              status: 200,
              type: 'application/json',
              body: { message: 'Locação removida do histórico com sucesso' },
            })
            const stored = await prisma.rentals.findUniqueOrThrow({
              where: { id: own.id },
            })
            expect(stored.clientDeletedAt).toEqual(expect.any(Date))
            expect(stored.status).toBe('COMPLETED')
            expect((await hide(own.id)).status).toBe(200)
            expect(
              (
                await prisma.rentals.findUniqueOrThrow({
                  where: { id: foreignOwner.id },
                })
              ).clientDeletedAt
            ).toBeNull()
          })
        })

        describe('GET /api/cron/auto-convert-quotes', () => {
          const approvedLongAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
          const run = () =>
            call(
              autoConvertCron(
                new NextRequest(origin + '/api/cron/auto-convert-quotes', {
                  headers: { authorization: 'Bearer cron-secret-for-tests' },
                })
              )
            )
          it('converts approved quotes older than one hour with a paid charge and reports the run', async () => {
            mocked.cronTenant.id = tenantId
            vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests')
            try {
              const ready = await paidQuote()
              const unpaid = await paidQuote({ paid: false })
              const fresh = await paidQuote()
              const partial = await paidQuote()
              await prisma.quote.updateMany({
                where: { id: { in: [ready.id, unpaid.id, partial.id] } },
                data: { approvedAt: approvedLongAgo },
              })
              await prisma.payment.updateMany({
                where: { quoteId: partial.id },
                data: { amount: 10 },
              })
              const foreign = await paidQuote({
                tenant: otherTenantId,
                userId: otherClientId,
              })
              await prisma.quote.update({
                where: { id: foreign.id },
                data: { approvedAt: approvedLongAgo },
              })

              const response = await run()
              expect(response.status).toBe(200)
              expect(response.body).toMatchObject({
                success: true,
                message: expect.stringMatching(/^Processed \d+ quotes$/),
                results: { converted: 1, errors: [] },
              })
              expect(
                await prisma.rentals.count({ where: { quoteId: ready.id } })
              ).toBe(1)
              for (const id of [unpaid.id, fresh.id, partial.id, foreign.id])
                expect(
                  await prisma.rentals.count({ where: { quoteId: id } })
                ).toBe(0)
              expect(
                await prisma.quote.findUniqueOrThrow({
                  where: { id: foreign.id },
                })
              ).toMatchObject({ status: 'APPROVED', convertedToRentalId: null })
            } finally {
              vi.unstubAllEnvs()
            }
          })
          it('reads only quotes and charges of the running locadora, even without row security', async () => {
            mocked.cronTenant.id = tenantId
            vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests')
            try {
              const own = await paidQuote()
              const foreign = await paidQuote({
                tenant: otherTenantId,
                userId: otherClientId,
              })
              await prisma.quote.updateMany({
                where: { id: { in: [own.id, foreign.id] } },
                data: { approvedAt: approvedLongAgo },
              })
              const response = await run()
              expect(response.body).toEqual({
                success: true,
                message: 'Processed 1 quotes',
                results: { converted: 1, errors: [] },
              })
              expect(
                await prisma.rentals.count({ where: { quoteId: foreign.id } })
              ).toBe(0)
            } finally {
              vi.unstubAllEnvs()
            }
          })
        })

        describe('GET /api/cron/expire-quotes', () => {
          const past = new Date(Date.now() - 86_400_000)
          const future = new Date(Date.now() + 86_400_000)
          const run = () =>
            call(
              expireQuotesCron(
                new NextRequest(origin + '/api/cron/expire-quotes', {
                  headers: { authorization: 'Bearer cron-secret-for-tests' },
                })
              )
            )
          it('annotates pending quotes past their validity and keeps the others', async () => {
            mocked.cronTenant.id = tenantId
            vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests')
            try {
              const expired = await paidQuote({ status: 'PENDING' })
              const noted = await paidQuote({ status: 'PENDING' })
              const valid = await paidQuote({ status: 'PENDING' })
              const approved = await paidQuote()
              await prisma.quote.updateMany({
                where: { id: { in: [expired.id, noted.id, approved.id] } },
                data: { validUntil: past },
              })
              await prisma.quote.update({
                where: { id: noted.id },
                data: { internalNotes: 'nota antiga' },
              })
              await prisma.quote.update({
                where: { id: valid.id },
                data: { validUntil: future },
              })

              const response = await run()
              expect(response.status).toBe(200)
              expect(response.body).toMatchObject({
                success: true,
                message: 'Quotes checked and expired',
                expiredCount: expect.any(Number),
              })
              expect(response.body.expiredIds).toEqual(
                expect.arrayContaining([expired.id, noted.id])
              )
              const rows = await prisma.quote.findMany({
                where: {
                  id: { in: [expired.id, noted.id, valid.id, approved.id] },
                },
                select: { id: true, status: true, internalNotes: true },
              })
              const byId = new Map(rows.map((row) => [row.id, row]))
              expect(byId.get(expired.id)).toMatchObject({
                status: 'PENDING',
                internalNotes: expect.stringMatching(
                  /^\[EXPIRADO\] Orçamento expirado em \d{4}-\d{2}-\d{2}T/
                ),
              })
              expect(byId.get(noted.id)!.internalNotes).toMatch(
                /^nota antiga\n\[EXPIRADO\] Orçamento expirado em /
              )
              expect(byId.get(valid.id)!.internalNotes).toBeNull()
              expect(byId.get(approved.id)!.internalNotes).toBeNull()
            } finally {
              vi.unstubAllEnvs()
            }
          })
          it('touches only the running locadora quotes, even without row security', async () => {
            mocked.cronTenant.id = tenantId
            vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests')
            try {
              const own = await paidQuote({ status: 'PENDING' })
              const foreign = await paidQuote({
                status: 'PENDING',
                tenant: otherTenantId,
                userId: otherClientId,
              })
              await prisma.quote.updateMany({
                where: { id: { in: [own.id, foreign.id] } },
                data: { validUntil: past },
              })
              expect((await run()).body).toMatchObject({
                expiredCount: 1,
                expiredIds: [own.id],
              })
              expect(
                (
                  await prisma.quote.findUniqueOrThrow({
                    where: { id: foreign.id },
                  })
                ).internalNotes
              ).toBeNull()
            } finally {
              vi.unstubAllEnvs()
            }
          })
        })
      }
    )
  }
)

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = { prisma, testPool: requireFixturePool() }
  await database.prisma.$disconnect()
  await database.testPool.end()
})

const prisma = getDatabaseRuntime().prisma
function requireFixturePool() {
  const pool = fixtureDatabase.pool
  if (!pool) throw new Error('Owned fixture pool was not initialized')
  return pool
}
