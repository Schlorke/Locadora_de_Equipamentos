import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createPaymentProcessor } from '@gb-locacoes/backend/billing'
import {
  requestPayment,
  ensureQuoteBoletoPayment,
} from '../../apps/services/api/src/host/payments'
import {
  convertQuoteToRental,
  convertPaidQuotePayment,
  createQuoteRequest,
} from '../../apps/services/api/src/host/quotations'
import { checkoutRental } from '../../apps/services/api/src/host/rentals'
import { createRentalAvailability } from '@gb-locacoes/backend/rentals'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
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
  const fixturePrisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  fixtureDatabase.prisma = fixturePrisma
  return {
    ...actual,
    getDatabaseRuntime: () => ({ prisma: fixturePrisma }),
    createIntegrationCredentialResolver: () => async () => ({
      apiKey: 'fixture-api-key',
      environment: 'sandbox',
    }),
  }
})
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

// Credencial fictícia da integração Asaas da locadora (requestPayment só enfileira a emissão).
import { createQuoteBoletos } from '@gb-locacoes/backend/quotations'
import { createAsaasGateway } from '../../packages/backend/src/modules/billing/asaas'
import {
  createFakeAsaas,
  SAMPLE_DOCUMENTS,
  type FakeAsaas,
} from '../helpers/fake-asaas'

type ChargeStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'

const date = (day: number) => new Date(Date.UTC(2031, 0, day))
const prefix = `settlement-test-${randomUUID()}`
let context: TenantContext
let userId: string
let categoryId: string
let equipmentId: string
/** Semana com valor direto de R$ 100: 9 dias custam 100 + 2 · 100/7 = 128.5714… */
let weeklyEquipmentId: string
/** Diária de R$ 14.29, somada ao item semanal no mesmo orçamento. */
let dailyEquipmentId: string
let integrationId: string
const quoteIds: string[] = []
/** Total legado gravado sem arredondar (DECIMAL(65,30)) por um orçamento de 9 dias. */
const FRACTIONAL_TOTAL = '128.571428571428580000000000000'

/** Orçamento UPFRONT aprovado; cobranças PIX/DEPOSIT criadas em ordem, a última é a mais recente. */
async function quoteWithCharges(
  statuses: readonly ChargeStatus[],
  amounts: readonly number[] = statuses.map(() => 30)
) {
  const quote = await prisma.quote.create({
    data: {
      tenantId: context.tenantId,
      name: prefix,
      email: `${prefix}@example.test`,
      phone: '00000000000',
      cpf: '12345678909',
      userId,
      status: 'APPROVED',
      approvedAt: new Date(),
      paymentTerms: 'UPFRONT',
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
    },
  })
  quoteIds.push(quote.id)
  const payments = []
  for (const [index, status] of statuses.entries()) {
    payments.push(
      await prisma.payment.create({
        data: {
          tenantId: context.tenantId,
          quoteId: quote.id,
          amount: amounts[index]!,
          method: 'PIX',
          type: 'DEPOSIT',
          status,
          dueDate: date(1),
          createdAt: new Date(Date.now() - (statuses.length - index) * 1000),
          ...(status === 'PAID' || status === 'REFUNDED'
            ? { paidAt: new Date() }
            : {}),
        },
      })
    )
  }
  return { quote, payments }
}

/** Administrador da locadora (cobra em nome do cliente). */
const principal = () => ({
  tenantId: context.tenantId,
  userId,
  membershipId: 'member-admin',
  role: 'ADMIN' as const,
})

/**
 * Boleto marcado CANCELLED pela rota legada de reemissão, que não cancelava no
 * gateway: a linha guarda o `transactionId` e não tem tentativa (sem backfill).
 */
