import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createPaymentIssuance } from '@gb-locacoes/backend/billing'
import { createIntegrationCredentialResolver } from '@gb-locacoes/backend/runtime'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
/**
 * Cron da outbox (`GET /api/cron/outbox`) sobre o PostgreSQL descartável e o dublê de contrato do
 * Asaas: a mesma passada que entrega a outbox agenda a conciliação das emissões UNKNOWN além da
 * janela. Sem essa ligação a tentativa ficaria UNKNOWN para sempre (achado 102).
 * O cron percorre as locadoras ativas do banco; aqui ele só enxerga a locadora deste arquivo, para
 * nunca entregar eventos dos outros testes que rodam em paralelo no mesmo banco.
 */
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
const fixture = vi.hoisted(() => ({
  tenantId: 'outbox-cron-' + crypto.randomUUID(),
  apiKey: 'fixture-api-key',
}))
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
// A limpeza global de platform_rate_limits não é assunto deste teste e mexeria nas linhas de outros.
vi.mock('@gb-locacoes/backend/directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/directory')>()),
  purgeExpiredPlatformRateLimits: async () => 0,
}))
import { createAsaasHttpClient } from '@gb-locacoes/backend/billing'
import { UNKNOWN_ISSUANCE_SETTLE_MS } from '../../packages/backend/src/modules/billing/issue-payment'
import { createFakeAsaas, type FakeAsaas } from '../helpers/fake-asaas'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()
  if (!process.env.TEST_DATABASE_URL)
    return { ...actual, getDatabaseRuntime: () => ({ prisma: undefined }) }
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 8,
  })
  const client = new PrismaClient({ adapter: new PrismaPg(pool) })
  // Só a enumeração de locadoras do cron é restrita à locadora deste arquivo; o resto é o cliente real.
  const organization = new Proxy(client.organization, {
    get(target, property) {
      if (property === 'findMany') {
        return (args: { where?: object } = {}) =>
          target.findMany({
            ...args,
            where: { AND: [args.where ?? {}, { id: fixture.tenantId }] },
          })
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const prisma = new Proxy(client, {
    get(target, property) {
      if (property === 'organization') return organization
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  // O serviço lê o mesmo cliente restrito pelo runtime do backend (onda 135, B5).
  fixtureDatabase.pool = pool
  const fixturePrisma = (fixtureDatabase.prisma = prisma)
  fixtureDatabase.prisma = fixturePrisma
  return {
    ...actual,
    getDatabaseRuntime: () => ({ prisma: fixturePrisma }),
    createIntegrationCredentialResolver: () => async () => ({
      apiKey: fixture.apiKey,
      environment: 'sandbox',
    }),
  }
})
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => null,
  }))()),
}))
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    ...(await (() => ({
      resolveIntegrationCredential: async () => ({
        apiKey: fixture.apiKey,
        environment: 'sandbox',
      }),
    }))()),
  })
)
import * as serviceRoute0 from '../../apps/services/api/src/app/api/cron/outbox/route'

