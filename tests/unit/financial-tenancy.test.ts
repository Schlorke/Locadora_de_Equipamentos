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
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const connectionString = requireTestDatabase(process.env)
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database required')
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
  getServerSession: async () => ({ user: { id: currentUserId } }),
}))
const render = vi.hoisted(() => ({
  pdf: vi.fn(async (_data: unknown) => Buffer.from('fixture-pdf')),
}))
vi.mock('@/lib/pdf/oficio-generator', () => ({ generateOficioPdf: render.pdf }))
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishTestOrganizations } from '../helpers/public-site'
let currentUserId: string
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => ({ user: { id: currentUserId } }),
  }))()),
}))
vi.mock('@gb-locacoes/backend/documents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/documents')>()),
  ...(await (() => ({ generateOficioPdf: render.pdf }))()),
}))
import * as legacyRoute0 from '@/app/api/admin/financial/entries/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/financial/entries/route'
import * as legacyRoute1 from '@/app/api/admin/financial/calendar/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/financial/calendar/route'
import * as legacyRoute2 from '@/app/api/admin/financial/aging/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/financial/aging/route'
import * as legacyRoute3 from '@/app/api/admin/financial/revenue/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/financial/revenue/route'
import * as legacyRoute4 from '@/app/api/admin/financial/export/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/financial/export/route'
import * as legacyRoute5 from '@/app/api/admin/financial/entries/[id]/status/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/status/route'
import * as legacyRoute6 from '@/app/api/admin/financial/entries/[id]/due-date/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/due-date/route'
import * as legacyRoute7 from '@/app/api/admin/financial/entries/[id]/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/route'
import * as legacyRoute8 from '@/app/api/admin/financial/entries/[id]/pdf-oficio/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/pdf-oficio/route'
import * as legacyRoute9 from '@/app/api/admin/financial/settings/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/admin/financial/settings/route'
import * as legacyRoute10 from '@/app/api/settings/public/route'
import * as serviceRoute10 from '../../apps/services/api/src/app/api/settings/public/route'
import * as legacyRoute11 from '@/app/api/admin/dashboard/route'
import * as serviceRoute11 from '../../apps/services/api/src/app/api/admin/dashboard/route'
import * as legacyRoute12 from '@/app/api/admin/kpis/route'
import * as serviceRoute12 from '../../apps/services/api/src/app/api/admin/kpis/route'
import * as legacyRoute13 from '@/app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route'
import * as serviceRoute13 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route'

