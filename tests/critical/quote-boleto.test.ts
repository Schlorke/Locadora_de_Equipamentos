import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 12,
  })
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    testPool: pool,
  }
})
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => null,
}))
import { prisma } from '@/lib/prisma'
import { ensureQuoteBoletoPayment as legacyEnsureQuoteBoletoPayment } from '@/lib/quote-boleto'
import { ensureQuoteBoletoPayment as serviceEnsureQuoteBoletoPayment } from '../../apps/services/api/src/host/payments'

// Contraparte da API compartilhada (onda 135, E5): a mesma regra pela composição do serviço
// (`apps/services/api/src/host/*`), sobre o mesmo banco descartável (`getDatabaseRuntime`). A fachada da raiz legada
// sai no bloco F; a do serviço fica.
const HOSTS = [
  {
    name: 'legacy root',
    ensureQuoteBoletoPayment: legacyEnsureQuoteBoletoPayment,
  },
  {
    name: 'service',
    ensureQuoteBoletoPayment: serviceEnsureQuoteBoletoPayment,
  },
] as const

describe.skipIf(!process.env.TEST_DATABASE_URL).each(HOSTS)(
  '$name: Durable quote boleto obligations',
  ({ ensureQuoteBoletoPayment }) => {
    const tenantId = 'test_boleto_' + randomUUID()
    const otherTenantId = 'test_other_' + randomUUID()
    const context = { tenantId }
    beforeAll(async () => {
      // Slug segue a política de rótulo DNS da plataforma (sem '_').
      await prisma.organization.createMany({
        data: [
          {
            id: tenantId,
            slug: tenantId.replaceAll('_', '-'),
            name: 'Billing fixture',
          },
          {
            id: otherTenantId,
            slug: otherTenantId.replaceAll('_', '-'),
            name: 'Other fixture',
          },
        ],
      })
    })
    afterAll(async () => {
      await prisma.outboxEvent.deleteMany({ where: { tenantId } })
      await prisma.payment.deleteMany({ where: { tenantId } })
      await prisma.quote.deleteMany({ where: { tenantId } })
      await prisma.organization.deleteMany({
        where: { id: { in: [tenantId, otherTenantId] } },
      })
    })
    const quote = () =>
      prisma.quote.create({
        data: {
          tenantId,
          name: 'Fixture',
          email: 'fixture@example.test',
          phone: '00000000000',
          cpf: '12345678909',
          total: 100,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      })
    it('ten simultaneous requests produce one obligation and one durable issuance, without a provider call', async () => {
      const q = await quote()
      const replies = await Promise.all(
        Array.from({ length: 10 }, () =>
          ensureQuoteBoletoPayment(context, q.id)
        )
      )
      expect(new Set(replies.map((reply) => reply.paymentId)).size).toBe(1)
      expect(replies.every((reply) => reply.processing === 'PENDING')).toBe(
        true
      )
      expect(
        await prisma.payment.count({ where: { tenantId, quoteId: q.id } })
      ).toBe(1)
      expect(
        await prisma.outboxEvent.count({
          where: { tenantId, aggregateId: replies[0]!.paymentId },
        })
      ).toBe(1)
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: replies[0]!.paymentId },
          })
        ).transactionId
      ).toBeNull()
    })
    it('does not overwrite a previous charge when the quote amount differs', async () => {
      const q = await quote()
      const payment = await prisma.payment.create({
        data: {
          tenantId,
          quoteId: q.id,
          amount: 50,
          method: 'BOLETO',
          type: 'RENTAL',
          dueDate: new Date(),
          transactionId: 'old-' + q.id,
          metadata: { barcode: 'old', boletoSentAt: '2030-01-01' },
        },
      })
      await expect(
        ensureQuoteBoletoPayment(context, q.id)
      ).rejects.toMatchObject({ status: 409 })
      expect(
        await prisma.payment.findUnique({ where: { id: payment.id } })
      ).toMatchObject({
        transactionId: payment.transactionId,
        amount: payment.amount,
        metadata: payment.metadata,
      })
      expect(
        await prisma.outboxEvent.count({
          where: { tenantId, aggregateId: payment.id },
        })
      ).toBe(0)
    })
    it('retains paid amounts and delivery metadata after later quote changes', async () => {
      const q = await quote()
      const payment = await prisma.payment.create({
        data: {
          tenantId,
          quoteId: q.id,
          amount: 80,
          method: 'BOLETO',
          type: 'RENTAL',
          dueDate: new Date(),
          status: 'PAID',
          paidAt: new Date(),
          metadata: { barcode: 'settled' },
        },
      })
      const result = await ensureQuoteBoletoPayment(context, q.id)
      expect(result).toMatchObject({
        paymentId: payment.id,
        amount: 80,
        status: 'PAID',
        created: false,
      })
      expect(
        await prisma.outboxEvent.count({
          where: { tenantId, aggregateId: payment.id },
        })
      ).toBe(0)
    })
    it('rejects another locadora before creating any obligation', async () => {
      const q = await quote()
      await expect(
        ensureQuoteBoletoPayment({ tenantId: otherTenantId }, q.id)
      ).rejects.toMatchObject({ status: 404 })
      expect(await prisma.payment.count({ where: { quoteId: q.id } })).toBe(0)
    })
    it('leaves no payment or event for an unapproved quote or missing tenant payer document', async () => {
      const q = await quote()
      await prisma.quote.update({
        where: { id: q.id },
        data: { status: 'PENDING', approvedAt: null },
      })
      await expect(
        ensureQuoteBoletoPayment(context, q.id)
      ).rejects.toMatchObject({ status: 409 })
      await prisma.quote.update({
        where: { id: q.id },
        data: { status: 'APPROVED', approvedAt: new Date(), cpf: null },
      })
      await expect(
        ensureQuoteBoletoPayment(context, q.id)
      ).rejects.toMatchObject({ status: 409 })
      expect(await prisma.payment.count({ where: { quoteId: q.id } })).toBe(0)
    })
  }
)

afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  await prisma.$disconnect()
  const mocked = (await import('@/lib/prisma')) as unknown as {
    testPool: { end(): Promise<void> }
  }
  await mocked.testPool.end()
})
