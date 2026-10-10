import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createPaymentProcessor } from '@gb-locacoes/backend/billing'
import {
  requestPayment,
  ensureQuoteBoletoPayment,
} from '../../apps/services/api/src/host/payments'
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
  return { ...actual, getDatabaseRuntime: () => ({ prisma: fixturePrisma }) }
})
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// Sem mock da resolução da integração no backend: a credencial da integração vem do ambiente, como em produção.

import { CANCELLED_CHARGE_FAILURES } from '@gb-locacoes/backend/billing'
import { createAsaasGateway } from '../../packages/backend/src/modules/billing/asaas'
import {
  createFakeAsaas,
  SAMPLE_DOCUMENTS,
  type FakeAsaas,
} from '../helpers/fake-asaas'

/**
 * Composição real do backend contra o dublê do Asaas: uma
 * cobrança PIX/boleto marcada CANCELLED só no sistema, com transactionId e sem tentativa, só deixa
 * sair cobrança nova depois de lida no provedor — fora de SQL, pela integração ACTIVE da locadora.
 * Os títulos conservam as antigas lib/quote-boleto.ts e lib/payment-request.ts, retiradas em F; as chamadas atuais são as factories do backend, não imports dessas fachadas.
 */
const CREDENTIAL = 'LOCADORA_INTEGRATION_RECONCILIATION_FIXTURE'
const tenantId = 'reconcile-' + randomUUID()
const context = { tenantId }
const principal = {
  tenantId,
  userId: 'admin-fixture',
  membershipId: 'member-fixture',
  role: 'ADMIN' as const,
}
const dueDate = new Date(Date.UTC(2031, 5, 10))

let integrationId: string
let fake: FakeAsaas
let gateway: ReturnType<typeof createAsaasGateway>
/** Para cada leitura no provedor: o lock de mutação da locadora estava livre (nenhuma transação aberta)? */
let lockFreeDuringProviderCalls: boolean[]

async function rentalMutationLockIsFree() {
  const { testPool } = { testPool: requireFixturePool() }
  const result = await testPool.query(
    "SELECT pg_try_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext($1)) AS free",
    [tenantId]
  )
  return result.rows[0]!.free
}

function useTenantCredential(apiKey: string | undefined) {
  vi.stubEnv(`${CREDENTIAL}_SECRET`, 'fixture-signing-secret')
  vi.stubEnv(`${CREDENTIAL}_API_KEY`, apiKey)
  vi.stubEnv(`${CREDENTIAL}_ENVIRONMENT`, 'sandbox')
}