const HOSTS = [
  [
    'legacy root',
    {
      entries: legacyRoute0.GET,
      calendar: legacyRoute1.GET,
      aging: legacyRoute2.GET,
      revenue: legacyRoute3.GET,
      exportFinancial: legacyRoute4.GET,
      setStatus: legacyRoute5.PATCH,
      setDueDate: legacyRoute6.PATCH,
      deleteEntry: legacyRoute7.DELETE,
      pdf: legacyRoute8.GET,
      settings: legacyRoute9.GET,
      setSettings: legacyRoute9.PATCH,
      publicSettings: legacyRoute10.GET,
      dashboard: legacyRoute11.GET,
      kpis: legacyRoute12.GET,
      deleteAdjustment: legacyRoute13.DELETE,
    },
  ],
  [
    'service',
    {
      entries: serviceRoute0.GET,
      calendar: serviceRoute1.GET,
      aging: serviceRoute2.GET,
      revenue: serviceRoute3.GET,
      exportFinancial: serviceRoute4.GET,
      setStatus: serviceRoute5.PATCH,
      setDueDate: serviceRoute6.PATCH,
      deleteEntry: serviceRoute7.DELETE,
      pdf: serviceRoute8.GET,
      settings: serviceRoute9.GET,
      setSettings: serviceRoute9.PATCH,
      publicSettings: serviceRoute10.GET,
      dashboard: serviceRoute11.GET,
      kpis: serviceRoute12.GET,
      deleteAdjustment: serviceRoute13.DELETE,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      entries,
      calendar,
      aging,
      revenue,
      exportFinancial,
      setStatus,
      setDueDate,
      deleteEntry,
      pdf,
      settings,
      setSettings,
      publicSettings,
      dashboard,
      kpis,
      deleteAdjustment,
    }
  ) => {
    const prefix = 'financial-' + randomUUID()
    let adminId: string
    let clientId: string
    let tenantA: string
    let tenantB: string
    let paymentA: string
    let paymentB: string
    let quoteA: string
    const req = (
      path: string,
      tenantId: string | null = tenantA,
      body?: unknown,
      method = body ? 'PATCH' : 'GET'
    ) =>
      new NextRequest('http://localhost' + path, {
        method,
        headers: {
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    const future = () => new Date(Date.now() + 86400000 * 5)
    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'financial HTTP contracts with independent locadoras',
      () => {
        beforeAll(async () => {
          tenantA = (
            await prisma.organization.create({
              data: { slug: prefix + '-a', name: 'Locadora A' },
            })
          ).id
          tenantB = (
            await prisma.organization.create({
              data: { slug: prefix + '-b', name: 'Locadora B' },
            })
          ).id
          // Locadoras vivas (S13): a vitrine pública só responde publicada.
          await publishTestOrganizations(prisma, [tenantA, tenantB])
          adminId = (
            await prisma.user.create({
              data: { email: prefix + '@example.test', role: 'CLIENT' },
            })
          ).id
          clientId = (
            await prisma.user.create({
              data: {
                email: prefix + '-client@example.test',
                role: 'ADMIN',
                name: 'GLOBAL DATA MUST NOT APPEAR',
              },
            })
          ).id
          for (const [tenantId, name] of [
            [tenantA, 'Cliente Alfa'],
            [tenantB, 'Cliente Bravo'],
          ]) {
            await prisma.membership.createMany({
              data: [
                { tenantId, userId: adminId, role: 'ADMIN' },
                { tenantId, userId: clientId, role: 'CLIENT' },
              ],
            })
            await prisma.clientProfile.create({
              data: {
                tenantId: tenantId!,
                userId: clientId,
                name: name!,
                email: tenantId + '@example.test',
              },
            })
          }
        })
        beforeEach(async () => {
          currentUserId = adminId
          const where = { tenantId: { in: [tenantA, tenantB] } }
          await prisma.outboxEvent.deleteMany({ where })
          await prisma.paymentAttempt.deleteMany({ where })
          await prisma.payment.deleteMany({ where })
          await prisma.quoteAdjustment.deleteMany({ where })
          await prisma.rentals.deleteMany({ where })
          await prisma.quote.deleteMany({ where })
          await prisma.setting.deleteMany({ where })
          await prisma.financialSetting.deleteMany({ where })
          await prisma.organization.update({
            where: { id: tenantA },
            data: { document: null, city: null, state: null },
          })
          for (const [tenantId, amount] of [
            [tenantA, 100],
            [tenantB, 900],
          ] as const) {
            const quote = await prisma.quote.create({
              data: {
                tenantId,
                userId: clientId,
                name: 'Snapshot ' + tenantId,
                email: 'snapshot@example.test',
                phone: '00000000000',
                quoteCode: 'ORC-001',
                total: amount,
              },
            })
            const payment = await prisma.payment.create({
              data: {
                tenantId,
                quoteId: quote.id,
                amount,
                grossAmount: amount,
                method: 'BOLETO',
                type: 'DEPOSIT',
                dueDate: new Date(Date.now() - 86400000 * 10),
              },
            })
            if (tenantId === tenantA) {
              paymentA = payment.id
              quoteA = quote.id
            } else {
              paymentB = payment.id
            }
          }
        })
        afterAll(async () => {
          const where = { tenantId: { in: [tenantA, tenantB] } }
          await prisma.outboxEvent.deleteMany({ where })
          await prisma.paymentAttempt.deleteMany({ where })
          await prisma.payment.deleteMany({ where })
          await prisma.quoteAdjustment.deleteMany({ where })
          await prisma.rentals.deleteMany({ where })
          await prisma.quote.deleteMany({ where })
          await prisma.tenantIntegration.deleteMany({ where })
          await prisma.setting.deleteMany({ where })
          await prisma.financialSetting.deleteMany({ where })
          await prisma.clientProfile.deleteMany({ where })
          await prisma.membership.deleteMany({ where })
          await prisma.user.deleteMany({
            where: { id: { in: [adminId, clientId] } },
          })
          await prisma.organization.deleteMany({
            where: { id: { in: [tenantA, tenantB] } },
          })
        })
        it('lists only this locadora and uses its customer profile in list, calendar, aging and CSV', async () => {
          const list = await entries(req('/api/admin/financial/entries'))
          expect(list.status).toBe(200)
          const data = await list.json()
          expect(data.entries).toHaveLength(1)
          expect(data.entries[0]).toMatchObject({
            id: paymentA,
            customerName: 'Cliente Alfa',
          })
          for (const [handler, path] of [
            [calendar, '/calendar'],
            [aging, '/aging'],
          ] as const) {
            const response = await handler(req('/api/admin/financial' + path))
            expect(response.status).toBe(200)
            const value = await response.text()
            expect(value).toContain('Cliente Alfa')
            expect(value).not.toContain('Cliente Bravo')
            expect(value).not.toContain('GLOBAL DATA')
          }
          const csv = await exportFinancial(
            req('/api/admin/financial/export?format=csv')
          )
          expect(csv.status).toBe(200)
          const text = await csv.text()
          expect(text).toContain('Cliente Alfa')
          expect(text).not.toContain('Cliente Bravo')
          expect(text).not.toContain('GLOBAL DATA')
          const searched = await entries(
            req('/api/admin/financial/entries?search=Cliente%20Bravo')
          )
          expect((await searched.json()).entries).toHaveLength(0)
        })
        it('requires explicit selection and active administrative membership, regardless of global User.role', async () => {
          expect(
            (await entries(req('/api/admin/financial/entries', null))).status
          ).toBe(409)
          currentUserId = clientId
          expect(
            (await entries(req('/api/admin/financial/entries'))).status
          ).toBe(403)
          expect(
            (
              await setStatus(
                req('/status', tenantA, { billingStatus: 'PAID' }),
                params(paymentA)
              )
            ).status
          ).toBe(403)
        })
        it('rejects foreign IDs and preserves payment and adjustment history', async () => {
          expect(
            (
              await setStatus(
                req('/status', tenantA, { billingStatus: 'PAID' }),
                params(paymentB)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await deleteEntry(
                req('/entry', tenantA, undefined, 'DELETE'),
                params(paymentB)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await deleteEntry(
                req('/entry', tenantA, undefined, 'DELETE'),
                params(paymentA)
              )
            ).status
          ).toBe(409)
          expect(await prisma.payment.count({ where: { id: paymentA } })).toBe(
            1
          )
          const adjustment = await prisma.quoteAdjustment.create({
            data: {
              tenantId: tenantA,
              quoteId: quoteA,
              category: 'OTHER',
              amount: 1,
              justification: 'Fixture',
              createdBy: adminId,
            },
          })
          expect(
            (
              await deleteAdjustment(
                req('/adjustment', tenantA, undefined, 'DELETE'),
                {
                  params: Promise.resolve({
                    id: quoteA,
                    adjustmentId: adjustment.id,
                  }),
                }
              )
            ).status
          ).toBe(409)
          expect(
            (
              await deleteAdjustment(
                req('/adjustment', tenantB, undefined, 'DELETE'),
                {
                  params: Promise.resolve({
                    id: quoteA,
                    adjustmentId: adjustment.id,
                  }),
                }
              )
            ).status
          ).toBe(404)
          expect(
            await prisma.quoteAdjustment.count({ where: { id: adjustment.id } })
          ).toBe(1)
        })
        it('confirms once atomically, records a durable conversion and rejects downgrade', async () => {
          const responses = await Promise.all(
            Array.from({ length: 4 }, () =>
              setStatus(
                req('/status', tenantA, { billingStatus: 'PAID' }),
                params(paymentA)
              )
            )
          )
          expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200])
          const paid = await prisma.payment.findUniqueOrThrow({
            where: { id: paymentA },
          })
          expect(paid.status).toBe('PAID')
          expect(paid.paidAt).not.toBeNull()
          expect(
            await prisma.outboxEvent.count({
              where: {
                tenantId: tenantA,
                topic: 'quote.payment.convert',
                aggregateId: quoteA,
              },
            })
          ).toBe(1)
          expect(
            (
              await setStatus(
                req('/status', tenantA, { billingStatus: 'UNPAID' }),
                params(paymentA)
              )
            ).status
          ).toBe(409)
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: paymentB },
              })
            ).status
          ).toBe('PENDING')
          expect(
            await prisma.rentals.count({ where: { tenantId: tenantA } })
          ).toBe(0)
        })
        it('queues an explicit due-date change once and preserves the currently issued date', async () => {
          const integration = await prisma.tenantIntegration.create({
            data: {
              tenantId: tenantA,
              provider: 'ASAAS',
              credentialsRef:
                'env:LOCADORA_INTEGRATION_TEST_UNREAD_' +
                randomUUID().replaceAll('-', '').toUpperCase(),
            },
          })
          const payment = await prisma.payment.update({
            where: { id: paymentA },
            data: { transactionId: 'external-' + paymentA },
          })
          const attempt = await prisma.paymentAttempt.create({
            data: {
              tenantId: tenantA,
              paymentId: paymentA,
              provider: 'ASAAS',
              integrationId: integration.id,
              status: 'ISSUED',
              externalId: payment.transactionId,
              idempotencyKey: paymentA,
              amount: payment.amount,
              dueDate: payment.dueDate,
            },
          })
          const body = { dueDate: future().toISOString().slice(0, 10) }
          const [a, b] = await Promise.all([
            setDueDate(req('/due-date', tenantA, body), params(paymentA)),
            setDueDate(req('/due-date', tenantA, body), params(paymentA)),
          ])
          expect(a.status).toBe(202)
          expect(b.status).toBe(202)
          expect((await a.json()).operationId).toBe(
            (await b.json()).operationId
          )
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: paymentA },
              })
            ).dueDate
          ).toEqual(payment.dueDate)
          expect(
            (
              await prisma.paymentAttempt.findUniqueOrThrow({
                where: { id: attempt.id },
              })
            ).cancellationStatus
          ).toBe('REQUESTED')
          expect(
            (
              await setDueDate(
                req('/due-date', tenantB, body),
                params(paymentA)
              )
            ).status
          ).toBe(404)
        })
        it('keeps public and financial configuration specific to the chosen company', async () => {
          expect(
            (await publicSettings(req('/api/settings/public'))).status
          ).toBe(409)
          expect(
            (
              await publicSettings(
                req('/api/settings/public?tenantSlug=' + prefix + '-a')
              )
            ).status
          ).toBe(409)
          await prisma.setting.create({
            data: {
              tenantId: tenantA,
              contactEmail: 'alfa@example.test',
              publicBaseUrl: 'https://alfa.example.test',
            },
          })
          await prisma.setting.create({
            data: {
              tenantId: tenantB,
              contactEmail: 'bravo@example.test',
              publicBaseUrl: 'https://bravo.example.test',
            },
          })
          const response = await publicSettings(
            req('/api/settings/public?tenantSlug=' + prefix + '-a')
          )
          expect(response.status).toBe(200)
          expect((await response.json()).contactEmail).toBe('alfa@example.test')
          expect(
            (
              await setSettings(
                req('/settings', tenantA, {
                  cpfRate: 1,
                  cnpjRate: 2,
                  cniRate: 3,
                })
              )
            ).status
          ).toBe(200)
          expect(
            (
              await setSettings(
                req('/settings', tenantB, {
                  cpfRate: 7,
                  cnpjRate: 8,
                  cniRate: 9,
                })
              )
            ).status
          ).toBe(200)
          expect(
            (await (await settings(req('/settings', tenantA))).json()).settings
              .cpfRate
          ).toBe(1)
        })
        it('scopes financial aggregates, dashboard and equipment KPIs to the chosen company', async () => {
          await prisma.payment.updateMany({
            where: { id: { in: [paymentA, paymentB] } },
            data: { status: 'PAID', billingStatus: 'PAID', paidAt: new Date() },
          })
          const response = await revenue(req('/api/admin/financial/revenue'))
          expect(response.status).toBe(200)
          const value = await response.json()
          expect(
            value.revenueHistory.reduce(
              (sum: number, row: { revenue: number }) => sum + row.revenue,
              0
            )
          ).toBe(100)
          const dash = await dashboard(req('/api/admin/dashboard'))
          expect(dash.status).toBe(200)
          const metrics = await dash.json()
          expect(metrics.totalQuotes).toBe(1)
          expect(metrics.monthlyRevenue).toBe(100)
          expect(metrics.financialMetrics.metrics.mrr).toBe(100)
          const kpi = await kpis(req('/api/admin/kpis'))
          expect(kpi.status).toBe(200)
          expect((await kpi.json()).kpis.equipmentROI).toEqual([])
        })
        it('requires this company legal identity for ofício and never substitutes the former company', async () => {
          expect((await pdf(req('/pdf'), params(paymentB))).status).toBe(404)
          const missing = await pdf(req('/pdf'), params(paymentA))
          expect(missing.status).toBe(409)
          expect((await missing.json()).code).toBe('COMPANY_PROFILE_REQUIRED')
          await prisma.organization.update({
            where: { id: tenantA },
            data: { document: '00000000000000', city: 'Cidade A', state: 'RS' },
          })
          await prisma.setting.create({
            data: {
              tenantId: tenantA,
              publicBaseUrl: 'https://alfa.example.test',
            },
          })
          const result = await pdf(req('/pdf'), params(paymentA))
          expect(result.status).toBe(200)
          const rental = await prisma.rentals.create({
            data: {
              id: randomUUID(),
              tenantId: tenantA,
              userid: clientId,
              quoteId: quoteA,
              total: 100,
              startdate: new Date(),
              enddate: future(),
            },
          })
          await prisma.payment.update({
            where: { id: paymentA },
            data: { quoteId: null, rentalId: rental.id },
          })
          expect((await pdf(req('/pdf'), params(paymentA))).status).toBe(200)
          expect(render.pdf.mock.calls.at(-1)?.[0]).toMatchObject({
            empresa: {
              razaoSocial: 'Locadora A',
              cidade: 'Cidade A',
              website: 'https://alfa.example.test',
            },
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
