import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createPaymentIssuance } from '@gb-locacoes/backend/billing'
import { createIntegrationCredentialResolver } from '@gb-locacoes/backend/runtime'
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
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 8,
  })
  fixtureDatabase.pool = pool
  const fixturePrisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  fixtureDatabase.prisma = fixturePrisma
  return {
    ...actual,
    getDatabaseRuntime: () => ({ prisma: fixturePrisma }),
    createIntegrationCredentialResolver: () => async () => ({
      apiKey: credential.apiKey,
      environment: 'sandbox',
    }),
  }
})
/**
 * Emissão (`issueTenantPayment`) sobre o PostgreSQL descartável: uma falha do
 * Asaas que prova que nada foi criado (429, 401…) devolve a tentativa a QUEUED
 * e a próxima rodada da outbox emite; na dúvida (timeout do POST) a tentativa
 * fica UNKNOWN e nunca repete o POST.
 */
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
const credential = vi.hoisted(() => ({ apiKey: 'fixture-api-key' }))
import { createAsaasHttpClient } from '@gb-locacoes/backend/billing'
import { UNKNOWN_ISSUANCE_SETTLE_MS } from '../../packages/backend/src/modules/billing/issue-payment'
import { enqueueOutbox } from '@gb-locacoes/backend/outbox'
import { createPrismaOutboxRepository } from '../../packages/backend/src/modules/outbox/adapters/prisma-outbox'
import { dispatchOutbox } from '../../packages/backend/src/modules/outbox/dispatch'
import {
  createFakeAsaas,
  type FakeAsaas,
  type FakeFault,
} from '../helpers/fake-asaas'
const DAY_MS = 24 * 3600_000

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'issueTenantPayment on disposable PostgreSQL',
  () => {
    const tenantId = 'issuance-' + randomUUID()
    const context = { tenantId }
    let integrationId: string
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
    afterEach(() => vi.unstubAllGlobals())
    afterAll(async () => {
      await prisma.outboxEvent.deleteMany({ where: { tenantId } })
      await prisma.externalResourceTenant.deleteMany({ where: { tenantId } })
      await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
      await prisma.payment.deleteMany({ where: { tenantId } })
      await prisma.quote.deleteMany({ where: { tenantId } })
      await prisma.tenantIntegration.deleteMany({ where: { tenantId } })
      await prisma.organization.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
      const { testPool } = { testPool: requireFixturePool() }
      await testPool.end()
    })
    async function pendingBoleto(
      options: {
        dueDate?: Date
        cpf?: string | null
        method?: 'BOLETO' | 'PIX'
      } = {}
    ) {
      const quote = await prisma.quote.create({
        data: {
          tenantId,
          name: 'Fixture payer',
          email: 'payer@example.test',
          phone: '00000000000',
          cpf: options.cpf === undefined ? '12345678909' : options.cpf,
          total: 100,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      })
      return prisma.payment.create({
        data: {
          tenantId,
          quoteId: quote.id,
          amount: 100,
          method: options.method ?? 'BOLETO',
          type: 'RENTAL',
          dueDate: options.dueDate ?? new Date('2030-01-10T12:00:00Z'),
        },
      })
    }
    /** Asaas fictício: `customers` decide a resposta da busca de cliente. */
    function provider(customers: () => Response) {
      const calls: string[] = []
      let created: Record<string, unknown> | null = null
      const fetcher = vi.fn(async (url: string, init: RequestInit) => {
        const method = init.method ?? 'GET'
        calls.push(method + ' ' + new URL(url).pathname)
        if (url.includes('/payments?'))
          return Response.json({
            data: created ? [created] : [],
            hasMore: false,
          })
        if (url.includes('/customers?')) return customers()
        if (method === 'POST' && url.endsWith('/payments')) {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>
          created = {
            id: 'pay_' + randomUUID(),
            externalReference: body.externalReference,
            value: body.value,
            billingType: body.billingType,
            status: 'PENDING',
          }
          return Response.json(created)
        }
        if (url.endsWith('/identificationField'))
          return Response.json({
            identificationField: 'digits',
            barCode: 'barcode',
          })
        throw new Error('Unexpected provider request ' + method + ' ' + url)
      })
      vi.stubGlobal('fetch', fetcher)
      return { calls }
    }
    const attemptOf = (paymentId: string) =>
      prisma.paymentAttempt.findFirstOrThrow({ where: { tenantId, paymentId } })

    it('a 429 before anything is created returns the attempt to QUEUED and the next run issues once', async () => {
      const payment = await pendingBoleto()
      let limited = true
      const { calls } = provider(() =>
        limited
          ? Response.json({ errors: [] }, { status: 429 })
          : Response.json({
              data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }],
              hasMore: false,
            })
      )
      await expect(
        issueTenantPayment(context, payment.id)
      ).rejects.toMatchObject({ reason: 'RATE_LIMITED', maybeApplied: false })
      expect(await attemptOf(payment.id)).toMatchObject({
        status: 'QUEUED',
        integrationId,
        externalId: null,
      })
      expect(calls.filter((call) => call === 'POST /v3/payments')).toHaveLength(
        0
      )
      limited = false
      await issueTenantPayment(context, payment.id)
      expect(await attemptOf(payment.id)).toMatchObject({
        status: 'ISSUED',
        externalId: expect.stringMatching(/^pay_/),
      })
      expect(calls.filter((call) => call === 'POST /v3/payments')).toHaveLength(
        1
      )
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .boletoIssuedAt
      ).toEqual(expect.any(Date))
    })

    // Achado 15 (segunda rodada): a resposta 200 inutilizável de uma LEITURA não escreveu nada.
    it.each<[string, () => Response]>([
      [
        'an unreadable body',
        () =>
          new Response('<html>manutenção</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ],
      ['an unexpected shape', () => Response.json({ data: 'x' })],
    ])(
      'GET /customers answering 200 with %s wrote nothing: the attempt returns to QUEUED and the next run issues once',
      async (_label, unusable) => {
        const payment = await pendingBoleto()
        let broken = true
        const { calls } = provider(() =>
          broken
            ? unusable()
            : Response.json({
                data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }],
                hasMore: false,
              })
        )
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({
          code: 'INVALID_RESPONSE',
          maybeApplied: false,
        })
        expect(await attemptOf(payment.id)).toMatchObject({
          status: 'QUEUED',
          externalId: null,
        })
        expect(calls.filter((call) => call.startsWith('POST '))).toHaveLength(0)
        broken = false
        await issueTenantPayment(context, payment.id)
        expect(await attemptOf(payment.id)).toMatchObject({
          status: 'ISSUED',
          externalId: expect.stringMatching(/^pay_/),
        })
        expect(
          calls.filter((call) => call === 'POST /v3/payments')
        ).toHaveLength(1)
      }
    )

    it('a POST /payments applied with an unusable response stays UNKNOWN and is never repeated, even while the list lags', async () => {
      const payment = await pendingBoleto()
      const calls: string[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
          const method = init.method ?? 'GET'
          calls.push(method + ' ' + new URL(url).pathname)
          // A listagem ainda não mostra a cobrança que o POST criou.
          if (url.includes('/payments?'))
            return Response.json({ data: [], hasMore: false })
          if (url.includes('/customers?'))
            return Response.json({
              data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }],
              hasMore: false,
            })
          if (method === 'POST' && url.endsWith('/payments'))
            return Response.json({ id: 1 })
          throw new Error('Unexpected provider request')
        })
      )
      await expect(
        issueTenantPayment(context, payment.id)
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', maybeApplied: true })
      expect((await attemptOf(payment.id)).status).toBe('UNKNOWN')
      await expect(issueTenantPayment(context, payment.id)).rejects.toThrow(
        'PAYMENT_RECONCILIATION_REQUIRED'
      )
      expect(calls.filter((call) => call === 'POST /v3/payments')).toHaveLength(
        1
      )
    })

    it('after a released 401, a POST that may have been applied stays UNKNOWN and is never repeated', async () => {
      const payment = await pendingBoleto()
      const calls: string[] = []
      let revoked = true
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
          const method = init.method ?? 'GET'
          calls.push(method + ' ' + new URL(url).pathname)
          if (url.includes('/payments?'))
            return Response.json({ data: [], hasMore: false })
          if (url.includes('/customers?'))
            return revoked
              ? Response.json({ errors: [] }, { status: 401 })
              : Response.json({
                  data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }],
                  hasMore: false,
                })
          if (method === 'POST')
            return Response.json({ errors: [] }, { status: 502 })
          throw new Error('Unexpected provider request')
        })
      )
      // Chave revogada: nada foi criado, a tentativa volta à fila.
      await expect(
        issueTenantPayment(context, payment.id)
      ).rejects.toMatchObject({ reason: 'AUTHENTICATION', maybeApplied: false })
      expect((await attemptOf(payment.id)).status).toBe('QUEUED')
      revoked = false
      await expect(
        issueTenantPayment(context, payment.id)
      ).rejects.toMatchObject({ reason: 'PROVIDER_ERROR', maybeApplied: true })
      expect((await attemptOf(payment.id)).status).toBe('UNKNOWN')
      await expect(issueTenantPayment(context, payment.id)).rejects.toThrow(
        'PAYMENT_RECONCILIATION_REQUIRED'
      )
      expect(calls.filter((call) => call === 'POST /v3/payments')).toHaveLength(
        1
      )
    })

    // Achado 102, contra o dublê de contrato do Asaas (`tests/helpers/fake-asaas`).
    describe('achado 102: falha no cliente e conciliação das tentativas UNKNOWN', () => {
      let fake: FakeAsaas
      beforeEach(async () => {
        fake = createFakeAsaas()
        credential.apiKey = fake.rootApiKey
        vi.stubGlobal('fetch', fake.fetch)
        // Cada dublê novo numera as cobranças do zero (pay_000…1, …): tentativas e registro de ids
        // externos de um caso anterior não podem ficar com ids que no Asaas real nunca se repetem, e a
        // conciliação de cada caso só enxerga as tentativas dele.
        await prisma.outboxEvent.deleteMany({ where: { tenantId } })
        await prisma.externalResourceTenant.deleteMany({ where: { tenantId } })
        await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
        await prisma.payment.deleteMany({ where: { tenantId } })
        await prisma.quote.deleteMany({ where: { tenantId } })
      })
      afterEach(() => {
        credential.apiKey = 'fixture-api-key'
      })
      const provider = () =>
        createAsaasHttpClient({
          credential: fake.rootApiKey,
          environment: 'sandbox',
          fetch: fake.fetch,
        })
      const chargesWith = async (reference: string) =>
        (
          (await provider().request({
            method: 'GET',
            path: '/payments',
            query: { externalReference: reference },
          })) as { data: Array<Record<string, unknown>> }
        ).data
      /** O tempo passa para a tentativa: `updatedAt` (a entrada em UNKNOWN) recua `ms`. */
      async function age(attemptId: string, ms: number) {
        const { testPool } = { testPool: requireFixturePool() }
        await testPool.query(
          `UPDATE payment_attempts SET "updatedAt" = "updatedAt" - ($2::int * interval '1 millisecond') WHERE id = $1`,
          [attemptId, ms]
        )
        return (
          await prisma.paymentAttempt.findUniqueOrThrow({
            where: { id: attemptId },
          })
        ).updatedAt
      }
      /** Eventos `payment.issue` de uma cobrança, na ordem em que foram agendados. */
      const reconciliationEvents = (paymentId: string) =>
        prisma.outboxEvent.findMany({
          where: { tenantId, topic: 'payment.issue', aggregateId: paymentId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      /** Entrega a outbox desta locadora como o cron, só com os consumidores da emissão (`payment.issue` e `payment.boleto.issue`). */
      const deliver = () =>
        dispatchOutbox({
          repository: createPrismaOutboxRepository(prisma, tenantId),
          workerId: randomUUID(),
          limit: 5,
          handlers: {
            'payment.issue': (event) =>
              issueTenantPayment(
                context,
                (event.payload as { paymentId: string }).paymentId
              ),
            'payment.boleto.issue': (event) =>
              issueTenantPayment(
                context,
                (event.payload as { paymentId: string }).paymentId
              ),
          },
        })
      /** A espera da outbox passou: as entregas que falharam ficam disponíveis de novo. */
      const releaseBackoff = () =>
        prisma.outboxEvent.updateMany({
          where: { tenantId, status: 'PENDING' },
          data: { availableAt: new Date(Date.now() - 1000) },
        })
      /** Eventos de emissão (`payment.issue` e `payment.boleto.issue`) de uma cobrança, na ordem em que foram criados. */
      const issuanceEvents = (paymentId: string) =>
        prisma.outboxEvent.findMany({
          where: {
            tenantId,
            topic: { in: ['payment.issue', 'payment.boleto.issue'] },
            aggregateId: paymentId,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

      it.each<[string, FakeFault, number]>([
        ['503', { kind: 'status', status: 503 }, 2],
        [
          'aplicado com corpo ilegível',
          { kind: 'body', body: '<html>', apply: true },
          1,
        ],
      ])(
        'POST /customers %s: nenhuma cobrança saiu; a tentativa volta a QUEUED e a próxima rodada emite uma vez',
        async (_label, fault, customerPosts) => {
          const payment = await pendingBoleto()
          fake.inject({ method: 'POST', path: '/customers', fault })
          await expect(
            issueTenantPayment(context, payment.id)
          ).rejects.toMatchObject({ maybeApplied: false })
          expect(await attemptOf(payment.id)).toMatchObject({
            status: 'QUEUED',
            externalId: null,
          })
          expect(fake.countRequests('POST', '/payments')).toBe(0)
          await issueTenantPayment(context, payment.id)
          expect(await attemptOf(payment.id)).toMatchObject({
            status: 'ISSUED',
            externalId: expect.stringMatching(/^pay_/),
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          // Cadastro aplicado é achado pela busca por CPF na rodada seguinte: nunca um segundo cliente.
          expect(fake.countRequests('POST', '/customers')).toBe(customerPosts)
        }
      )

      it('UNKNOWN sem cobrança no Asaas: só depois da janela a outbox ganha uma conciliação por episódio, que devolve a tentativa à fila e emite uma vez', async () => {
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({
          reason: 'PROVIDER_ERROR',
          maybeApplied: true,
        })
        const unknown = await attemptOf(payment.id)
        expect(unknown).toMatchObject({ status: 'UNKNOWN', externalId: null })
        // Dentro da janela a busca vazia não prova nada: nada é agendado e a rodada não repete o POST.
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 0,
        })
        await expect(issueTenantPayment(context, payment.id)).rejects.toThrow(
          'PAYMENT_RECONCILIATION_REQUIRED'
        )
        expect(fake.countRequests('POST', '/payments')).toBe(1)
        await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 1,
        })
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 0,
        })
        expect(
          await prisma.outboxEvent.count({
            where: {
              tenantId,
              topic: 'payment.issue',
              aggregateId: payment.id,
            },
          })
        ).toBe(1)
        expect(await deliver()).toMatchObject({
          completed: 1,
          retried: 0,
          failed: 0,
        })
        const issued = await attemptOf(payment.id)
        expect(issued).toMatchObject({
          id: unknown.id,
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
        expect(await chargesWith(unknown.idempotencyKey)).toHaveLength(1)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 0,
        })
      })

      it('UNKNOWN com a cobrança que o POST incerto criou: a conciliação vincula pela referência, sem outro POST', async () => {
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'body', body: '<html>', apply: true },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({
          code: 'INVALID_RESPONSE',
          maybeApplied: true,
        })
        const unknown = await attemptOf(payment.id)
        expect(unknown.status).toBe('UNKNOWN')
        await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 1,
        })
        expect(await deliver()).toMatchObject({ completed: 1 })
        const [created] = await chargesWith(unknown.idempotencyKey)
        expect(await attemptOf(payment.id)).toMatchObject({
          status: 'ISSUED',
          externalId: created!.id,
        })
        expect(fake.countRequests('POST', '/payments')).toBe(1)
      })

      it('cobrança divergente na referência: a conciliação encerra o evento para revisão, e o episódio UNKNOWN nunca volta a ser agendado', async () => {
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({ maybeApplied: true })
        const unknown = await attemptOf(payment.id)
        // Outra cobrança com a referência da tentativa, de outro valor.
        const customer = (await provider().request({
          method: 'POST',
          path: '/customers',
          body: { name: 'Outro', cpfCnpj: '12345678909' },
        })) as { id: string }
        await provider().request({
          method: 'POST',
          path: '/payments',
          body: {
            customer: customer.id,
            billingType: 'BOLETO',
            value: 99.9,
            dueDate: '2030-01-10',
            externalReference: unknown.idempotencyKey,
          },
        })
        const since = await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 1,
        })
        // Esperar não resolve divergência: a primeira entrega já encerra o evento com o código da revisão.
        expect(await deliver()).toMatchObject({
          completed: 0,
          retried: 0,
          failed: 1,
        })
        expect(await reconciliationEvents(payment.id)).toMatchObject([
          {
            status: 'FAILED',
            attempts: 1,
            lastError: 'PAYMENT_RECONCILIATION_REQUIRED',
          },
        ])
        // Regravar UNKNOWN abriria um episódio novo, e a conciliação voltaria a cada janela.
        expect(await attemptOf(payment.id)).toMatchObject({
          status: 'UNKNOWN',
          externalId: null,
          updatedAt: since,
        })
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 0,
        })
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(Date.now() + 30 * DAY_MS)
          )
        ).toEqual({ scheduled: 0 })
        expect(fake.countRequests('POST', '/payments')).toBe(2)
      })

      it('Asaas fora do ar durante toda a rodada de conciliação: o episódio volta a ser agendado depois da espera e emite uma vez', async () => {
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({ maybeApplied: true })
        const unknown = await attemptOf(payment.id)
        const since = await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 1,
        })
        let outage = true
        vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
          outage
            ? Promise.resolve(
                Response.json(
                  {
                    errors: [
                      { code: 'unavailable', description: 'indisponível' },
                    ],
                  },
                  { status: 503 }
                )
              )
            : fake.fetch(url, init)
        )
        /** Uma rodada inteira com o Asaas fora do ar: as 8 entregas do evento falham e ele esgota. */
        async function exhaustRound() {
          for (let delivery = 0; delivery < 8; delivery++) {
            await deliver()
            await prisma.outboxEvent.updateMany({
              where: { tenantId, status: 'PENDING' },
              data: { availableAt: new Date(Date.now() - 1000) },
            })
          }
          const rounds = await reconciliationEvents(payment.id)
          expect(rounds.at(-1)).toMatchObject({
            status: 'FAILED',
            attempts: 8,
            lastError: 'DELIVERY_FAILED',
          })
          return rounds.at(-1)!.createdAt.getTime()
        }
        const first = await exhaustRound()
        // A falha transitória não mexe na tentativa: o mesmo episódio, à espera da próxima rodada.
        expect(await attemptOf(payment.id)).toMatchObject({
          status: 'UNKNOWN',
          externalId: null,
          updatedAt: since,
        })
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(first + UNKNOWN_ISSUANCE_SETTLE_MS - 1)
          )
        ).toEqual({ scheduled: 0 })
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(first + UNKNOWN_ISSUANCE_SETTLE_MS)
          )
        ).toEqual({ scheduled: 1 })
        // Com uma rodada em curso, nenhuma outra, por mais tempo que passe.
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(first + 30 * DAY_MS)
          )
        ).toEqual({ scheduled: 0 })
        // A espera dobra a cada rodada esgotada.
        const second = await exhaustRound()
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(second + 2 * UNKNOWN_ISSUANCE_SETTLE_MS - 1)
          )
        ).toEqual({ scheduled: 0 })
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(second + 2 * UNKNOWN_ISSUANCE_SETTLE_MS)
          )
        ).toEqual({ scheduled: 1 })
        expect(
          new Set(
            (await reconciliationEvents(payment.id)).map(
              (event) => event.dedupeKey
            )
          ).size
        ).toBe(3)
        // O Asaas volta: a rodada nova acha a referência vazia, devolve a tentativa à fila e emite uma vez.
        outage = false
        expect(await deliver()).toMatchObject({
          completed: 1,
          retried: 0,
          failed: 0,
        })
        const issued = await attemptOf(payment.id)
        expect(issued).toMatchObject({
          id: unknown.id,
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
        expect(await chargesWith(unknown.idempotencyKey)).toHaveLength(1)
        expect(
          await scheduleIssuanceReconciliation(
            context,
            new Date(Date.now() + 30 * DAY_MS)
          )
        ).toEqual({ scheduled: 0 })
      })

      it('episódios parados não escondem os novos: o agendador percorre todas as candidatas, não só as 200 mais antigas', async () => {
        const dueDate = new Date('2030-01-10T12:00:00Z')
        const oldest = Date.now() - 3 * UNKNOWN_ISSUANCE_SETTLE_MS
        const stuck = Array.from({ length: 201 }, () => ({
          id: 'stuck-' + randomUUID(),
          tenantId,
          amount: 100,
          method: 'BOLETO' as const,
          dueDate,
        }))
        await prisma.payment.createMany({ data: stuck })
        await prisma.paymentAttempt.createMany({
          data: stuck.map((payment, index) => ({
            tenantId,
            paymentId: payment.id,
            integrationId,
            provider: 'ASAAS',
            status: 'UNKNOWN' as const,
            amount: 100,
            dueDate,
            idempotencyKey: tenantId + ':payment:' + payment.id + ':initial',
            updatedAt: new Date(oldest + index),
          })),
        })
        expect(
          await scheduleIssuanceReconciliation(context, new Date(), 500)
        ).toEqual({ scheduled: 201 })
        // Todas acabam na revisão manual (cobrança divergente): UNKNOWN para sempre, sem nova rodada.
        await prisma.outboxEvent.updateMany({
          where: { tenantId },
          data: {
            status: 'FAILED',
            attempts: 1,
            lastError: 'PAYMENT_RECONCILIATION_REQUIRED',
          },
        })
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({ maybeApplied: true })
        await age((await attemptOf(payment.id)).id, UNKNOWN_ISSUANCE_SETTLE_MS)
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 1,
        })
        expect(await reconciliationEvents(payment.id)).toMatchObject([
          { status: 'PENDING' },
        ])
        expect(await deliver()).toMatchObject({ completed: 1 })
        expect(await attemptOf(payment.id)).toMatchObject({ status: 'ISSUED' })
      })

      it('duas conciliações do mesmo episódio ao mesmo tempo: a que chega depois do POST incerto da outra nunca emite de novo', async () => {
        const payment = await pendingBoleto()
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'status', status: 503 },
        })
        await expect(
          issueTenantPayment(context, payment.id)
        ).rejects.toMatchObject({ maybeApplied: true })
        const unknown = await attemptOf(payment.id)
        await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
        // O POST da conciliação que vai na frente é aplicado com resposta ilegível: episódio UNKNOWN novo.
        fake.inject({
          method: 'POST',
          path: '/payments',
          fault: { kind: 'body', body: '<html>', apply: true },
        })
        let searches = 0
        let releaseAhead!: () => void
        const aheadMayContinue = new Promise<void>((resolve) => {
          releaseAhead = resolve
        })
        let markAheadDone!: () => void
        const aheadDone = new Promise<void>((resolve) => {
          markAheadDone = resolve
        })
        vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
          const search =
            (init.method ?? 'GET') === 'GET' &&
            new URL(url).pathname.endsWith('/payments') &&
            url.includes('externalReference=')
          const turn = search ? ++searches : 0
          const response = await fake.fetch(url, init)
          // A que vai na frente só segue depois que a outra já buscou (e achou a referência vazia)…
          if (turn === 1) await aheadMayContinue
          // …e a resposta vazia da outra só chega depois que a da frente terminou (POST incerto aplicado).
          if (turn === 2) {
            releaseAhead()
            await aheadDone
          }
          return response
        })
        const outcomes = [
          issueTenantPayment(context, payment.id),
          issueTenantPayment(context, payment.id),
        ].map((run) =>
          run.then(
            () => 'ok',
            (error: Error) => error.message
          )
        )
        void Promise.race(outcomes).then(() => markAheadDone())
        expect((await Promise.all(outcomes)).sort()).toEqual([
          'INVALID_RESPONSE',
          'PAYMENT_RECONCILIATION_REQUIRED',
        ])
        expect(searches).toBe(2)
        expect(fake.countRequests('POST', '/payments')).toBe(2)
        expect(await chargesWith(unknown.idempotencyKey)).toHaveLength(1)
        const after = await attemptOf(payment.id)
        expect(after).toMatchObject({
          id: unknown.id,
          status: 'UNKNOWN',
          externalId: null,
        })
        expect(after.updatedAt.getTime()).toBeGreaterThan(
          unknown.updatedAt.getTime()
        )
      })

      it('fora da conciliação: cobrança já vinculada, cancelamento pedido ou pagamento encerrado', async () => {
        const cases: Array<[Record<string, unknown>, Record<string, unknown>]> =
          [
            [{ externalId: 'pay_linked_' + randomUUID() }, {}],
            [{ cancellationStatus: 'REQUESTED' }, {}],
            [{}, { status: 'PAID' }],
          ]
        for (const [attempt, paymentData] of cases) {
          const payment = await pendingBoleto()
          if (Object.keys(paymentData).length)
            await prisma.payment.update({
              where: { id: payment.id },
              data: paymentData,
            })
          const row = await prisma.paymentAttempt.create({
            data: {
              tenantId,
              paymentId: payment.id,
              integrationId,
              provider: 'ASAAS',
              status: 'UNKNOWN',
              amount: 100,
              dueDate: payment.dueDate,
              idempotencyKey: tenantId + ':payment:' + payment.id + ':initial',
              ...attempt,
            },
          })
          await age(row.id, 2 * UNKNOWN_ISSUANCE_SETTLE_MS)
        }
        expect(await scheduleIssuanceReconciliation(context)).toEqual({
          scheduled: 0,
        })
      })

      // Achado 116: fora de UNKNOWN também há tentativa presa, e nenhuma religação pode duplicar cobrança.
      describe('achado 116: QUEUED sem evento vivo e PROCESSING abandonada voltam a ser religadas', () => {
        const WINDOW = UNKNOWN_ISSUANCE_SETTLE_MS
        const SIX_HOURS = 6 * 3600_000
        const issueEvent = (
          paymentId: string,
          topic = 'payment.issue',
          dedupeKey = 'payment.issue:' + paymentId
        ) =>
          enqueueOutbox(prisma, {
            tenantId,
            topic,
            aggregateId: paymentId,
            payload: { paymentId },
            dedupeKey,
          })
        /** Tentativa inicial QUEUED e o `payment.issue` do pedido, gravados juntos como no pedido de cobrança. */
        async function queuedBoleto(
          amount = 100,
          options: { dueDate?: Date; cpf?: string } = {}
        ) {
          const payment = await pendingBoleto(options)
          const attempt = await prisma.paymentAttempt.create({
            data: {
              tenantId,
              paymentId: payment.id,
              integrationId,
              provider: 'ASAAS',
              amount,
              dueDate: payment.dueDate,
              idempotencyKey: tenantId + ':payment:' + payment.id + ':initial',
            },
          })
          return { payment, attempt }
        }
        /** Asaas limitando a busca de clientes (429): nenhuma cobrança sai e a reserva volta à fila. */
        function rateLimitCustomers() {
          let limited = true
          vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
            limited && new URL(url).pathname.endsWith('/customers')
              ? Promise.resolve(
                  Response.json(
                    { errors: [{ code: 'rate_limit', description: 'limite' }] },
                    { status: 429 }
                  )
                )
              : fake.fetch(url, init)
          )
          return {
            stop: () => {
              limited = false
            },
          }
        }
        /** Entrega até a cobrança ficar sem evento de emissão vivo; devolve o último evento dela. */
        async function exhaust(paymentId: string) {
          for (let delivery = 0; delivery < 8; delivery++) {
            await deliver()
            await prisma.outboxEvent.updateMany({
              where: { tenantId, status: 'PENDING' },
              data: { availableAt: new Date(Date.now() - 1000) },
            })
          }
          const events = await reconciliationEvents(paymentId)
          expect(
            events.filter(
              (event) =>
                event.status === 'PENDING' || event.status === 'PROCESSING'
            )
          ).toEqual([])
          return events.at(-1)!
        }
        /**
         * O processo morre durante o POST /payments: a reserva já foi gravada (PROCESSING) e nada mais
         * será. `applied` diz se o Asaas chegou a criar a cobrança. A emissão fica pendurada para sempre.
         */
        async function dieDuringPost(paymentId: string, applied: boolean) {
          let reached!: () => void
          const atPost = new Promise<void>((resolve) => {
            reached = resolve
          })
          vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
            if (
              (init.method ?? 'GET') !== 'POST' ||
              !new URL(url).pathname.endsWith('/payments')
            )
              return fake.fetch(url, init)
            if (applied) await fake.fetch(url, init)
            reached()
            return new Promise<Response>(() => undefined)
          })
          void issueTenantPayment(context, paymentId)
          await atPost
          vi.stubGlobal('fetch', fake.fetch)
        }

        it('QUEUED cujo payment.issue esgotou por falha passageira: religada por rodada própria, com espera que dobra até 6 h, emite uma vez', async () => {
          const { payment, attempt } = await queuedBoleto()
          await issueEvent(payment.id)
          const outage = rateLimitCustomers()
          expect(await exhaust(payment.id)).toMatchObject({
            dedupeKey: tenantId + ':payment.issue:' + payment.id,
            status: 'FAILED',
            attempts: 8,
            lastError: 'DELIVERY_FAILED',
          })
          expect(await attemptOf(payment.id)).toMatchObject({
            id: attempt.id,
            status: 'QUEUED',
            externalId: null,
          })
          // A chave do pedido já existe (FAILED): pedir a emissão de novo não religa nada.
          await issueEvent(payment.id)
          expect(await reconciliationEvents(payment.id)).toHaveLength(1)
          // A primeira religação espera a janela desde a última mudança da tentativa.
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          await age(attempt.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          // Com uma rodada viva, nenhuma outra, por mais tempo que passe.
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
          // Cada rodada esgotada: a seguinte espera a janela, o dobro, … até o teto de 6 h.
          for (const wait of [
            WINDOW,
            2 * WINDOW,
            4 * WINDOW,
            8 * WINDOW,
            16 * WINDOW,
            SIX_HOURS,
            SIX_HOURS,
          ]) {
            const round = await exhaust(payment.id)
            expect(round).toMatchObject({
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
            })
            // A tentativa fica parada a janela inteira: só a espera entre rodadas decide.
            await age(attempt.id, WINDOW)
            const last = round.createdAt.getTime()
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(last + wait - 1)
              )
            ).toEqual({ scheduled: 0 })
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(last + wait)
              )
            ).toEqual({ scheduled: 1 })
          }
          expect(fake.countRequests('POST', '/payments')).toBe(0)
          // O Asaas volta: a rodada viva acha a referência vazia, reserva e emite uma vez.
          outage.stop()
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          const issued = await attemptOf(payment.id)
          expect(issued).toMatchObject({
            id: attempt.id,
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
          expect(await chargesWith(attempt.idempotencyKey)).toHaveLength(1)
          expect(
            new Set(
              (await reconciliationEvents(payment.id)).map(
                (event) => event.dedupeKey
              )
            ).size
          ).toBe(9)
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
        })

        it('conciliação de UNKNOWN que devolveu a tentativa à fila e depois esgotou por falha passageira: a QUEUED é religada e emite uma vez', async () => {
          const payment = await pendingBoleto()
          fake.inject({
            method: 'POST',
            path: '/payments',
            fault: { kind: 'status', status: 503 },
          })
          await expect(
            issueTenantPayment(context, payment.id)
          ).rejects.toMatchObject({ maybeApplied: true })
          const unknown = await attemptOf(payment.id)
          await age(unknown.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          // A rodada acha a referência vazia, devolve a tentativa a QUEUED e só então o GET /customers falha.
          const outage = rateLimitCustomers()
          const round = await exhaust(payment.id)
          expect(round).toMatchObject({
            status: 'FAILED',
            attempts: 8,
            lastError: 'DELIVERY_FAILED',
          })
          expect(
            round.dedupeKey.startsWith(
              tenantId + ':payment.issue:reconcile:' + unknown.id + ':'
            )
          ).toBe(true)
          expect(await attemptOf(payment.id)).toMatchObject({
            id: unknown.id,
            status: 'QUEUED',
            externalId: null,
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          outage.stop()
          await age(unknown.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          const issued = await attemptOf(payment.id)
          expect(issued).toMatchObject({
            id: unknown.id,
            status: 'ISSUED',
            externalId: expect.stringMatching(/^pay_/),
          })
          expect(fake.countRequests('POST', '/payments')).toBe(2)
          expect(await chargesWith(unknown.idempotencyKey)).toHaveLength(1)
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
        })

        it('PROCESSING abandonada antes de o POST chegar ao Asaas: dentro da janela nada; depois dela concilia pela referência, volta à fila e emite uma vez', async () => {
          const payment = await pendingBoleto()
          await dieDuringPost(payment.id, false)
          const abandoned = await attemptOf(payment.id)
          expect(abandoned).toMatchObject({
            status: 'PROCESSING',
            externalId: null,
          })
          expect(fake.countRequests('POST', '/payments')).toBe(0)
          // Dentro da janela a busca vazia não prova nada: nem agenda nem emite.
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          await expect(issueTenantPayment(context, payment.id)).rejects.toThrow(
            'PAYMENT_RECONCILIATION_REQUIRED'
          )
          expect(fake.countRequests('POST', '/payments')).toBe(0)
          await age(abandoned.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          const issued = await attemptOf(payment.id)
          expect(issued).toMatchObject({
            id: abandoned.id,
            status: 'ISSUED',
            externalId: expect.stringMatching(/^pay_/),
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          expect(await chargesWith(abandoned.idempotencyKey)).toHaveLength(1)
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
        })

        it('PROCESSING abandonada depois de o Asaas criar a cobrança: a conciliação vincula pela referência, sem outro POST', async () => {
          const payment = await pendingBoleto()
          await dieDuringPost(payment.id, true)
          const abandoned = await attemptOf(payment.id)
          expect(abandoned).toMatchObject({
            status: 'PROCESSING',
            externalId: null,
          })
          const [created] = await chargesWith(abandoned.idempotencyKey)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          await age(abandoned.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          expect(await attemptOf(payment.id)).toMatchObject({
            id: abandoned.id,
            status: 'ISSUED',
            externalId: created!.id,
          })
          expect(
            (
              await prisma.payment.findUniqueOrThrow({
                where: { id: payment.id },
              })
            ).transactionId
          ).toBe(created!.id)
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          expect(await chargesWith(abandoned.idempotencyKey)).toHaveLength(1)
        })

        it('QUEUED com evento de emissão vivo (payment.issue ou payment.boleto.issue) não é religada; quando o evento morre, é', async () => {
          const payments: string[] = []
          for (const [topic, key] of [
            ['payment.issue', 'payment.issue:'],
            ['payment.boleto.issue', 'payment-boleto:'],
          ] as const) {
            const { payment, attempt } = await queuedBoleto()
            await issueEvent(payment.id, topic, key + payment.id)
            // Entrega que falhou e espera a próxima tentativa: o evento continua vivo.
            await prisma.outboxEvent.updateMany({
              where: { tenantId, aggregateId: payment.id },
              data: {
                attempts: 3,
                lastError: 'DELIVERY_FAILED',
                availableAt: new Date(Date.now() + 3600_000),
              },
            })
            await age(attempt.id, 2 * WINDOW)
            payments.push(payment.id)
          }
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          // Os eventos esgotam: nenhum vivo, e cada tentativa ganha a sua religação.
          await prisma.outboxEvent.updateMany({
            where: { tenantId },
            data: { status: 'FAILED', attempts: 8 },
          })
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 2,
          })
          expect(await deliver()).toMatchObject({
            completed: 2,
            retried: 0,
            failed: 0,
          })
          for (const paymentId of payments)
            expect(await attemptOf(paymentId)).toMatchObject({
              status: 'ISSUED',
            })
          expect(fake.countRequests('POST', '/payments')).toBe(2)
        })

        it('religação encerrada com código, e a tentativa mudou depois dela: parada de novo em QUEUED, ganha a rodada seguinte e emite uma vez', async () => {
          const { payment, attempt } = await queuedBoleto()
          // A rodada 0 terminou com código (a conciliação dela perdeu a corrida para outra, que levou a
          // tentativa adiante); depois disso a tentativa mudou e voltou a parar em QUEUED.
          const resumeKey = tenantId + ':payment.issue:resume:' + attempt.id
          await prisma.outboxEvent.create({
            data: {
              tenantId,
              topic: 'payment.issue',
              aggregateId: payment.id,
              payload: { paymentId: payment.id },
              dedupeKey: resumeKey,
              status: 'FAILED',
              attempts: 3,
              lastError: 'PAYMENT_RECONCILIATION_REQUIRED',
              createdAt: new Date(Date.now() - 2 * 3600_000),
            },
          })
          await age(attempt.id, 3600_000)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await reconciliationEvents(payment.id)).toMatchObject([
            { dedupeKey: resumeKey, status: 'FAILED' },
            { dedupeKey: resumeKey + ':1', status: 'PENDING' },
          ])
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          expect(await attemptOf(payment.id)).toMatchObject({
            id: attempt.id,
            status: 'ISSUED',
            externalId: expect.stringMatching(/^pay_/),
          })
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          expect(await chargesWith(attempt.idempotencyKey)).toHaveLength(1)
        })

        it('religação que termina com código de revisão (valor divergente) não volta enquanto a tentativa não mudar, e nunca chama o Asaas', async () => {
          const { payment, attempt } = await queuedBoleto(90)
          const since = await age(attempt.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await deliver()).toMatchObject({
            completed: 0,
            retried: 0,
            failed: 1,
          })
          expect(await reconciliationEvents(payment.id)).toMatchObject([
            {
              status: 'FAILED',
              attempts: 1,
              lastError: 'ATTEMPT_REQUIRES_REVIEW',
            },
          ])
          // A recusa acontece antes de qualquer reserva: a tentativa não mudou, e a revisão fica com ela.
          expect(await attemptOf(payment.id)).toMatchObject({
            status: 'QUEUED',
            updatedAt: since,
          })
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
          expect(
            fake.countRequests('GET', /.*/) + fake.countRequests('POST', /.*/)
          ).toBe(0)
        })

        // Segunda rodada: recusa definitiva do próprio pedido (400 do Asaas, ou pedido inválido antes da
        // rede) não é falha passageira. Tratada como DELIVERY_FAILED, a religação repetia o mesmo POST
        // recusado a cada 6 h, para sempre, gastando a cota da chave da locadora.
        describe('pedido que o Asaas sempre recusa: encerra na primeira entrega e nunca é religado', () => {
          const PAST = new Date('2020-01-10T12:00:00Z')
          /** Passadas do agendador e da entrega ao longo de um mês: nada é agendado nem entregue. */
          async function neverAgain(paymentId: string) {
            const rounds = (await reconciliationEvents(paymentId)).length
            const start = Date.now()
            for (const later of [
              0,
              WINDOW,
              2 * WINDOW,
              SIX_HOURS,
              DAY_MS,
              7 * DAY_MS,
              30 * DAY_MS,
            ]) {
              expect(
                await scheduleIssuanceReconciliation(
                  context,
                  new Date(start + later)
                )
              ).toEqual({ scheduled: 0 })
              expect(await deliver()).toMatchObject({
                completed: 0,
                retried: 0,
                failed: 0,
              })
            }
            expect(await reconciliationEvents(paymentId)).toHaveLength(rounds)
          }

          it('vencimento no passado (400 invalid_dueDate): a primeira entrega encerra a tentativa em FAILED com o código do Asaas, um POST só', async () => {
            const { payment, attempt } = await queuedBoleto(100, {
              dueDate: PAST,
            })
            await issueEvent(payment.id)
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 1,
            })
            expect(await reconciliationEvents(payment.id)).toMatchObject([
              {
                dedupeKey: tenantId + ':payment.issue:' + payment.id,
                status: 'FAILED',
                attempts: 1,
                lastError: 'PAYMENT_REQUEST_REJECTED',
              },
            ])
            expect(await attemptOf(payment.id)).toMatchObject({
              id: attempt.id,
              status: 'FAILED',
              externalId: null,
              response: {
                rejection: {
                  reason: 'VALIDATION',
                  status: 400,
                  providerCodes: ['invalid_dueDate'],
                },
              },
            })
            expect(fake.countRequests('POST', '/payments')).toBe(1)
            await neverAgain(payment.id)
            expect(fake.countRequests('POST', '/payments')).toBe(1)
            expect(await chargesWith(attempt.idempotencyKey)).toEqual([])
            expect(
              await prisma.payment.findUniqueOrThrow({
                where: { id: payment.id },
              })
            ).toMatchObject({ status: 'PENDING', transactionId: null })
          })

          it('tentativa presa de antes (o evento do pedido esgotou) cujo vencimento passou: uma religação, um POST recusado, e para', async () => {
            const { payment, attempt } = await queuedBoleto(100, {
              dueDate: PAST,
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
            await age(attempt.id, WINDOW)
            expect(await scheduleIssuanceReconciliation(context)).toEqual({
              scheduled: 1,
            })
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 1,
            })
            expect(
              (await reconciliationEvents(payment.id)).at(-1)
            ).toMatchObject({
              dedupeKey: tenantId + ':payment.issue:resume:' + attempt.id,
              status: 'FAILED',
              attempts: 1,
              lastError: 'PAYMENT_REQUEST_REJECTED',
            })
            expect(await attemptOf(payment.id)).toMatchObject({
              id: attempt.id,
              status: 'FAILED',
              externalId: null,
            })
            await neverAgain(payment.id)
            expect(fake.countRequests('POST', '/payments')).toBe(1)
          })

          it('vencimento que passou durante a indisponibilidade: a conciliação do UNKNOWN acha a referência vazia, o POST é recusado e a tentativa encerra', async () => {
            const payment = await pendingBoleto({ dueDate: PAST })
            fake.inject({
              method: 'POST',
              path: '/payments',
              fault: { kind: 'status', status: 503 },
            })
            await expect(
              issueTenantPayment(context, payment.id)
            ).rejects.toMatchObject({ maybeApplied: true })
            const unknown = await attemptOf(payment.id)
            expect(unknown.status).toBe('UNKNOWN')
            await age(unknown.id, WINDOW)
            expect(await scheduleIssuanceReconciliation(context)).toEqual({
              scheduled: 1,
            })
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 1,
            })
            expect(await reconciliationEvents(payment.id)).toMatchObject([
              {
                status: 'FAILED',
                attempts: 1,
                lastError: 'PAYMENT_REQUEST_REJECTED',
              },
            ])
            expect(await attemptOf(payment.id)).toMatchObject({
              id: unknown.id,
              status: 'FAILED',
              externalId: null,
            })
            await neverAgain(payment.id)
            expect(fake.countRequests('POST', '/payments')).toBe(2)
            expect(await chargesWith(unknown.idempotencyKey)).toEqual([])
          })

          it('pedido inválido antes da rede (CPF sem forma de CPF): encerra sem reserva e sem POST; no máximo uma religação, e para', async () => {
            const { payment, attempt } = await queuedBoleto(100, { cpf: '123' })
            await issueEvent(payment.id)
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 1,
            })
            expect(await reconciliationEvents(payment.id)).toMatchObject([
              {
                status: 'FAILED',
                attempts: 1,
                lastError: 'PAYMENT_REQUEST_REJECTED',
              },
            ])
            // Recusado antes da reserva: a tentativa não muda.
            const since = await age(attempt.id, WINDOW)
            expect(await attemptOf(payment.id)).toMatchObject({
              status: 'QUEUED',
              updatedAt: since,
            })
            // Sem evento vivo, a QUEUED ganha a sua religação; recusada do mesmo jeito, a cadeia para.
            expect(await scheduleIssuanceReconciliation(context)).toEqual({
              scheduled: 1,
            })
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 1,
            })
            expect(await attemptOf(payment.id)).toMatchObject({
              status: 'QUEUED',
              updatedAt: since,
            })
            await neverAgain(payment.id)
            expect(fake.countRequests('POST', /.*/)).toBe(0)
            expect(fake.countRequests('GET', '/payments')).toBe(2)
          })
        })
      })

      // Achado 125: só a recusa do PEDIDO encerra o evento. Um 400 numa LEITURA depois de o POST ser
      // aceito (dados do PIX/boleto) ou na busca pela referência (conciliação) é passageiro: tratado
      // como recusa, a cobrança criada no Asaas ficava sem vínculo para sempre.
      describe('achado 125: 400 numa leitura nunca vira pedido recusado', () => {
        const READ_REJECTION: FakeFault = {
          kind: 'status',
          status: 400,
          body: { errors: [{ code: 'invalid_action', description: 'x' }] },
        }
        /** Tentativa inicial QUEUED e o `payment.issue` do pedido, gravados juntos como no pedido de cobrança. */
        async function requested(method: 'BOLETO' | 'PIX') {
          const payment = await pendingBoleto({ method })
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
          await enqueueOutbox(prisma, {
            tenantId,
            topic: 'payment.issue',
            aggregateId: payment.id,
            payload: { paymentId: payment.id },
            dedupeKey: 'payment.issue:' + payment.id,
          })
          return { payment, attempt }
        }
        /** A cobrança está vinculada à que existe no Asaas, com os dados que o cliente usa para pagar. */
        async function expectLinked(
          paymentId: string,
          reference: string,
          method: 'BOLETO' | 'PIX'
        ) {
          const remote = await chargesWith(reference)
          expect(remote).toHaveLength(1)
          expect(await attemptOf(paymentId)).toMatchObject({
            status: 'ISSUED',
            externalId: remote[0]!.id,
          })
          const linked = await prisma.payment.findUniqueOrThrow({
            where: { id: paymentId },
          })
          expect(linked.transactionId).toBe(remote[0]!.id)
          if (method === 'PIX')
            expect(linked.pixCode).toEqual(expect.any(String))
          else
            expect(linked.metadata).toMatchObject({
              digitableLine: expect.any(String),
            })
          expect(
            (await issuanceEvents(paymentId)).map((event) => event.lastError)
          ).not.toContain('PAYMENT_REQUEST_REJECTED')
          expect(fake.countRequests('POST', '/payments')).toBe(1)
        }

        it.each<['BOLETO' | 'PIX', RegExp]>([
          ['BOLETO', /\/identificationField$/],
          ['PIX', /\/pixQrCode$/],
        ])(
          '%s: 400 passageiro nos dados depois do POST aceito: a entrega volta à fila e a seguinte vincula a cobrança, sem outro POST',
          async (method, path) => {
            const { payment, attempt } = await requested(method)
            fake.inject({ method: 'GET', path, fault: READ_REJECTION })
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 1,
              failed: 0,
            })
            expect(await issuanceEvents(payment.id)).toMatchObject([
              { status: 'PENDING', attempts: 1, lastError: 'DELIVERY_FAILED' },
            ])
            // A cobrança existe no Asaas; a tentativa continua reservada, nunca FAILED.
            expect(await attemptOf(payment.id)).toMatchObject({
              id: attempt.id,
              status: 'PROCESSING',
              externalId: null,
            })
            expect(await chargesWith(attempt.idempotencyKey)).toHaveLength(1)
            await releaseBackoff()
            expect(await deliver()).toMatchObject({
              completed: 1,
              retried: 0,
              failed: 0,
            })
            await expectLinked(payment.id, attempt.idempotencyKey, method)
          }
        )

        it('400 nos dados em todas as entregas do pedido: o evento esgota por falha passageira, e a conciliação da reserva vincula depois da janela', async () => {
          const { payment, attempt } = await requested('BOLETO')
          fake.inject({
            method: 'GET',
            path: /\/identificationField$/,
            fault: READ_REJECTION,
            times: 8,
          })
          for (let delivery = 0; delivery < 8; delivery++) {
            await deliver()
            await releaseBackoff()
          }
          expect(await issuanceEvents(payment.id)).toMatchObject([
            { status: 'FAILED', attempts: 8, lastError: 'DELIVERY_FAILED' },
          ])
          const reserved = await attemptOf(payment.id)
          expect(reserved).toMatchObject({
            status: 'PROCESSING',
            externalId: null,
          })
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          await age(reserved.id, UNKNOWN_ISSUANCE_SETTLE_MS)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          await expectLinked(payment.id, attempt.idempotencyKey, 'BOLETO')
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
        })

        it('400 na busca pela referência durante a conciliação do UNKNOWN: a rodada volta à fila (não termina) e a seguinte concilia e emite uma vez', async () => {
          const payment = await pendingBoleto()
          fake.inject({
            method: 'POST',
            path: '/payments',
            fault: { kind: 'status', status: 503 },
          })
          await expect(
            issueTenantPayment(context, payment.id)
          ).rejects.toMatchObject({ maybeApplied: true })
          const unknown = await attemptOf(payment.id)
          const since = await age(unknown.id, UNKNOWN_ISSUANCE_SETTLE_MS)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          fake.inject({
            method: 'GET',
            path: '/payments',
            fault: READ_REJECTION,
          })
          expect(await deliver()).toMatchObject({
            completed: 0,
            retried: 1,
            failed: 0,
          })
          expect(await issuanceEvents(payment.id)).toMatchObject([
            { status: 'PENDING', attempts: 1, lastError: 'DELIVERY_FAILED' },
          ])
          // O mesmo episódio incerto, intacto: nada foi decidido pela busca que falhou.
          expect(await attemptOf(payment.id)).toMatchObject({
            status: 'UNKNOWN',
            externalId: null,
            updatedAt: since,
          })
          await releaseBackoff()
          expect(await deliver()).toMatchObject({
            completed: 1,
            retried: 0,
            failed: 0,
          })
          const issued = await attemptOf(payment.id)
          expect(issued).toMatchObject({
            id: unknown.id,
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
          expect(await chargesWith(unknown.idempotencyKey)).toHaveLength(1)
        })
      })

      // Achado 126: o pedido de emissão (`payment.boleto.issue` da locação, `payment.issue` do
      // orçamento) pode esgotar as entregas antes de a tentativa existir (integração indisponível,
      // cadastro do cliente incompleto desfazem a criação dela). Sem tentativa e sem evento vivo, a
      // cobrança ficava aberta e sem emissão para sempre.
      describe('achado 126: cobrança aberta sem tentativa e sem evento vivo', () => {
        const WINDOW = UNKNOWN_ISSUANCE_SETTLE_MS
        /** Pedido de emissão da cobrança como os módulos o gravam. */
        const request = (paymentId: string, topic: string, key: string) =>
          enqueueOutbox(prisma, {
            tenantId,
            topic,
            aggregateId: paymentId,
            payload: { paymentId },
            dedupeKey: key + paymentId,
          })
        /** Entrega até nenhum evento de emissão da cobrança continuar vivo; devolve o último. */
        async function exhaust(paymentId: string) {
          for (let delivery = 0; delivery < 8; delivery++) {
            await deliver()
            await releaseBackoff()
          }
          const events = await issuanceEvents(paymentId)
          expect(
            events.filter(
              (event) =>
                event.status === 'PENDING' || event.status === 'PROCESSING'
            )
          ).toEqual([])
          return events.at(-1)!
        }
        /** Passadas do agendador e da entrega ao longo de um mês: nada é agendado nem entregue. */
        async function neverAgain(paymentId: string) {
          const rounds = (await issuanceEvents(paymentId)).length
          const start = Date.now()
          for (const later of [
            0,
            WINDOW,
            2 * WINDOW,
            6 * 3600_000,
            DAY_MS,
            7 * DAY_MS,
            30 * DAY_MS,
          ]) {
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(start + later)
              )
            ).toEqual({ scheduled: 0 })
            expect(await deliver()).toMatchObject({
              completed: 0,
              retried: 0,
              failed: 0,
            })
          }
          expect(await issuanceEvents(paymentId)).toHaveLength(rounds)
        }
        /** Os eventos da cobrança foram criados há `ms` a mais (a outbox mede a espera pela criação). */
        async function ageEvents(paymentId: string, ms: number) {
          const { testPool } = { testPool: requireFixturePool() }
          await testPool.query(
            `UPDATE outbox_events SET "createdAt" = "createdAt" - ($3::bigint * interval '1 millisecond') WHERE "tenantId" = $1 AND "aggregateId" = $2`,
            [tenantId, paymentId, ms]
          )
        }

        it.each<[string, string]>([
          ['payment.boleto.issue', 'payment-boleto:'],
          ['payment.issue', 'payment.issue:'],
        ])(
          '%s esgotou com o cadastro do cliente incompleto: religada por rodada própria depois da janela, espera que dobra, e emite uma vez quando o cadastro se completa',
          async (topic, key) => {
            const payment = await pendingBoleto({ cpf: null })
            await request(payment.id, topic, key)
            const original = await exhaust(payment.id)
            expect(original).toMatchObject({
              dedupeKey: tenantId + ':' + key + payment.id,
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
            })
            // A criação da tentativa foi desfeita a cada entrega: nada sobra para a religação das tentativas.
            expect(
              await prisma.paymentAttempt.count({
                where: { tenantId, paymentId: payment.id },
              })
            ).toBe(0)
            // Pedir de novo com a mesma chave não religa nada (a chave já existe, FAILED).
            await request(payment.id, topic, key)
            expect(await issuanceEvents(payment.id)).toHaveLength(1)
            // A primeira religação espera a janela desde o pedido.
            const requestedAt = original.createdAt.getTime()
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(requestedAt + WINDOW - 1)
              )
            ).toEqual({ scheduled: 0 })
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(requestedAt + WINDOW)
              )
            ).toEqual({ scheduled: 1 })
            // Com uma rodada viva, nenhuma outra, por mais tempo que passe.
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(Date.now() + 30 * DAY_MS)
              )
            ).toEqual({ scheduled: 0 })
            // Cada rodada esgotada (cadastro ainda incompleto): a seguinte espera a janela, depois o dobro.
            for (const wait of [WINDOW, 2 * WINDOW]) {
              const round = await exhaust(payment.id)
              expect(round).toMatchObject({
                status: 'FAILED',
                attempts: 8,
                lastError: 'DELIVERY_FAILED',
              })
              expect(
                round.dedupeKey.startsWith(
                  tenantId + ':payment.issue:open:' + payment.id
                )
              ).toBe(true)
              const last = round.createdAt.getTime()
              expect(
                await scheduleIssuanceReconciliation(
                  context,
                  new Date(last + wait - 1)
                )
              ).toEqual({ scheduled: 0 })
              expect(
                await scheduleIssuanceReconciliation(
                  context,
                  new Date(last + wait)
                )
              ).toEqual({ scheduled: 1 })
            }
            expect(
              fake.countRequests('GET', /.*/) + fake.countRequests('POST', /.*/)
            ).toBe(0)
            // O cadastro se completa: a rodada viva cria a tentativa, busca a referência vazia e emite uma vez.
            await prisma.quote.update({
              where: { id: payment.quoteId! },
              data: { cpf: '12345678909' },
            })
            expect(await deliver()).toMatchObject({
              completed: 1,
              retried: 0,
              failed: 0,
            })
            const issued = await attemptOf(payment.id)
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
            expect(await chargesWith(issued.idempotencyKey)).toHaveLength(1)
            expect(
              new Set(
                (await issuanceEvents(payment.id)).map(
                  (event) => event.dedupeKey
                )
              ).size
            ).toBe(4)
            // Emitida: a cobrança tem tentativa e vínculo, e nenhuma passada volta a religá-la.
            expect(
              await scheduleIssuanceReconciliation(
                context,
                new Date(Date.now() + 30 * DAY_MS)
              )
            ).toEqual({ scheduled: 0 })
          }
        )

        it('não toca cobrança com evento vivo, sem pedido de emissão, com tentativa, fechada, já vinculada, de outro meio ou cujo pedido terminou com código', async () => {
          // Pedido vivo (a entrega falhou e espera a próxima): quem emite é ele.
          const live = await pendingBoleto()
          await request(live.id, 'payment.boleto.issue', 'payment-boleto:')
          await prisma.outboxEvent.updateMany({
            where: { tenantId, aggregateId: live.id },
            data: {
              attempts: 3,
              lastError: 'DELIVERY_FAILED',
              availableAt: new Date(Date.now() + 3600_000),
            },
          })
          // Um pedido morreu, mas outro (mais antigo, de outro tópico) ainda está vivo: quem emite é ele.
          const alsoLive = await pendingBoleto()
          await request(alsoLive.id, 'payment.boleto.issue', 'payment-boleto:')
          await prisma.outboxEvent.updateMany({
            where: { tenantId, aggregateId: alsoLive.id },
            data: {
              attempts: 3,
              lastError: 'DELIVERY_FAILED',
              availableAt: new Date(Date.now() + 3600_000),
              createdAt: new Date(Date.now() - 3 * DAY_MS),
            },
          })
          await request(alsoLive.id, 'payment.issue', 'payment.issue:')
          await prisma.outboxEvent.updateMany({
            where: {
              tenantId,
              aggregateId: alsoLive.id,
              topic: 'payment.issue',
            },
            data: {
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
              createdAt: new Date(Date.now() - 2 * DAY_MS),
            },
          })
          // PIX sem pedido de emissão nenhum (ex.: taxa de extensão da locação): nunca é emitido pela religação.
          const unrequested = await pendingBoleto({ method: 'PIX' })
          // Com tentativa (recusada, FAILED): a revisão fica com ela.
          const failed = await pendingBoleto()
          await prisma.paymentAttempt.create({
            data: {
              tenantId,
              paymentId: failed.id,
              integrationId,
              provider: 'ASAAS',
              status: 'FAILED',
              amount: 100,
              dueDate: failed.dueDate,
              idempotencyKey: tenantId + ':payment:' + failed.id + ':initial',
            },
          })
          // Fechadas, já vinculada, de outro meio.
          const others: string[] = []
          for (const data of [
            { status: 'PAID' as const },
            { status: 'CANCELLED' as const },
            { transactionId: 'pay_legacy_' + randomUUID() },
            { method: 'CREDIT_CARD' as const },
          ]) {
            const payment = await pendingBoleto()
            await prisma.payment.update({ where: { id: payment.id }, data })
            others.push(payment.id)
          }
          // Pedido encerrado com código (não por falha passageira): esperar não resolve.
          const coded = await pendingBoleto()
          for (const paymentId of [failed.id, ...others, coded.id]) {
            await request(paymentId, 'payment.boleto.issue', 'payment-boleto:')
            await prisma.outboxEvent.updateMany({
              where: { tenantId, aggregateId: paymentId },
              data: {
                status: 'FAILED',
                attempts: 8,
                lastError:
                  paymentId === coded.id
                    ? 'UNSUPPORTED_PAYMENT_METHOD'
                    : 'DELIVERY_FAILED',
              },
            })
          }
          for (const paymentId of [
            live.id,
            unrequested.id,
            failed.id,
            ...others,
            coded.id,
          ])
            await ageEvents(paymentId, 2 * DAY_MS)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 0,
          })
          expect(
            await scheduleIssuanceReconciliation(
              context,
              new Date(Date.now() + 30 * DAY_MS)
            )
          ).toEqual({ scheduled: 0 })
          expect(
            await prisma.outboxEvent.count({
              where: {
                tenantId,
                dedupeKey: { contains: ':payment.issue:open:' },
              },
            })
          ).toBe(0)
          expect(
            fake.countRequests('GET', /.*/) + fake.countRequests('POST', /.*/)
          ).toBe(0)
        })

        it('recusa definitiva não entra em laço: vencimento no passado, uma religação, um POST recusado, a tentativa encerra e nada volta', async () => {
          const payment = await pendingBoleto({
            dueDate: new Date('2020-01-10T12:00:00Z'),
          })
          await request(payment.id, 'payment.boleto.issue', 'payment-boleto:')
          await prisma.outboxEvent.updateMany({
            where: { tenantId, aggregateId: payment.id },
            data: {
              status: 'FAILED',
              attempts: 8,
              lastError: 'DELIVERY_FAILED',
            },
          })
          await ageEvents(payment.id, WINDOW)
          expect(await scheduleIssuanceReconciliation(context)).toEqual({
            scheduled: 1,
          })
          expect(await deliver()).toMatchObject({
            completed: 0,
            retried: 0,
            failed: 1,
          })
          expect((await issuanceEvents(payment.id)).at(-1)).toMatchObject({
            dedupeKey: tenantId + ':payment.issue:open:' + payment.id,
            status: 'FAILED',
            attempts: 1,
            lastError: 'PAYMENT_REQUEST_REJECTED',
          })
          expect(await attemptOf(payment.id)).toMatchObject({
            status: 'FAILED',
            externalId: null,
            response: {
              rejection: {
                reason: 'VALIDATION',
                status: 400,
                providerCodes: ['invalid_dueDate'],
              },
            },
          })
          await neverAgain(payment.id)
          expect(fake.countRequests('POST', '/payments')).toBe(1)
          expect(
            await chargesWith((await attemptOf(payment.id)).idempotencyKey)
          ).toEqual([])
          expect(
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment.id },
            })
          ).toMatchObject({ status: 'PENDING', transactionId: null })
        })
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
const resolveIntegrationCredential = createIntegrationCredentialResolver()
const { issueTenantPayment, scheduleIssuanceReconciliation } =
  createPaymentIssuance({
    withRentalTransaction,
    withTenantTransaction,
    resolveIntegrationCredential,
  })