async function approvedQuote() {
  return prisma.quote.create({
    data: {
      tenantId,
      name: 'Fixture payer',
      email: 'payer@example.test',
      phone: '00000000000',
      cpf: '12345678909',
      total: 100,
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  })
}

/** Cobrança emitida no Asaas pelo fluxo legado. */
function providerCharge(
  quoteId: string,
  method: 'PIX' | 'BOLETO',
  amount = '100'
) {
  return gateway.create({
    reference: `legacy:${method}:${quoteId}`,
    amount,
    dueDate: '2031-06-10',
    description: 'Cobrança legada',
    method,
    customer: {
      name: 'Fixture payer',
      email: 'payer@example.test',
      document: SAMPLE_DOCUMENTS.cpf,
    },
  })
}

/** Linha legada marcada CANCELLED sem cancelar no provedor: guarda o transactionId e não tem tentativa. */
function legacyCancelled(
  quoteId: string,
  method: 'PIX' | 'BOLETO',
  transactionId: string
) {
  return prisma.payment.create({
    data: {
      tenantId,
      quoteId,
      amount: 100,
      method,
      type: method === 'BOLETO' ? 'RENTAL' : 'DEPOSIT',
      status: 'CANCELLED',
      billingStatus: 'SETTLED',
      settledAt: new Date(),
      dueDate,
      transactionId,
      metadata: { legacy: true },
      createdAt: new Date(Date.now() - 60_000),
    },
  })
}

const providerReads = () => fake.countRequests('GET', /^\/payments\/[^/]+$/)
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Proof of a cancelled charge at the provider (disposable PostgreSQL + Asaas double)',
  () => {
    beforeAll(async () => {
      await prisma.organization.create({
        data: {
          id: tenantId,
          slug: tenantId,
          name: 'Reconciliation fixture',
          status: 'ACTIVE',
        },
      })
      integrationId = (
        await prisma.tenantIntegration.create({
          data: {
            tenantId,
            provider: 'ASAAS',
            credentialsRef: 'env:' + CREDENTIAL,
            status: 'ACTIVE',
          },
        })
      ).id
    })
    beforeEach(async () => {
      fake = createFakeAsaas()
      gateway = createAsaasGateway({
        apiKey: fake.rootApiKey,
        environment: 'sandbox',
        fetch: fake.fetch,
      })
      lockFreeDuringProviderCalls = []
      vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', '')
      vi.stubEnv('PLATFORM_ASAAS_EGRESS_PROXY_URL', '')
      useTenantCredential(fake.rootApiKey)
      // Toda saída HTTP do processo vai para o dublê; nada chega a um provedor real.
      vi.stubGlobal(
        'fetch',
        async (input: string | URL, init?: RequestInit) => {
          lockFreeDuringProviderCalls.push(await rentalMutationLockIsFree())
          return fake.fetch(input, init)
        }
      )
    })
    afterEach(async () => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      await prisma.outboxEvent.deleteMany({ where: { tenantId } })
      await prisma.externalResourceTenant.deleteMany({ where: { tenantId } })
      await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
      await prisma.payment.deleteMany({ where: { tenantId } })
      await prisma.quote.deleteMany({ where: { tenantId } })
    })
    afterAll(async () => {
      await prisma.tenantIntegration.deleteMany({ where: { tenantId } })
      await prisma.organization.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
      const { testPool } = { testPool: requireFixturePool() }
      await testPool.end()
    })

    describe('quote boleto composition (lib/quote-boleto.ts)', () => {
      it('reads a removed provider charge with the tenant integration outside SQL, records the proof and issues one boleto', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'BOLETO')
        await gateway.cancel(charge.id)
        const previous = await legacyCancelled(quote.id, 'BOLETO', charge.id)
        fake.clearRecords()

        const reply = await ensureQuoteBoletoPayment(context, quote.id)
        expect(reply).toMatchObject({
          created: true,
          status: 'PENDING',
          processing: 'PENDING',
          amount: 100,
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
        expect(providerReads()).toBe(1)
        expect(lockFreeDuringProviderCalls).toEqual([true])

        expect(await ensureQuoteBoletoPayment(context, quote.id)).toMatchObject(
          { paymentId: reply.paymentId, created: false }
        )
        expect(providerReads()).toBe(1)
        expect(fake.countRequests('POST', /.*/)).toBe(0)
        expect(await outboxTopics()).toEqual(['payment.issue'])
      })

      it.each([
        ['open', 'PENDING', []],
        ['already received', 'PENDING', ['payment.provider.confirmed']],
      ] as const)(
        'an %s provider charge becomes the current boleto again, never a second one',
        async (label, status, topics) => {
          const quote = await approvedQuote()
          const charge = await providerCharge(quote.id, 'BOLETO')
          if (label === 'already received') fake.receivePayment(charge.id)
          const previous = await legacyCancelled(quote.id, 'BOLETO', charge.id)
          fake.clearRecords()

          const reply = await ensureQuoteBoletoPayment(context, quote.id)
          expect(reply).toMatchObject({
            paymentId: previous.id,
            created: false,
            status,
            processing: 'ISSUED',
          })
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
          expect(await outboxTopics()).toEqual(topics)
          expect(lockFreeDuringProviderCalls).toEqual([true])
        }
      )

      it('a charge REFUNDED at the provider for a local CANCELLED row is a divergence: 409 and nothing changes', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'BOLETO')
        fake.receivePayment(charge.id)
        fake.refundPayment(charge.id)
        const previous = await legacyCancelled(quote.id, 'BOLETO', charge.id)
        fake.clearRecords()

        await expect(
          ensureQuoteBoletoPayment(context, quote.id)
        ).rejects.toMatchObject({
          status: 409,
          message: CANCELLED_CHARGE_FAILURES.RECONCILE.message,
        })
        expect(providerReads()).toBe(1)
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toEqual(previous)
        expect(await attemptsOf(previous.id)).toEqual([])
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
        expect(await outboxTopics()).toEqual([])
      })

      it.each([
        ['a tenant integration without an API key', 503, 0],
        ['a provider that rejects the tenant key', 502, 1],
        ['an unavailable provider', 503, 1],
      ] as const)(
        '%s answers %i without a second boleto',
        async (label, status, reads) => {
          const quote = await approvedQuote()
          const charge = await providerCharge(quote.id, 'BOLETO')
          const previous = await legacyCancelled(quote.id, 'BOLETO', charge.id)
          if (label === 'a tenant integration without an API key')
            useTenantCredential(undefined)
          if (label === 'a provider that rejects the tenant key')
            useTenantCredential('not-a-key-of-this-account')
          if (label === 'an unavailable provider')
            fake.inject({
              method: 'GET',
              path: '/payments/' + charge.id,
              fault: { kind: 'status', status: 503 },
            })
          fake.clearRecords()

          await expect(
            ensureQuoteBoletoPayment(context, quote.id)
          ).rejects.toMatchObject({ status })
          expect(providerReads()).toBe(reads)
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: previous.id },
            })
          ).toEqual(previous)
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
          expect(await attemptsOf(previous.id)).toEqual([])
          expect(await outboxTopics()).toEqual([])
        }
      )
      it('a legacy CANCELLED PIX still open at the provider blocks a boleto for the same quote instead of a second charge', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'PIX')
        const previous = await legacyCancelled(quote.id, 'PIX', charge.id)

        await expect(
          ensureQuoteBoletoPayment(context, quote.id)
        ).rejects.toMatchObject({ status: 409 })
        // A cobrança PIX viva volta a ser a vigente; nenhum boleto é criado.
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toMatchObject({ status: 'PENDING', transactionId: charge.id })
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
        expect(await outboxTopics()).toEqual([])
      })
    })

    describe('PIX/BOLETO request (lib/payment-request.ts)', () => {
      const input = (quoteId: string) => ({ quoteId, amount: 100, dueDate })

      it('a legacy CANCELLED PIX removed at the provider gets its proof, then one new charge is queued', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'PIX')
        await gateway.cancel(charge.id)
        const previous = await legacyCancelled(quote.id, 'PIX', charge.id)
        fake.clearRecords()

        const first = await requestPayment(principal, input(quote.id), 'PIX')
        expect(first.pending).toBe(true)
        expect(first.payment.id).not.toBe(previous.id)
        expect(first.payment).toMatchObject({
          method: 'PIX',
          status: 'PENDING',
          transactionId: null,
        })
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
        expect(providerReads()).toBe(1)
        expect(lockFreeDuringProviderCalls).toEqual([true])

        const replay = await requestPayment(principal, input(quote.id), 'PIX')
        expect(replay.payment.id).toBe(first.payment.id)
        expect(providerReads()).toBe(1)
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(2)
        expect(await outboxTopics()).toEqual(['payment.issue'])
      })

      it.each(['PIX', 'BOLETO'] as const)(
        'a legacy CANCELLED %s still open at the provider becomes the current charge again',
        async (method) => {
          const quote = await approvedQuote()
          const charge = await providerCharge(quote.id, method)
          fake.markOverdue(charge.id)
          const previous = await legacyCancelled(quote.id, method, charge.id)
          fake.clearRecords()

          const reply = await requestPayment(principal, input(quote.id), method)
          expect(reply).toMatchObject({
            pending: false,
            payment: {
              id: previous.id,
              status: 'OVERDUE',
              transactionId: charge.id,
            },
          })
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: previous.id },
            })
          ).toMatchObject({
            status: 'OVERDUE',
            billingStatus: 'UNPAID',
            settledAt: null,
          })
          expect(await attemptsOf(previous.id)).toEqual([
            {
              externalId: charge.id,
              integrationId,
              status: 'OVERDUE',
              cancellationStatus: 'NONE',
            },
          ])
          expect(
            await prisma.externalResourceTenant.findMany({
              where: { tenantId },
              select: { externalId: true, resourceId: true },
            })
          ).toEqual([{ externalId: charge.id, resourceId: previous.id }])
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
          expect(await outboxTopics()).toEqual([])
          expect(lockFreeDuringProviderCalls).toEqual([true])

          expect(
            (await requestPayment(principal, input(quote.id), method)).payment
              .id
          ).toBe(previous.id)
          expect(providerReads()).toBe(1)
        }
      )

      it('a legacy CANCELLED PIX already received is reactivated and confirmed through the outbox, never charged twice', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'PIX')
        fake.receivePayment(charge.id)
        const previous = await legacyCancelled(quote.id, 'PIX', charge.id)

        const reply = await requestPayment(principal, input(quote.id), 'PIX')
        expect(reply).toMatchObject({
          pending: false,
          payment: { id: previous.id },
        })
        const confirmation = await prisma.outboxEvent.findMany({
          where: { tenantId, topic: 'payment.provider.confirmed' },
        })
        expect(confirmation.map((event) => event.payload)).toEqual([
          { paymentId: previous.id, externalId: charge.id },
        ])
        await processPayment(context, previous.id, {
          status: 'PAID',
          externalId: charge.id,
        })
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toMatchObject({ status: 'PAID' })
        await expect(
          requestPayment(principal, input(quote.id), 'PIX')
        ).rejects.toMatchObject({ status: 409 })
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
        // Só a confirmação e a conversão normal do orçamento pago; nenhuma emissão.
        expect(await outboxTopics()).toEqual([
          'payment.provider.confirmed',
          'quote.payment.convert',
        ])
      })

      it.each([
        ['REFUNDED at the provider', 409],
        ['unknown to the provider (a 404 never proves cancellation)', 409],
        ['unreadable because the provider is unavailable', 503],
      ] as const)(
        'a legacy CANCELLED PIX %s answers %i and changes nothing',
        async (label, status) => {
          const quote = await approvedQuote()
          let externalId = 'pay_unknown_' + quote.id
          if (!label.startsWith('unknown')) {
            externalId = (await providerCharge(quote.id, 'PIX')).id
            if (label.startsWith('REFUNDED')) {
              fake.receivePayment(externalId)
              fake.refundPayment(externalId)
            } else
              fake.inject({
                method: 'GET',
                path: '/payments/' + externalId,
                fault: { kind: 'status', status: 503 },
              })
          }
          const previous = await legacyCancelled(quote.id, 'PIX', externalId)
          fake.clearRecords()

          await expect(
            requestPayment(principal, input(quote.id), 'PIX')
          ).rejects.toMatchObject({ status })
          expect(providerReads()).toBe(1)
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: previous.id },
            })
          ).toEqual(previous)
          expect(await attemptsOf(previous.id)).toEqual([])
          expect(
            await prisma.payment.count({ where: { quoteId: quote.id } })
          ).toBe(1)
          expect(await outboxTopics()).toEqual([])
        }
      )

      it('a partially paid obligation keeps a legacy CANCELLED PIX still open for manual reconciliation: 409 and nothing changes', async () => {
        const quote = await approvedQuote()
        await prisma.payment.create({
          data: {
            tenantId,
            quoteId: quote.id,
            amount: 40,
            method: 'BOLETO',
            type: 'RENTAL',
            status: 'PAID',
            paidAt: new Date(),
            dueDate,
          },
        })
        const charge = await providerCharge(quote.id, 'PIX', '60')
        const previous = await prisma.payment.update({
          where: { id: (await legacyCancelled(quote.id, 'PIX', charge.id)).id },
          data: { amount: 60 },
        })
        fake.clearRecords()

        await expect(
          requestPayment(
            principal,
            { quoteId: quote.id, amount: 60, dueDate },
            'PIX'
          )
        ).rejects.toMatchObject({
          status: 409,
          message: CANCELLED_CHARGE_FAILURES.RECONCILE.message,
        })
        expect(providerReads()).toBe(1)
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toEqual(previous)
        expect(await attemptsOf(previous.id)).toEqual([])
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(2)
        expect(await outboxTopics()).toEqual([])
      })

      it('a legacy CANCELLED BOLETO still open blocks a PIX for the same obligation instead of charging it twice', async () => {
        const quote = await approvedQuote()
        const charge = await providerCharge(quote.id, 'BOLETO')
        const previous = await legacyCancelled(quote.id, 'BOLETO', charge.id)

        await expect(
          requestPayment(principal, input(quote.id), 'PIX')
        ).rejects.toMatchObject({
          status: 409,
          message:
            'Já existe uma cobrança pendente por outro meio de pagamento',
        })
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
        ).toMatchObject({ status: 'PENDING', transactionId: charge.id })
        expect(
          await prisma.payment.count({ where: { quoteId: quote.id } })
        ).toBe(1)
        expect(await outboxTopics()).toEqual([])
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

const outboxTopics = async () =>
  (
    await prisma.outboxEvent.findMany({
      where: { tenantId },
      select: { topic: true },
    })
  )
    .map((row) => row.topic)
    .sort()

const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
const { processPayment } = createPaymentProcessor({ withRentalTransaction })