const HOSTS = [
  [
    'service',
    {
      outboxCron: serviceRoute0.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { outboxCron }) => {
  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    'GET /api/cron/outbox on disposable PostgreSQL',
    () => {
      const tenantId = fixture.tenantId
      const context = { tenantId }
      const secret = 'cron-secret-for-tests'
      let integrationId: string
      let fake: FakeAsaas
      beforeAll(async () => {
        await prisma.organization.create({
          data: { id: tenantId, slug: tenantId, name: 'Fixture' },
        })
        integrationId = (
          await prisma.tenantIntegration.create({
            data: {
              tenantId,
              provider: 'ASAAS',
              credentialsRef: 'env:LOCADORA_INTEGRATION_FIXTURE',
              status: 'ACTIVE',
            },
          })
        ).id
      })
      beforeEach(() => {
        fake = createFakeAsaas()
        fixture.apiKey = fake.rootApiKey
        vi.stubGlobal('fetch', fake.fetch)
        vi.stubEnv('CRON_SECRET', secret)
      })
      afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
      })
      afterAll(async () => {
        await prisma.outboxEvent.deleteMany({ where: { tenantId } })
        await prisma.externalResourceTenant.deleteMany({ where: { tenantId } })
        await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
        await prisma.payment.deleteMany({ where: { tenantId } })
        await prisma.quote.deleteMany({ where: { tenantId } })
        await prisma.tenantIntegration.deleteMany({ where: { tenantId } })
        await prisma.organization.deleteMany({ where: { id: tenantId } })
      })
      const runCron = async () => {
        const response = await outboxCron(
          new Request('http://localhost/api/cron/outbox', {
            headers: { authorization: 'Bearer ' + secret },
          })
        )
        expect(response.status).toBe(200)
        return response.json() as Promise<{
          completed: number
          retried: number
          failed: number
          issuanceReconciliations: number
        }>
      }
      /** Boleto pendente cujo POST /payments respondeu 503: a tentativa fica UNKNOWN sem cobrança vinculada. */
      async function uncertainBoleto() {
        const quote = await prisma.quote.create({
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
        const payment = await prisma.payment.create({
          data: {
            tenantId,
            quoteId: quote.id,
            amount: 100,
            method: 'BOLETO',
            type: 'RENTAL',
            dueDate: new Date('2030-01-10T12:00:00Z'),
          },
        })
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({ maybeApplied: true })
        const attempt = await prisma.paymentAttempt.findFirstOrThrow({
          where: { tenantId, paymentId: payment.id },
        })
        expect(attempt).toMatchObject({
          status: 'UNKNOWN',
          externalId: null,
          integrationId,
        })
        return { payment, attempt }
      }
      async function age(attemptId: string, ms: number) {
        const { testPool } = { testPool: requireFixturePool() }
        await testPool.query(
          `UPDATE payment_attempts SET "updatedAt" = "updatedAt" - ($2::int * interval '1 millisecond') WHERE id = $1`,
          [attemptId, ms]
        )
      }

      it('dentro da janela o cron não agenda nada e nunca repete o POST', async () => {
        const { payment, attempt } = await uncertainBoleto()
        expect(await runCron()).toMatchObject({
          issuanceReconciliations: 0,
          completed: 0,
        })
        expect(
          await prisma.outboxEvent.count({
            where: { tenantId, aggregateId: payment.id },
          })
        ).toBe(0)
        expect(
          await prisma.paymentAttempt.findUniqueOrThrow({
            where: { id: attempt.id },
          })
        ).toMatchObject({ status: 'UNKNOWN', updatedAt: attempt.updatedAt })
        expect(fake.countRequests('POST', '/payments')).toBe(1)
      })

      it('passada a janela, a mesma passada do cron agenda a conciliação e a entrega: a tentativa sai de UNKNOWN com uma cobrança só', async () => {
        const { payment, attempt } = await uncertainBoleto()
        await age(attempt.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await runCron()).toMatchObject({
          issuanceReconciliations: 1,
          completed: 1,
          retried: 0,
          failed: 0,
        })
        const issued = await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
        expect(issued).toMatchObject({
          status: 'ISSUED',
          externalId: expect.stringMatching(/^pay_/),
        })
        expect(
          (
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment.id },
            })
          ).transactionId
        ).toBe(issued.externalId)
        expect(fake.countRequests('POST', '/payments')).toBe(2)
        const provider = createAsaasHttpClient({
          credential: fake.rootApiKey,
          environment: 'sandbox',
          fetch: fake.fetch,
        })
        const charges = (await provider.request({
          method: 'GET',
          path: '/payments',
          query: { externalReference: attempt.idempotencyKey },
        })) as { data: unknown[] }
        expect(charges.data).toHaveLength(1)
        // Resolvido: a passada seguinte não agenda nem emite mais nada.
        expect(await runCron()).toMatchObject({
          issuanceReconciliations: 0,
          completed: 0,
        })
        expect(fake.countRequests('POST', '/payments')).toBe(2)
      })

      // Achado 116: QUEUED cujo evento morreu e PROCESSING abandonada também saem pela mesma passada.
      describe('achado 116: tentativas paradas fora de UNKNOWN', () => {
        // Cada dublê novo numera as cobranças do zero: o registro de ids externos de um caso anterior
        // não pode sobrar, porque no Asaas real esses ids nunca se repetem.
        beforeEach(async () => {
          await prisma.outboxEvent.deleteMany({ where: { tenantId } })
          await prisma.externalResourceTenant.deleteMany({
            where: { tenantId },
          })
          await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
          await prisma.payment.deleteMany({ where: { tenantId } })
          await prisma.quote.deleteMany({ where: { tenantId } })
        })
        it.each<[string, 'QUEUED' | 'PROCESSING']>([
          ['QUEUED cujo payment.issue esgotou as entregas', 'QUEUED'],
          ['PROCESSING abandonada pelo processo que a reservou', 'PROCESSING'],
        ])(
          '%s: passada a janela, o cron religa e emite uma vez',
          async (_label, status) => {
            const quote = await prisma.quote.create({
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
            const payment = await prisma.payment.create({
              data: {
                tenantId,
                quoteId: quote.id,
                amount: 100,
                method: 'BOLETO',
                type: 'RENTAL',
                dueDate: new Date('2030-01-10T12:00:00Z'),
              },
            })
            const attempt = await prisma.paymentAttempt.create({
              data: {
                tenantId,
                paymentId: payment.id,
                integrationId,
                provider: 'ASAAS',
                status,
                amount: 100,
                dueDate: payment.dueDate,
                idempotencyKey:
                  tenantId + ':payment:' + payment.id + ':initial',
              },
            })
            // O evento do pedido já esgotou as entregas por falha passageira.
            await prisma.outboxEvent.create({
              data: {
                tenantId,
                topic: 'payment.issue',
                aggregateId: payment.id,
                payload: { paymentId: payment.id },
                dedupeKey: tenantId + ':payment.issue:' + payment.id,
                status: 'FAILED',
                attempts: 8,
                lastError: 'DELIVERY_FAILED',
              },
            })
            expect(await runCron()).toMatchObject({
              issuanceReconciliations: 0,
              completed: 0,
            })
            await age(attempt.id, UNKNOWN_ISSUANCE_SETTLE_MS)
            expect(await runCron()).toMatchObject({
              issuanceReconciliations: 1,
              completed: 1,
              retried: 0,
              failed: 0,
            })
            const issued = await prisma.paymentAttempt.findUniqueOrThrow({
              where: { id: attempt.id },
            })
            expect(issued).toMatchObject({
              status: 'ISSUED',
              externalId: expect.stringMatching(/^pay_/),
            })
            expect(
              (
                await prisma.payment.findUniqueOrThrow({
                  where: { id: payment.id },
                })
              ).transactionId
            ).toBe(issued.externalId)
            expect(fake.countRequests('POST', '/payments')).toBe(1)
            expect(await runCron()).toMatchObject({
              issuanceReconciliations: 0,
              completed: 0,
            })
          }
        )

        // Segunda rodada: o Asaas recusa o pedido (vencimento no passado, 400). Religar a cada 6 h
        // repetiria o mesmo POST recusado para sempre.
        it('QUEUED presa cujo vencimento já passou: o cron religa uma vez, o Asaas recusa, a tentativa encerra em FAILED e nenhuma passada volta a agendá-la', async () => {
          const quote = await prisma.quote.create({
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
          const payment = await prisma.payment.create({
            data: {
              tenantId,
              quoteId: quote.id,
              amount: 100,
              method: 'BOLETO',
              type: 'RENTAL',
              dueDate: new Date('2020-01-10T12:00:00Z'),
            },
          })
          const attempt = await prisma.paymentAttempt.create({
            data: {
              tenantId,
              paymentId: payment.id,
              integrationId,
              provider: 'ASAAS',
              amount: 100,
              dueDate: payment.dueDate,
              idempotencyKey: tenantId + ':payment:' + payment.id + ':initial',
            },
          })
          await prisma.outboxEvent.create({
            data: {
              tenantId,
              topic: 'payment.issue',
              aggregateId: payment.id,
              payload: { paymentId: payment.id },
              dedupeKey: tenantId + ':payment.issue:' + payment.id,
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
            },
          })
          await age(attempt.id, UNKNOWN_ISSUANCE_SETTLE_MS)
          expect(await runCron()).toMatchObject({
            issuanceReconciliations: 1,
            completed: 0,
            retried: 0,
            failed: 1,
          })
          expect(
            await prisma.paymentAttempt.findUniqueOrThrow({
              where: { id: attempt.id },
            })
          ).toMatchObject({ status: 'FAILED', externalId: null })
          expect(
            await prisma.outboxEvent.findFirstOrThrow({
              where: {
                tenantId,
                dedupeKey: tenantId + ':payment.issue:resume:' + attempt.id,
              },
            })
          ).toMatchObject({
            status: 'FAILED',
            attempts: 1,
            lastError: 'PAYMENT_REQUEST_REJECTED',
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          // Uma semana depois (eventos e tentativa envelhecem juntos): nenhuma passada agenda nem entrega nada.
          const { testPool } = { testPool: requireFixturePool() }
          await testPool.query(
            `UPDATE outbox_events SET "createdAt" = "createdAt" - interval '7 days' WHERE "tenantId" = $1`,
            [tenantId]
          )
          await age(attempt.id, 7 * 24 * 3600_000)
          for (let pass = 0; pass < 3; pass++) {
            expect(await runCron()).toMatchObject({
              issuanceReconciliations: 0,
              completed: 0,
              retried: 0,
              failed: 0,
            })
          }
          expect(fake.countRequests('POST', '/payments')).toBe(1)
        })
      })

      // Achado 126: o pedido de emissão da locação (`payment.boleto.issue`) esgotou antes de a tentativa
      // existir (integração indisponível, cadastro incompleto). A mesma passada do cron religa a cobrança.
      describe('achado 126: cobrança aberta sem tentativa e sem evento vivo', () => {
        beforeEach(async () => {
          await prisma.outboxEvent.deleteMany({ where: { tenantId } })
          await prisma.externalResourceTenant.deleteMany({
            where: { tenantId },
          })
          await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
          await prisma.payment.deleteMany({ where: { tenantId } })
          await prisma.quote.deleteMany({ where: { tenantId } })
        })
        it('o pedido da cobrança esgotou antes de criar a tentativa: passada a janela, o cron religa e emite uma vez', async () => {
          const quote = await prisma.quote.create({
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
          const payment = await prisma.payment.create({
            data: {
              tenantId,
              quoteId: quote.id,
              amount: 100,
              method: 'BOLETO',
              type: 'RENTAL',
              dueDate: new Date('2030-01-10T12:00:00Z'),
            },
          })
          await prisma.outboxEvent.create({
            data: {
              tenantId,
              topic: 'payment.boleto.issue',
              aggregateId: payment.id,
              payload: { paymentId: payment.id },
              dedupeKey: tenantId + ':payment-boleto:' + payment.id,
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
            },
          })
          expect(await runCron()).toMatchObject({
            issuanceReconciliations: 0,
            completed: 0,
          })
          const { testPool } = { testPool: requireFixturePool() }
          await testPool.query(
            `UPDATE outbox_events SET "createdAt" = "createdAt" - ($2::int * interval '1 millisecond') WHERE "tenantId" = $1`,
            [tenantId, UNKNOWN_ISSUANCE_SETTLE_MS]
          )
          expect(await runCron()).toMatchObject({
            issuanceReconciliations: 1,
            completed: 1,
            retried: 0,
            failed: 0,
          })
          const issued = await prisma.paymentAttempt.findFirstOrThrow({
            where: { tenantId, paymentId: payment.id },
          })
          expect(issued).toMatchObject({
            status: 'ISSUED',
            externalId: expect.stringMatching(/^pay_/),
          })
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: payment.id },
              })
            ).transactionId
          ).toBe(issued.externalId)
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          expect(await runCron()).toMatchObject({
            issuanceReconciliations: 0,
            completed: 0,
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
        })
      })
    }
  )
})

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

const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
const resolveIntegrationCredential = createIntegrationCredentialResolver()
const { issueTenantPayment } = createPaymentIssuance({
  withRentalTransaction,
  withTenantTransaction,
  resolveIntegrationCredential,
})