function legacyCancelledBoleto(quoteId: string, transactionId: string) {
  return prisma.payment.create({
    data: {
      tenantId: context.tenantId,
      quoteId,
      amount: 30,
      method: 'BOLETO',
      type: 'RENTAL',
      status: 'CANCELLED',
      billingStatus: 'SETTLED',
      settledAt: new Date(),
      dueDate: date(1),
      transactionId,
      metadata: { barcode: 'legacy' },
      createdAt: new Date(Date.now() - 60_000),
    },
  })
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

async function clean() {
  const rentals = await prisma.rentals.findMany({
    where: { tenantId: context.tenantId },
    select: { id: true },
  })
  const rentalIds = rentals.map((row) => row.id)
  await prisma.clientDocument.deleteMany({
    where: { tenantId: context.tenantId },
  })
  await prisma.outboxEvent.deleteMany({ where: { tenantId: context.tenantId } })
  await prisma.externalResourceTenant.deleteMany({
    where: { tenantId: context.tenantId },
  })
  await prisma.paymentAttempt.deleteMany({
    where: { tenantId: context.tenantId },
  })
  await prisma.payment.deleteMany({
    where: {
      tenantId: context.tenantId,
      OR: [{ rentalId: { in: rentalIds } }, { quoteId: { in: quoteIds } }],
    },
  })
  await prisma.rental_items.deleteMany({
    where: { rentalid: { in: rentalIds } },
  })
  await prisma.rentals.deleteMany({ where: { id: { in: rentalIds } } })
  await prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } })
  await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
  quoteIds.length = 0
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'PostgreSQL settlement over current charges (disposable local database)',
  () => {
    beforeAll(async () => {
      context = {
        tenantId: (
          await prisma.organization.create({
            data: { name: prefix, slug: prefix, status: 'ACTIVE' },
          })
        ).id,
      }
      userId = (
        await prisma.user.create({
          data: { email: `${prefix}@example.test`, name: prefix },
        })
      ).id
      await prisma.membership.create({
        data: {
          tenantId: context.tenantId,
          userId,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      })
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
      weeklyEquipmentId = (
        await prisma.equipment.create({
          data: {
            tenantId: context.tenantId,
            name: prefix + '-weekly',
            categoryId,
            maxStock: 1,
            pricePerDay: 20,
            weeklyUseDirectValue: true,
            weeklyDirectValue: 100,
            images: [],
          },
        })
      ).id
      dailyEquipmentId = (
        await prisma.equipment.create({
          data: {
            tenantId: context.tenantId,
            name: prefix + '-daily',
            categoryId,
            maxStock: 1,
            pricePerDay: '14.29',
            images: [],
          },
        })
      ).id
      integrationId = (
        await prisma.tenantIntegration.create({
          data: {
            tenantId: context.tenantId,
            provider: 'ASAAS',
            credentialsRef: 'env:LOCADORA_INTEGRATION_SETTLEMENT_FIXTURE',
            status: 'ACTIVE',
          },
        })
      ).id
    })
    beforeEach(async () => {
      await clean()
    })
    afterAll(async () => {
      if (context) {
        await clean()
        await prisma.equipment.deleteMany({
          where: { tenantId: context.tenantId },
        })
        await prisma.tenantIntegration.deleteMany({
          where: { tenantId: context.tenantId },
        })
        await prisma.category.deleteMany({
          where: { tenantId: context.tenantId },
        })
        await prisma.membership.deleteMany({
          where: { tenantId: context.tenantId },
        })
        await prisma.user.deleteMany({ where: { id: userId } })
        await prisma.organization.deleteMany({
          where: { id: context.tenantId },
        })
      }
      await prisma.$disconnect()
      const db = { testPool: requireFixturePool() }
      await db.testPool.end()
    })

    it.each([[['REFUNDED', 'PAID']], [['CANCELLED', 'PAID']]] as Array<
      [ChargeStatus[]]
    >)(
      'a paid charge after voided history %j converts, reserves stock and allows checkout',
      async (statuses) => {
        const { quote, payments } = await quoteWithCharges(statuses)
        const voided = payments[0]!
        const paid = payments[1]!

        const result = await convertPaidQuotePayment(context, paid.id)
        expect(result).toMatchObject({ converted: true })
        const rental = await prisma.rentals.findUniqueOrThrow({
          where: { id: result.rentalId! },
        })
        expect(rental).toMatchObject({ quoteId: quote.id, status: 'PENDING' })
        expect(
          await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })
        ).toMatchObject({ status: 'COMPLETED', convertedToRentalId: rental.id })

        // O histórico anulado segue a obrigação sem ser alterado nem reativado.
        const history = await prisma.payment.findUniqueOrThrow({
          where: { id: voided.id },
        })
        expect(history).toMatchObject({
          status: voided.status,
          rentalId: rental.id,
          quoteId: null,
          transactionId: voided.transactionId,
        })
        expect(history.amount.toString()).toBe(voided.amount.toString())

        const availability = await calculateEquipmentAvailability(
          context,
          equipmentId,
          date(1),
          date(3)
        )
        expect(availability).toMatchObject({
          blockedByRentals: 1,
          availableQuantity: 0,
        })

        await documents(rental.id)
        expect(await checkoutRental(context, rental.id)).toMatchObject({
          status: 'ACTIVE',
        })
      }
    )

    it.each([
      [['CANCELLED']],
      [['REFUNDED']],
      [['CANCELLED', 'REFUNDED']],
    ] as Array<[ChargeStatus[]]>)(
      'voided charges alone %j never convert nor reserve stock',
      async (statuses) => {
        const { quote } = await quoteWithCharges(statuses)
        await expect(
          convertQuoteToRental(context, quote.id)
        ).rejects.toMatchObject({ code: 'pending_payments' })
        expect(
          await prisma.rentals.count({ where: { quoteId: quote.id } })
        ).toBe(0)
        expect(
          await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })
        ).toMatchObject({ status: 'APPROVED', convertedToRentalId: null })
      }
    )

    it('a paid charge below the total does not convert, even with refunded history', async () => {
      const { payments } = await quoteWithCharges(
        ['REFUNDED', 'PAID'],
        [30, 20]
      )
      expect(await convertPaidQuotePayment(context, payments[1]!.id)).toEqual({
        converted: false,
        reason: 'pending_payments',
      })
      expect(
        await prisma.rentals.count({ where: { tenantId: context.tenantId } })
      ).toBe(0)
    })

    it('a fractional total paid by the requested cents balance converts, reserves stock and allows checkout', async () => {
      // Orçamento legado de 9 dias com semana direta de R$ 100: total gravado sem arredondar.
      const quote = await prisma.quote.create({
        data: {
          tenantId: context.tenantId,
          name: prefix,
          email: `${prefix}@example.test`,
          phone: '00000000000',
          cpf: '12345678909',
          userId,
          status: 'APPROVED',
          approvedAt: new Date(),
          paymentTerms: 'UPFRONT',
          total: FRACTIONAL_TOTAL,
          startDate: date(1),
          endDate: date(9),
          items: {
            create: {
              tenantId: context.tenantId,
              equipmentId: weeklyEquipmentId,
              quantity: 1,
              days: 9,
              pricePerDay: '14.285714285714286',
              total: FRACTIONAL_TOTAL,
              startDate: date(1),
              endDate: date(9),
            },
          },
        },
      })
      quoteIds.push(quote.id)

      // O cliente paga exatamente o saldo em centavos que a obrigação cobra.
      const { payment } = await requestPayment(
        principal(),
        { quoteId: quote.id, amount: 128.57, dueDate: date(1) },
        'PIX'
      )
      expect(payment.amount.toString()).toBe('128.57')
      await processPayment(context, payment.id, { status: 'PAID' })

      const result = await convertPaidQuotePayment(context, payment.id)
      expect(result).toMatchObject({ converted: true })
      const rental = await prisma.rentals.findUniqueOrThrow({
        where: { id: result.rentalId! },
      })
      expect(rental.total.toString()).toBe('128.57')
      // Quitada nos dois lados: não sobra saldo nem resíduo abaixo de um centavo.
      await expect(
        requestPayment(
          principal(),
          { rentalId: rental.id, amount: 0.01, dueDate: date(1) },
          'PIX'
        )
      ).rejects.toMatchObject({ status: 409 })

      expect(
        await calculateEquipmentAvailability(
          context,
          weeklyEquipmentId,
          date(1),
          date(9)
        )
      ).toMatchObject({ blockedByRentals: 1, availableQuantity: 0 })
      await documents(rental.id)
      expect(await checkoutRental(context, rental.id)).toMatchObject({
        status: 'ACTIVE',
      })
    })

    it('a quote request for 9 days at a weekly direct price stores and charges its total in cents', async () => {
      const created = await createQuoteRequest(
        context,
        {
          customerName: prefix,
          customerEmail: `${prefix}@example.test`,
          customerPhone: '00000000000',
          cpf: '12345678909',
          items: [
            {
              equipmentId: weeklyEquipmentId,
              quantity: 1,
              days: 9,
              startDate: date(11),
              endDate: date(19),
              includeWeekends: true,
            },
            {
              equipmentId: dailyEquipmentId,
              quantity: 1,
              days: 1,
              startDate: date(11),
              endDate: date(11),
              includeWeekends: true,
            },
          ],
        },
        userId
      )
      quoteIds.push(created.id)
      // Cada item sai em centavos (128.5714… → 128.57) e o total é a soma deles.
      expect(created.items.map((item) => item.total.toString()).sort()).toEqual(
        ['128.57', '14.29']
      )
      expect(created.total.toString()).toBe('142.86')
      expect(created.originalTotal?.toString()).toBe('142.86')

      await prisma.quote.update({
        where: { id: created.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      })
      const { payment } = await requestPayment(
        principal(),
        { quoteId: created.id, amount: 142.86, dueDate: date(11) },
        'PIX'
      )
      await processPayment(context, payment.id, { status: 'PAID' })
      expect(await convertPaidQuotePayment(context, payment.id)).toMatchObject({
        converted: true,
      })
    })

    it('a PENDING rental with a fractional legacy total and a cents PAID charge keeps its stock', async () => {
      const { quote } = await quoteWithCharges([])
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'COMPLETED', total: FRACTIONAL_TOTAL },
      })
      const rental = await prisma.rentals.create({
        data: {
          tenantId: context.tenantId,
          id: `rental_${randomUUID()}`,
          userid: userId,
          quoteId: quote.id,
          startdate: date(1),
          enddate: date(9),
          total: FRACTIONAL_TOTAL,
          status: 'PENDING',
          rental_items: {
            create: {
              tenantId: context.tenantId,
              id: `rental_item_${randomUUID()}`,
              equipmentid: weeklyEquipmentId,
              quantity: 1,
              priceperday: '14.285714285714286',
              totaldays: 9,
              totalprice: FRACTIONAL_TOTAL,
              startDate: date(1),
              endDate: date(9),
            },
          },
        },
      })
      await prisma.payment.create({
        data: {
          tenantId: context.tenantId,
          rentalId: rental.id,
          amount: '128.57',
          method: 'PIX',
          type: 'DEPOSIT',
          status: 'PAID',
          paidAt: new Date(),
          dueDate: date(1),
        },
      })

      expect(
        await calculateEquipmentAvailability(
          context,
          weeklyEquipmentId,
          date(1),
          date(9)
        )
      ).toMatchObject({ blockedByRentals: 1, availableQuantity: 0 })
      await documents(rental.id)
      expect(await checkoutRental(context, rental.id)).toMatchObject({
        status: 'ACTIVE',
      })
    })

    it.each([
      ['REFUNDED', 'with its provider id', true, false],
      ['CANCELLED', 'never issued (no provider id)', false, false],
      ['CANCELLED', 'with the provider cancellation confirmed', true, true],
    ] as const)(
      'a %s boleto %s stays untouched as history and a new boleto obligation is issued',
      async (status, _label, issued, confirmed) => {
        const { quote } = await quoteWithCharges([])
        const previous = await prisma.payment.create({
          data: {
            tenantId: context.tenantId,
            quoteId: quote.id,
            amount: 30,
            method: 'BOLETO',
            type: 'RENTAL',
            status,
            dueDate: date(1),
            transactionId: issued ? `old-${status}-${quote.id}` : null,
            metadata: { barcode: 'old' },
            createdAt: new Date(Date.now() - 60_000),
          },
        })
        if (confirmed)
          await prisma.paymentAttempt.create({
            data: {
              tenantId: context.tenantId,
              paymentId: previous.id,
              integrationId,
              provider: 'ASAAS',
              externalId: previous.transactionId,
              idempotencyKey: `${context.tenantId}:confirmed:${previous.id}`,
              status: 'CANCELLED',
              cancellationStatus: 'CONFIRMED',
              amount: 30,
              dueDate: date(1),
            },
          })

        const reply = await ensureQuoteBoletoPayment(context, quote.id)
        expect(reply).toMatchObject({
          created: true,
          status: 'PENDING',
          processing: 'PENDING',
          amount: 30,
        })
        expect(reply.paymentId).not.toBe(previous.id)
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toEqual(previous)
        expect(
          await prisma.outboxEvent.count({
            where: {
              tenantId: context.tenantId,
              topic: 'payment.issue',
              aggregateId: reply.paymentId,
            },
          })
        ).toBe(1)
        expect(
          await prisma.outboxEvent.count({
            where: { tenantId: context.tenantId, aggregateId: previous.id },
          })
        ).toBe(0)

        const again = await ensureQuoteBoletoPayment(context, quote.id)
        expect(again).toMatchObject({
          paymentId: reply.paymentId,
          created: false,
        })
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(2)
      }
    )

    it('without a provider reader, a CANCELLED boleto never proven extinct blocks a second live boleto', async () => {
      // Composição sem leitor do provedor: nada prova o fim da cobrança externa.
      const { ensureQuoteBoletoPayment: ensureWithoutReader } =
        createQuoteBoletos({
          withTenantTransaction: (tenant, operation) =>
            withTenantTransaction(tenant, operation),
          withRentalTransaction,
          obligationError: (status, message) =>
            new PaymentRequestError(status, message),
        })
      const { quote } = await quoteWithCharges([])
      const previous = await legacyCancelledBoleto(
        quote.id,
        `pay_legacy_${quote.id}`
      )
      await expect(
        ensureWithoutReader(context, quote.id)
      ).rejects.toMatchObject({ status: 409 })
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
      ).toEqual(previous)
      expect(await prisma.payment.count({ where: { quoteId: quote.id } })).toBe(
        1
      )
      expect(
        await prisma.outboxEvent.count({
          where: { tenantId: context.tenantId },
        })
      ).toBe(0)
    })

    describe('with the provider charge reader (Asaas contract double)', () => {
      let fake: FakeAsaas
      let gateway: ReturnType<typeof createAsaasGateway>
      let ensureWithProvider: typeof ensureQuoteBoletoPayment
      beforeEach(() => {
        fake = createFakeAsaas()
        gateway = createAsaasGateway({
          apiKey: fake.rootApiKey,
          environment: 'sandbox',
          fetch: fake.fetch,
        })
        ensureWithProvider = createQuoteBoletos({
          withTenantTransaction: (tenant, operation) =>
            withTenantTransaction(tenant, operation),
          withRentalTransaction,
          obligationError: (status, message) =>
            new PaymentRequestError(status, message),
          readProviderCharge: async (_tenant, externalId) => ({
            integrationId,
            charge: await gateway.get(externalId),
          }),
        }).ensureQuoteBoletoPayment
      })
      /** Boleto emitido no Asaas pelo fluxo legado (a linha local foi marcada CANCELLED sem cancelar lá). */
      const providerBoleto = (quoteId: string, amount = '30') =>
        gateway.create({
          reference: `legacy:${quoteId}`,
          amount,
          dueDate: '2031-06-10',
          description: 'Boleto legado',
          method: 'BOLETO',
          customer: {
            name: prefix,
            email: `${prefix}@example.test`,
            document: SAMPLE_DOCUMENTS.cpf,
          },
        })
      const providerReads = () =>
        fake.countRequests('GET', /^\/payments\/[^/]+$/)
      const attemptsOf = (paymentId: string) =>
        prisma.paymentAttempt.findMany({
          where: { paymentId },
          select: {
            externalId: true,
            integrationId: true,
            status: true,
            cancellationStatus: true,
          },
        })

      it('a removed provider charge is recorded as proof once and a single new boleto is issued', async () => {
        const { quote } = await quoteWithCharges([])
        const charge = await providerBoleto(quote.id)
        await gateway.cancel(charge.id)
        const previous = await legacyCancelledBoleto(quote.id, charge.id)
        fake.clearRecords()

        const reply = await ensureWithProvider(context, quote.id)
        expect(reply).toMatchObject({
          created: true,
          status: 'PENDING',
          processing: 'PENDING',
          amount: 30,
        })
        expect(reply.paymentId).not.toBe(previous.id)
        expect(await attemptsOf(previous.id)).toEqual([
          {
            externalId: charge.id,
            integrationId,
            status: 'CANCELLED',
            cancellationStatus: 'CONFIRMED',
          },
        ])
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toEqual(previous)

        const again = await ensureWithProvider(context, quote.id)
        expect(again).toMatchObject({
          paymentId: reply.paymentId,
          created: false,
        })
        expect(providerReads()).toBe(1)
        expect(fake.countRequests('POST', /.*/)).toBe(0)
        expect(
          await prisma.outboxEvent.count({
            where: { tenantId: context.tenantId, topic: 'payment.issue' },
          })
        ).toBe(1)
      })

      it.each([
        ['PENDING', 'AWAITING_PAYMENT', 'ISSUED'],
        ['OVERDUE', 'UNPAID', 'OVERDUE'],
      ] as const)(
        'an open (%s) provider charge becomes the current boleto again instead of a second one',
        async (providerStatus, billingStatus, attemptStatus) => {
          const { quote } = await quoteWithCharges([])
          const charge = await providerBoleto(quote.id)
          if (providerStatus === 'OVERDUE') fake.markOverdue(charge.id)
          const previous = await legacyCancelledBoleto(quote.id, charge.id)
          fake.clearRecords()

          const reply = await ensureWithProvider(context, quote.id)
          expect(reply).toMatchObject({
            paymentId: previous.id,
            created: false,
            status: providerStatus,
            processing: 'ISSUED',
            amount: 30,
          })
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: previous.id },
            })
          ).toMatchObject({
            status: providerStatus,
            billingStatus,
            transactionId: charge.id,
            settledAt: null,
          })
          expect(await attemptsOf(previous.id)).toEqual([
            {
              externalId: charge.id,
              integrationId,
              status: attemptStatus,
              cancellationStatus: 'NONE',
            },
          ])
          // O webhook e a verificação do provedor voltam a achar esta cobrança.
          expect(
            await prisma.externalResourceTenant.findMany({
              where: { tenantId: context.tenantId },
              select: { externalId: true, resourceId: true },
            })
          ).toEqual([{ externalId: charge.id, resourceId: previous.id }])
          expect(
            await prisma.outboxEvent.count({
              where: { tenantId: context.tenantId },
            })
          ).toBe(0)

          expect(await ensureWithProvider(context, quote.id)).toMatchObject({
            paymentId: previous.id,
            created: false,
          })
          expect(providerReads()).toBe(1)
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
        }
      )

      it('a provider charge already received is reconciled and confirmed through the outbox, never issued twice', async () => {
        const { quote } = await quoteWithCharges([])
        const charge = await providerBoleto(quote.id)
        fake.receivePayment(charge.id)
        const previous = await legacyCancelledBoleto(quote.id, charge.id)

        const reply = await ensureWithProvider(context, quote.id)
        expect(reply).toMatchObject({ paymentId: previous.id, created: false })
        const confirmation = await prisma.outboxEvent.findMany({
          where: {
            tenantId: context.tenantId,
            topic: 'payment.provider.confirmed',
          },
        })
        expect(confirmation.map((event) => event.payload)).toEqual([
          { paymentId: previous.id, externalId: charge.id },
        ])
        // O consumidor da outbox confirma pelo fluxo normal de pagamento.
        await processPayment(context, previous.id, {
          status: 'PAID',
          externalId: charge.id,
        })
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toMatchObject({ status: 'PAID', billingStatus: 'PAID' })
        expect(await attemptsOf(previous.id)).toEqual([
          expect.objectContaining({ externalId: charge.id, status: 'PAID' }),
        ])
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
        expect(
          await prisma.outboxEvent.count({
            where: { tenantId: context.tenantId, topic: 'payment.issue' },
          })
        ).toBe(0)
      })

      it.each([
        ['a provider charge with another amount', '31'],
        [
          'a charge unknown to the provider (a 404 never proves cancellation)',
          null,
        ],
      ] as const)(
        '%s requires reconciliation and changes nothing',
        async (_label, amount) => {
          const { quote } = await quoteWithCharges([])
          const externalId = amount
            ? (await providerBoleto(quote.id, amount)).id
            : 'pay_unknown_' + quote.id
          const previous = await legacyCancelledBoleto(quote.id, externalId)

          await expect(
            ensureWithProvider(context, quote.id)
          ).rejects.toMatchObject({ status: 409 })
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: previous.id },
            })
          ).toEqual(previous)
          expect(await attemptsOf(previous.id)).toEqual([])
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
          expect(
            await prisma.outboxEvent.count({
              where: { tenantId: context.tenantId },
            })
          ).toBe(0)
        }
      )

      it('an unavailable provider answers 503 and changes nothing', async () => {
        const { quote } = await quoteWithCharges([])
        const charge = await providerBoleto(quote.id)
        const previous = await legacyCancelledBoleto(quote.id, charge.id)
        fake.inject({
          method: 'GET',
          path: '/payments/' + charge.id,
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          ensureWithProvider(context, quote.id)
        ).rejects.toMatchObject({ status: 503 })
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toEqual(previous)
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
      })
    })
  }
)

const prisma = getDatabaseRuntime().prisma
function requireFixturePool() {
  const pool = fixtureDatabase.pool
  if (!pool) throw new Error('Owned fixture pool was not initialized')
  return pool
}

const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
const { processPayment } = createPaymentProcessor({ withRentalTransaction })
const { calculateEquipmentAvailability } = createRentalAvailability({
  withTenantTransaction,
})
