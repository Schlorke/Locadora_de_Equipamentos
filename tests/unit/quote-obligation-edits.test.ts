import { ensureQuoteBoletoPayment } from '../../apps/services/api/src/host/payments'
import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
/**
 * Regra única do valor da obrigação do orçamento, pelas rotas reais sobre o
 * PostgreSQL descartável: toda edição que mexe no valor (itens, datas, frete,
 * total, valor final manual, multa, reajuste) recalcula a obrigação a partir do
 * estado atual (itens + frete + reajustes vigentes + multa aprovada, em
 * centavos), de forma idempotente; a cobrança base PENDING nunca emitida passa
 * a cobrar o saldo (obrigação menos o já pago), cobrança paga nunca muda e
 * cobrança já emitida ou vencida faz a edição responder 409
 * PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION. Valor final legado (gravado antes
 * da regra única) é preservado como reajuste, nunca descartado em silêncio. O
 * consumidor `quote.boleto.ensure` é executado depois de cada edição legítima e
 * só é enfileirado quando há um boleto a atualizar.
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
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
import { resolvePaymentObligation } from '../../packages/backend/src/modules/billing/payment-obligation'
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
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/quotes/[id]/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/route'

const HOSTS = [
  [
    'service',
    {
      patchAdminQuote: serviceRoute0.PATCH,
      createAdjustment: serviceRoute1.POST,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { patchAdminQuote, createAdjustment }) => {
  const prefix = `quote-obligation-${randomUUID()}`
  const origin = 'https://app.example.test'
  const RECONCILIATION = {
    status: 409,
    body: {
      error:
        'Cobrança emitida ou paga requer reconciliação antes de alterar o valor do orçamento',
      code: 'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION',
    },
  }
  let tenantId: string
  let adminId: string
  let clientId: string
  let equipmentId: string
  const quoteIds: string[] = []

  const request = (path: string, method: string, body: unknown) =>
    new Request(origin + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as import('next/server').NextRequest
  const params = (id: string) => ({ params: Promise.resolve({ id }) })
  async function call(response: Promise<Response>) {
    const resolved = await response
    return { status: resolved.status, body: await resolved.json() }
  }
  const patch = (id: string, body: unknown) =>
    call(
      patchAdminQuote(
        request('/api/admin/quotes/' + id, 'PATCH', body),
        params(id)
      )
    )
  const adjust = (id: string, category: string, amount: number) =>
    call(
      createAdjustment(
        request('/api/admin/quotes/' + id + '/adjustments', 'POST', {
          category,
          amount,
          justification: 'Reajuste ' + category,
          sendEmail: false,
          sendWhatsapp: false,
        }),
        params(id)
      )
    )
  const stored = (id: string) =>
    prisma.quote.findUniqueOrThrow({
      where: { id },
      include: {
        items: { orderBy: { total: 'desc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        adjustments: true,
      },
    })
  const money = (value: { toString(): string } | null | undefined) =>
    value === null || value === undefined
      ? null
      : Number(value.toString()).toFixed(2)
  const ensureEvents = (quoteId: string) =>
    prisma.outboxEvent.findMany({
      where: { tenantId, topic: 'quote.boleto.ensure', aggregateId: quoteId },
      orderBy: { createdAt: 'asc' },
    })
  /** Executa o consumidor da outbox `quote.boleto.ensure` para cada evento enfileirado. */
  async function runEnsure(quoteId: string) {
    const events = await ensureEvents(quoteId)
    expect(events.length).toBeGreaterThan(0)
    const results = []
    for (const event of events)
      results.push(
        await ensureQuoteBoletoPayment(
          { tenantId },
          (event.payload as { quoteId: string }).quoteId
        )
      )
    return results
  }

  type Charge = {
    amount?: number
    method?: 'BOLETO' | 'PIX'
    type?: 'RENTAL' | 'DEPOSIT' | 'LATE_FEE'
    status?: 'PENDING' | 'OVERDUE' | 'PAID'
    transactionId?: string
    boletoIssuedAt?: Date
    pixCode?: string
    attempt?: boolean
  }

  /** Orçamento com itens de 30 e 20 (diária 10) e as cobranças pedidas. */
  async function quote(
    options: { items?: number[]; approved?: boolean; charges?: Charge[] } = {}
  ) {
    const items = options.items ?? [30, 20]
    const total = items.reduce((sum, value) => sum + value, 0)
    const approved = options.approved ?? true
    const row = await prisma.quote.create({
      data: {
        tenantId,
        quoteCode: `Q-2031-${randomUUID().slice(0, 8)}`,
        name: prefix,
        email: `${prefix}@example.test`,
        phone: '11988887777',
        cpf: '12345678909',
        userId: clientId,
        status: approved ? 'APPROVED' : 'PENDING',
        approvedAt: approved ? new Date('2031-01-02T00:00:00.000Z') : null,
        total,
        originalTotal: total,
        startDate: new Date('2031-01-05T00:00:00.000Z'),
        endDate: new Date('2031-01-07T00:00:00.000Z'),
        deliveryType: 'PICKUP',
        items: {
          create: items.map((value) => ({
            tenantId,
            equipmentId,
            quantity: 1,
            days: value / 10,
            pricePerDay: 10,
            total: value,
            startDate: new Date('2031-01-05T00:00:00.000Z'),
            endDate: new Date('2031-01-07T00:00:00.000Z'),
          })),
        },
      },
      include: { items: { orderBy: { total: 'desc' } } },
    })
    quoteIds.push(row.id)
    for (const charge of options.charges ?? [{}])
      await createCharge({ quoteId: row.id }, charge, total)
    return { id: row.id, big: row.items[0]!.id, small: row.items[1]?.id }
  }

  async function createCharge(
    reference: { quoteId: string } | { rentalId: string },
    charge: Charge,
    amount: number
  ) {
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        ...reference,
        amount: charge.amount ?? amount,
        method: charge.method ?? 'BOLETO',
        type: charge.type ?? 'RENTAL',
        status: charge.status ?? 'PENDING',
        dueDate: new Date('2031-01-04T12:00:00.000Z'),
        transactionId: charge.transactionId ?? null,
        boletoIssuedAt: charge.boletoIssuedAt ?? null,
        pixCode: charge.pixCode ?? null,
      },
    })
    if (charge.attempt)
      await prisma.paymentAttempt.create({
        data: {
          tenantId,
          paymentId: payment.id,
          provider: 'ASAAS',
          amount: payment.amount,
          dueDate: payment.dueDate,
          idempotencyKey: `${prefix}:${payment.id}:initial`,
        },
      })
    return payment
  }

  /**
   * Estado gravado antes da regra única (direto no banco, como as rotas antigas
   * deixavam): valor final manual sem reajuste registrado, frete antigo etc.
   */
  async function legacy(
    id: string,
    data: {
      finalTotal?: string
      total?: string
      deliveryFee?: string
      priceAdjustmentReason?: string
    },
    adjustments: Array<[category: 'TRAVEL' | 'LABOR', amount: string]> = []
  ) {
    await prisma.quote.update({ where: { id }, data })
    for (const [category, amount] of adjustments)
      await prisma.quoteAdjustment.create({
        data: {
          tenantId,
          quoteId: id,
          category,
          amount,
          justification: 'Reajuste antigo ' + category,
          createdBy: adminId,
        },
      })
  }

  /**
   * Orçamento de 30 convertido (COMPLETED) com a cobrança ligada só à locação
   * (`rentalId`), como a conversão e o boleto do convertido deixam.
   */
  async function convertedQuote(charge: Charge) {
    const row = await quote({ items: [30], charges: [] })
    const rentalId = `rental_${randomUUID()}`
    await prisma.rentals.create({
      data: {
        tenantId,
        id: rentalId,
        userid: clientId,
        quoteId: row.id,
        startdate: new Date('2031-01-05T00:00:00.000Z'),
        enddate: new Date('2031-01-07T00:00:00.000Z'),
        total: 30,
        status: 'ACTIVE',
      },
    })
    await prisma.quote.update({
      where: { id: row.id },
      data: { status: 'COMPLETED', convertedToRentalId: rentalId },
    })
    const payment = await createCharge({ rentalId }, charge, 30)
    return { id: row.id, rentalId, paymentId: payment.id }
  }

  /** Saldo que a próxima cobrança da obrigação pede (a mesma regra de requestPayment). */
  const balance = (quoteId: string, amount: number) =>
    withTenantTransaction({ tenantId }, (tx) =>
      resolvePaymentObligation(
        tx,
        { quoteId, amount },
        {
          tenantId,
          userId: adminId,
          membershipId: 'member-admin',
          role: 'ADMIN',
        }
      )
    )

  async function clean() {
    await prisma.outboxEvent.deleteMany({ where: { tenantId } })
    await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
    await prisma.payment.deleteMany({ where: { tenantId } })
    await prisma.rentals.deleteMany({ where: { tenantId } })
    await prisma.quoteAdjustment.deleteMany({
      where: { quoteId: { in: quoteIds } },
    })
    await prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } })
    await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
    quoteIds.length = 0
  }

  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    'quote obligation edits (disposable PostgreSQL)',
    () => {
      beforeAll(async () => {
        tenantId = (
          await prisma.organization.create({
            data: { name: prefix, slug: prefix, status: 'ACTIVE' },
          })
        ).id
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
        await prisma.membership.createMany({
          data: [
            { tenantId, userId: adminId, role: 'ADMIN', status: 'ACTIVE' },
            { tenantId, userId: clientId, role: 'CLIENT', status: 'ACTIVE' },
          ],
        })
        const categoryId = (
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
        mocked.principal.mockImplementation(async () => ({
          ok: true,
          principal: {
            tenantId,
            userId: adminId,
            membershipId: 'member-admin',
            role: 'ADMIN',
          },
        }))
      })
      beforeEach(clean)
      afterAll(async () => {
        if (tenantId) {
          await clean()
          await prisma.equipment.deleteMany({ where: { tenantId } })
          await prisma.category.deleteMany({ where: { tenantId } })
          await prisma.membership.deleteMany({ where: { tenantId } })
          await prisma.user.deleteMany({
            where: { id: { in: [adminId, clientId] } },
          })
          await prisma.organization.deleteMany({ where: { id: tenantId } })
        }
      })

      describe('achado 11: cobrança já emitida nunca muda de valor por edição', () => {
        const issued: Array<[string, Charge]> = [
          [
            'boleto emitido (transactionId e tentativa)',
            {
              transactionId: 'pay_x',
              boletoIssuedAt: new Date(),
              attempt: true,
            },
          ],
          ['só transactionId', { transactionId: 'pay_x' }],
          ['só boletoIssuedAt', { boletoIssuedAt: new Date() }],
          [
            'PIX com pixCode',
            { method: 'PIX', type: 'DEPOSIT', pixCode: 'pix-copia-e-cola' },
          ],
          ['tentativa enfileirada', { attempt: true }],
          // Só o status: vencida sem nenhum marcador de emissão também trava.
          ['vencida (OVERDUE) sem marcador de emissão', { status: 'OVERDUE' }],
        ]
        it.each(issued)(
          '%s: remover item, datas, frete, total, valor final e multa respondem 409 sem mudar nada',
          async (_case, charge) => {
            const row = await quote({ charges: [charge] })
            const before = await stored(row.id)
            const edits: unknown[] = [
              { removeItemId: row.small },
              {
                updateItemDates: {
                  itemId: row.big,
                  startDate: '2031-02-03',
                  endDate: '2031-02-09',
                },
              },
              { deliveryFee: 5 },
              { total: 45 },
              { finalTotal: 45.5, priceAdjustmentReason: 'Frete revisado' },
              { lateFee: 10, lateFeeApproved: true },
            ]
            for (const body of edits)
              expect(await patch(row.id, body)).toEqual(RECONCILIATION)
            const after = await stored(row.id)
            expect(after.items.map((item) => item.id)).toEqual(
              before.items.map((item) => item.id)
            )
            expect(money(after.total)).toBe('50.00')
            expect(after.finalTotal).toBeNull()
            expect(after.lateFeeApproved).toBe(false)
            expect(
              after.payments.map((payment) => money(payment.amount))
            ).toEqual(['50.00'])
            expect(after.adjustments).toHaveLength(0)
            expect(await ensureEvents(row.id)).toHaveLength(0)
            // Edição que não mexe no valor (observação) não exige conciliação.
            expect(
              (await patch(row.id, { adminNotes: 'ligar antes' })).status
            ).toBe(200)
            expect((await stored(row.id)).adminNotes).toBe('ligar antes')
          }
        )

        it('só RENTAL/DEPOSIT: cobrança de multa (LATE_FEE) emitida não trava nem é reprecificada', async () => {
          const row = await quote({
            charges: [
              {},
              {
                type: 'LATE_FEE',
                amount: 7,
                transactionId: 'pay_fee',
                attempt: true,
              },
            ],
          })
          expect(
            (await patch(row.id, { removeItemId: row.small })).status
          ).toBe(200)
          const after = await stored(row.id)
          // createdAt pode empatar; a regra preserva tipo/valor, sem exigir ordem de criação.
          expect(
            after.payments
              .toSorted((left, right) => left.type.localeCompare(right.type))
              .map((payment) => [payment.type, money(payment.amount)])
          ).toEqual([
            ['LATE_FEE', '7.00'],
            ['RENTAL', '30.00'],
          ])
        })

        it('duas cobranças pendentes nunca emitidas: não há como dividir o saldo, 409', async () => {
          const row = await quote({ charges: [{}, { type: 'DEPOSIT' }] })
          expect(
            await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          ).toEqual(RECONCILIATION)
          expect(
            (await stored(row.id)).payments.map((payment) =>
              money(payment.amount)
            )
          ).toEqual(['50.00', '50.00'])
        })
      })

      describe('achado 11: cobrança paga nunca muda; a obrigação pode crescer e o saldo é cobrado à parte', () => {
        it.each<[string, Charge]>([
          [
            'paga no provedor (transactionId e tentativa)',
            { status: 'PAID', transactionId: 'pay_x', attempt: true },
          ],
          ['paga importada, sem marcador de emissão', { status: 'PAID' }],
        ])(
          '%s: aprovar a multa responde 200 e o saldo de 10 fica para a próxima cobrança',
          async (_case, charge) => {
            const row = await quote({ items: [30], charges: [charge] })
            expect(
              (await patch(row.id, { lateFee: 10, lateFeeApproved: true }))
                .status
            ).toBe(200)
            let after = await stored(row.id)
            expect(money(after.finalTotal)).toBe('40.00')
            expect(
              after.payments.map((payment) => [
                payment.status,
                money(payment.amount),
              ])
            ).toEqual([['PAID', '30.00']])
            // Nada a atualizar no boleto: a cobrança paga fica como está.
            expect(await ensureEvents(row.id)).toHaveLength(0)
            expect((await balance(row.id, 10)).amount.toFixed(2)).toBe('10.00')
            // Revogar volta a obrigação ao valor pago.
            expect(
              (await patch(row.id, { lateFeeApproved: false })).status
            ).toBe(200)
            after = await stored(row.id)
            expect(money(after.finalTotal)).toBe('30.00')
            await expect(balance(row.id, 0)).rejects.toMatchObject({
              status: 409,
              message: 'Obrigação já quitada',
            })
            // Reduzir abaixo do que já foi pago exige estorno (conciliação): 409 sem mudar nada.
            expect(await patch(row.id, { total: 20 })).toEqual(RECONCILIATION)
            after = await stored(row.id)
            expect(money(after.total)).toBe('30.00')
            expect(
              after.payments.map((payment) => money(payment.amount))
            ).toEqual(['30.00'])
          }
        )

        it('paga + pendente nunca emitida: a pendente passa a cobrar o saldo; saldo zerado com pendente viva é 409', async () => {
          const row = await quote({
            charges: [
              {
                status: 'PAID',
                amount: 30,
                transactionId: 'pay_paid',
                attempt: true,
              },
              { type: 'DEPOSIT', amount: 20 },
            ],
          })
          const charges = async () =>
            (await stored(row.id)).payments.map((payment) => [
              payment.type,
              payment.status,
              money(payment.amount),
            ])
          expect(
            (await patch(row.id, { lateFee: 10, lateFeeApproved: true })).status
          ).toBe(200)
          expect(money((await stored(row.id)).finalTotal)).toBe('60.00')
          expect(await charges()).toEqual([
            ['RENTAL', 'PAID', '30.00'],
            ['DEPOSIT', 'PENDING', '30.00'],
          ])
          expect(
            (await patch(row.id, { removeItemId: row.small })).status
          ).toBe(200)
          expect(money((await stored(row.id)).finalTotal)).toBe('40.00')
          expect(await charges()).toEqual([
            ['RENTAL', 'PAID', '30.00'],
            ['DEPOSIT', 'PENDING', '10.00'],
          ])
          // Revogar zeraria o saldo com a cobrança pendente ainda viva: conciliação.
          expect(await patch(row.id, { lateFeeApproved: false })).toEqual(
            RECONCILIATION
          )
          expect(await charges()).toEqual([
            ['RENTAL', 'PAID', '30.00'],
            ['DEPOSIT', 'PENDING', '10.00'],
          ])
          // Com uma cobrança paga, o consumidor compararia o boleto ao valor inteiro: nada enfileirado.
          expect(await ensureEvents(row.id)).toHaveLength(0)
        })
      })

      describe('achado 12: multa aprovada entra uma vez só, sobre o estado atual', () => {
        it('aprovar de novo não soma outra vez; revogar tira a multa; aprovar de novo volta', async () => {
          const row = await quote({ items: [30] })
          const approve = { lateFee: 10, lateFeeApproved: true }
          const steps: Array<[unknown, string]> = [
            [approve, '40.00'],
            [approve, '40.00'],
            [{ lateFeeApproved: true }, '40.00'],
            [{ lateFeeApproved: false }, '30.00'],
            [{ lateFeeApproved: true }, '40.00'],
          ]
          for (const [body, expected] of steps) {
            expect((await patch(row.id, body)).status).toBe(200)
            const after = await stored(row.id)
            expect(money(after.finalTotal)).toBe(expected)
            expect(
              after.payments.map((payment) => money(payment.amount))
            ).toEqual([expected])
          }
        })

        it('aprovar a multa depois de remover um item cobra o total atual, nunca o originalTotal antigo', async () => {
          const row = await quote()
          expect(
            (await patch(row.id, { removeItemId: row.small })).status
          ).toBe(200)
          let after = await stored(row.id)
          expect(money(after.total)).toBe('30.00')
          expect(money(after.originalTotal)).toBe('30.00')
          expect(
            (await patch(row.id, { lateFee: 10, lateFeeApproved: true })).status
          ).toBe(200)
          after = await stored(row.id)
          expect(money(after.finalTotal)).toBe('40.00')
          expect(
            after.payments.map((payment) => money(payment.amount))
          ).toEqual(['40.00'])
        })

        it('mudar o valor da multa já aprovada substitui a anterior', async () => {
          const row = await quote({ items: [30] })
          await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          expect((await patch(row.id, { lateFee: 12.5 })).status).toBe(200)
          const after = await stored(row.id)
          expect(money(after.finalTotal)).toBe('42.50')
          expect(
            after.payments.map((payment) => money(payment.amount))
          ).toEqual(['42.50'])
        })
      })

      describe('achado 13: itens, datas e frete recalculam o valor final com reajustes e multa', () => {
        it('reajuste, remoção de item, frete, multa e datas: valor final e cobrança sempre iguais à regra única', async () => {
          const row = await quote()
          expect((await adjust(row.id, 'LABOR', 10)).status).toBe(202)
          const check = async (total: string, finalTotal: string) => {
            const after = await stored(row.id)
            expect(money(after.total)).toBe(total)
            expect(money(after.finalTotal)).toBe(finalTotal)
            expect(
              after.payments.map((payment) => money(payment.amount))
            ).toEqual([finalTotal])
          }
          await check('50.00', '60.00')
          expect(
            (await patch(row.id, { removeItemId: row.small })).status
          ).toBe(200)
          await check('30.00', '40.00')
          expect((await patch(row.id, { deliveryFee: 5 })).status).toBe(200)
          await check('35.00', '45.00')
          expect(
            (await patch(row.id, { lateFee: 10, lateFeeApproved: true })).status
          ).toBe(200)
          await check('35.00', '55.00')
          expect((await patch(row.id, { pickupFee: '2.5' })).status).toBe(200)
          await check('37.50', '57.50')
          expect(
            (
              await patch(row.id, {
                updateItemDates: {
                  itemId: row.big,
                  startDate: '2031-02-03',
                  endDate: '2031-02-09',
                },
              })
            ).status
          ).toBe(200)
          // 6 diárias de 10 = 60, mais entrega 5 e retirada 2.5; reajuste 10 e multa 10.
          await check('67.50', '87.50')
          expect(money((await stored(row.id)).originalTotal)).toBe('67.50')
          // O consumidor do boleto passa com a cobrança reprecificada.
          for (const boleto of await runEnsure(row.id))
            expect(boleto).toMatchObject({ amount: 87.5, created: false })
        })
      })

      describe('achado 14: valor final manual reprecifica a cobrança pendente e o boleto sai', () => {
        it('orçamento aprovado: cobrança não emitida passa a 45.5 e o consumidor quote.boleto.ensure emite esse valor', async () => {
          const row = await quote({ items: [30] })
          const response = await patch(row.id, {
            finalTotal: '45.5',
            priceAdjustmentReason: '  Frete revisado  ',
          })
          expect(response.status).toBe(200)
          const after = await stored(row.id)
          expect(money(after.finalTotal)).toBe('45.50')
          expect(
            after.payments.map((payment) => money(payment.amount))
          ).toEqual(['45.50'])
          // O valor manual fica registrado como reajuste vigente (parte da regra única).
          expect(
            after.adjustments.map((item) => [
              item.category,
              money(item.amount),
              item.justification,
            ])
          ).toEqual([['OTHER', '15.50', 'Frete revisado']])
          const [boleto] = await runEnsure(row.id)
          expect(boleto).toMatchObject({
            paymentId: after.payments[0]!.id,
            amount: 45.5,
            created: false,
            processing: 'PENDING',
          })
          expect(
            await prisma.outboxEvent.count({
              where: {
                tenantId,
                topic: 'payment.issue',
                aggregateId: after.payments[0]!.id,
              },
            })
          ).toBe(1)
        })

        it('o valor manual sobrevive às edições seguintes e a multa entra por cima dele uma vez só', async () => {
          const row = await quote({ items: [30] })
          await patch(row.id, {
            finalTotal: '45.5',
            priceAdjustmentReason: 'Frete revisado',
          })
          await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          expect(money((await stored(row.id)).finalTotal)).toBe('55.50')
          await patch(row.id, { lateFeeApproved: false })
          expect(money((await stored(row.id)).finalTotal)).toBe('45.50')
          await patch(row.id, {
            finalTotal: 40,
            priceAdjustmentReason: 'Desconto',
          })
          const after = await stored(row.id)
          expect(money(after.finalTotal)).toBe('40.00')
          expect(
            after.payments.map((payment) => money(payment.amount))
          ).toEqual(['40.00'])
          for (const boleto of await runEnsure(row.id))
            expect(boleto).toMatchObject({ amount: 40 })
        })

        it('orçamento ainda não aprovado: reprecifica sem enfileirar um ensure que o consumidor recusaria', async () => {
          const row = await quote({ items: [30], approved: false })
          expect(
            (
              await patch(row.id, {
                finalTotal: '45.5',
                priceAdjustmentReason: 'x',
              })
            ).status
          ).toBe(200)
          expect(
            (await stored(row.id)).payments.map((payment) =>
              money(payment.amount)
            )
          ).toEqual(['45.50'])
          expect(await ensureEvents(row.id)).toHaveLength(0)
          await expect(
            ensureQuoteBoletoPayment({ tenantId }, row.id)
          ).rejects.toMatchObject({ status: 409 })
        })
      })

      describe('achado 14: o ensure só é enfileirado quando há um boleto a atualizar', () => {
        it('orçamento aprovado sem cobrança: editar frete, item, datas, valor final ou multa não cria boleto', async () => {
          const row = await quote({ charges: [] })
          const edits: unknown[] = [
            { deliveryFee: 5 },
            { removeItemId: row.small },
            {
              updateItemDates: {
                itemId: row.big,
                startDate: '2031-02-03',
                endDate: '2031-02-09',
              },
            },
            { finalTotal: '90', priceAdjustmentReason: 'Negociado' },
            { lateFee: 10, lateFeeApproved: true },
          ]
          for (const body of edits)
            expect((await patch(row.id, body)).status).toBe(200)
          const after = await stored(row.id)
          expect(money(after.finalTotal)).toBe('100.00')
          expect(after.payments).toHaveLength(0)
          expect(await ensureEvents(row.id)).toHaveLength(0)
        })

        it('orçamento convertido com boleto da locação já emitido: aprovar multa responde 409 e nada é enfileirado', async () => {
          const row = await convertedQuote({
            transactionId: 'pay_rental',
            boletoIssuedAt: new Date(),
            attempt: true,
          })
          expect(
            await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          ).toEqual(RECONCILIATION)
          const after = await stored(row.id)
          expect(after.finalTotal).toBeNull()
          expect(after.lateFeeApproved).toBe(false)
          expect(
            money(
              (
                await prisma.payment.findUniqueOrThrow({
                  where: { id: row.paymentId },
                })
              ).amount
            )
          ).toBe('30.00')
          expect(await ensureEvents(row.id)).toHaveLength(0)
        })

        it('orçamento convertido com boleto da locação ainda não emitido: a locação é dona da cobrança, 409', async () => {
          const row = await convertedQuote({})
          expect(
            await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          ).toEqual(RECONCILIATION)
          expect(await ensureEvents(row.id)).toHaveLength(0)
        })

        it('orçamento convertido com boleto da locação pago: a multa é aprovada, a cobrança paga fica e nada é enfileirado', async () => {
          const row = await convertedQuote({
            status: 'PAID',
            transactionId: 'pay_rental',
            attempt: true,
          })
          expect(
            (await patch(row.id, { lateFee: 10, lateFeeApproved: true })).status
          ).toBe(200)
          expect(money((await stored(row.id)).finalTotal)).toBe('40.00')
          const payment = await prisma.payment.findUniqueOrThrow({
            where: { id: row.paymentId },
          })
          expect([payment.status, money(payment.amount)]).toEqual([
            'PAID',
            '30.00',
          ])
          expect(await ensureEvents(row.id)).toHaveLength(0)
        })
      })

      describe('achados 12, 13 e 14: valor final legado nunca é descartado em silêncio', () => {
        const adjustmentsOf = async (id: string) =>
          (await stored(id)).adjustments
            .map((item) => [
              item.category,
              money(item.amount),
              item.justification,
            ])
            .sort()
        const check = async (id: string, finalTotal: string) => {
          const after = await stored(id)
          expect(money(after.finalTotal)).toBe(finalTotal)
          expect(
            after.payments.map((payment) => money(payment.amount))
          ).toEqual([finalTotal])
        }

        it('valor manual sem reajuste registrado: gravar a multa mantém 45.50; aprovar dá 55.50; revogar volta', async () => {
          const row = await quote({ items: [30], charges: [{ amount: 45.5 }] })
          await legacy(row.id, {
            finalTotal: '45.5',
            priceAdjustmentReason: 'Frete negociado',
          })
          expect((await patch(row.id, { lateFee: 10 })).status).toBe(200)
          await check(row.id, '45.50')
          // A diferença vira reajuste vigente visível, uma vez só.
          expect(await adjustmentsOf(row.id)).toEqual([
            ['OTHER', '15.50', 'Ajuste anterior do valor final'],
          ])
          expect((await patch(row.id, { lateFeeApproved: true })).status).toBe(
            200
          )
          await check(row.id, '55.50')
          expect((await patch(row.id, { lateFeeApproved: false })).status).toBe(
            200
          )
          await check(row.id, '45.50')
          expect(await adjustmentsOf(row.id)).toHaveLength(1)
          for (const boleto of await runEnsure(row.id))
            expect(boleto).toMatchObject({ amount: 45.5 })
        })

        it('desconto legado: aprovar multa e reajustar partem do valor que o cliente devia', async () => {
          const approved = await quote({
            items: [30],
            charges: [{ amount: 25 }],
          })
          await legacy(approved.id, { finalTotal: '25' })
          expect(
            (await patch(approved.id, { lateFee: 10, lateFeeApproved: true }))
              .status
          ).toBe(200)
          await check(approved.id, '35.00')
          expect((await adjust(approved.id, 'LABOR', 5)).status).toBe(202)
          await check(approved.id, '40.00')

          const adjusted = await quote({
            items: [30],
            charges: [{ amount: 25 }],
          })
          await legacy(adjusted.id, { finalTotal: '25' })
          expect((await adjust(adjusted.id, 'LABOR', 5)).status).toBe(202)
          await check(adjusted.id, '30.00')
          expect(await adjustmentsOf(adjusted.id)).toEqual([
            ['LABOR', '5.00', 'Reajuste LABOR'],
            ['OTHER', '-5.00', 'Ajuste anterior do valor final'],
          ])
        })

        it('boleto emitido pelo valor legado: gravar a multa sem aprovar não muda a obrigação (200); aprovar é 409', async () => {
          const row = await quote({
            items: [30],
            charges: [{ amount: 45.5, transactionId: 'pay_x', attempt: true }],
          })
          await legacy(row.id, { finalTotal: '45.5' })
          expect((await patch(row.id, { lateFee: 10 })).status).toBe(200)
          await check(row.id, '45.50')
          expect(
            await patch(row.id, { lateFee: 10, lateFeeApproved: true })
          ).toEqual(RECONCILIATION)
          await check(row.id, '45.50')
        })

        it('frete legado (TRAVEL da regra antiga, total desatualizado): multa e remoção de item partem de itens + frete atual', async () => {
          // Itens 30 + 20 com frete antigo de 10 (total 60); o TRAVEL antigo trocou o frete por 25 sem atualizar o total.
          const row = await quote({
            items: [30, 20],
            charges: [{ amount: 75 }],
          })
          await legacy(
            row.id,
            { total: '60', deliveryFee: '25', finalTotal: '75' },
            [['TRAVEL', '25']]
          )
          expect(
            (await patch(row.id, { lateFee: 5, lateFeeApproved: true })).status
          ).toBe(200)
          await check(row.id, '80.00')
          expect(
            (await patch(row.id, { removeItemId: row.small })).status
          ).toBe(200)
          // Item 30 + frete 25 + multa 5.
          expect(money((await stored(row.id)).total)).toBe('55.00')
          await check(row.id, '60.00')
          for (const boleto of await runEnsure(row.id))
            expect(boleto).toMatchObject({ amount: 60 })
        })
      })

      describe('achado 16: total editado entra em centavos', () => {
        it('grava e cobra 128.57, nunca 128.5714; valor inválido é recusado', async () => {
          const row = await quote({ items: [30] })
          expect((await patch(row.id, { total: 128.5714 })).status).toBe(200)
          const after = await stored(row.id)
          expect(after.total.toString()).toBe('128.57')
          expect(
            after.payments.map((payment) => payment.amount.toString())
          ).toEqual(['128.57'])
          for (const boleto of await runEnsure(row.id))
            expect(boleto).toMatchObject({ amount: 128.57 })
          expect(await patch(row.id, { total: 'abc' })).toEqual({
            status: 400,
            body: { error: 'Valor total inválido' },
          })
          expect(await patch(row.id, { deliveryFee: 'abc' })).toEqual({
            status: 400,
            body: { error: 'Valor de frete inválido' },
          })
          expect((await stored(row.id)).total.toString()).toBe('128.57')
        })

        it('frete fracionário também entra em centavos', async () => {
          const row = await quote({ items: [30] })
          expect((await patch(row.id, { deliveryFee: '12.345' })).status).toBe(
            200
          )
          const after = await stored(row.id)
          expect(after.deliveryFee?.toString()).toBe('12.35')
          expect(after.total.toString()).toBe('42.35')
        })
      })

      describe('achado 101: a reprecificação espera quem segura a chave da emissão da cobrança e relê', () => {
        const issuanceKey = (paymentId: string) =>
          tenantId + ':issue:' + paymentId
        /**
         * Segura só a chave da emissão (`tenantId:issue:paymentId`) e, sob ela, cria a tentativa de
         * emissão, a primeira escrita da reserva de `issueTenantPayment`. Não segura a trava por
         * locadora das mutações de locação: só a chave da cobrança pode ordenar as duas transações.
         */
        async function holdIssuance(paymentId: string) {
          let reserved!: () => void
          let release!: () => void
          const ready = new Promise<void>((resolve) => (reserved = resolve))
          const gate = new Promise<void>((resolve) => (release = resolve))
          const done = prisma.$transaction(
            async (tx) => {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${issuanceKey(paymentId)}, 0))`
              await tx.paymentAttempt.create({
                data: {
                  tenantId,
                  paymentId,
                  provider: 'ASAAS',
                  amount: 50,
                  dueDate: new Date('2031-01-04T12:00:00.000Z'),
                  idempotencyKey: `${tenantId}:payment:${paymentId}:initial`,
                },
              })
              reserved()
              await gate
            },
            { timeout: 20000 }
          )
          await Promise.race([ready, done])
          return { release, done }
        }
        /**
         * Espera (pelo `pg_locks`) outra transação ficar bloqueada na chave da emissão desta
         * cobrança; `false` se a edição terminou sem esperar.
         */
        async function blockedOnIssuanceKey(
          paymentId: string,
          settled: () => boolean
        ) {
          const { testPool } = { testPool: requireFixturePool() }
          for (let attempt = 0; attempt < 400; attempt++) {
            const { rows } = await testPool.query<{ waiting: number }>(
              `SELECT count(*)::int AS waiting FROM pg_locks
             WHERE locktype = 'advisory' AND NOT granted AND objsubid = 1
               AND ((classid::bigint << 32) | objid::bigint) = hashtextextended($1, 0)`,
              [issuanceKey(paymentId)]
            )
            if (rows[0]!.waiting > 0) return true
            if (settled()) return false
            await new Promise((resolve) => setTimeout(resolve, 25))
          }
          return false
        }

        it.each<
          [
            string,
            (row: { id: string; small?: string }) => ReturnType<typeof patch>,
          ]
        >([
          [
            'PATCH removendo um item',
            (row) => patch(row.id, { removeItemId: row.small }),
          ],
          ['reajuste (POST adjustments)', (row) => adjust(row.id, 'LABOR', 10)],
        ])(
          '%s concorrente com a reserva da emissão: espera a chave, vê a tentativa e responde 409 sem mudar o valor',
          async (_case, edit) => {
            const row = await quote()
            const paymentId = (await stored(row.id)).payments[0]!.id
            const holder = await holdIssuance(paymentId)
            let settled = false
            try {
              const response = edit(row).finally(() => {
                settled = true
              })
              // A edição fica parada na chave da emissão enquanto a reserva não termina.
              expect(await blockedOnIssuanceKey(paymentId, () => settled)).toBe(
                true
              )
              expect(settled).toBe(false)
              holder.release()
              await holder.done
              const result = await response
              expect(result.status).toBe(409)
              expect(result.body.code).toBe(
                'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION'
              )
            } finally {
              holder.release()
              await holder.done.catch(() => undefined)
            }
            const after = await stored(row.id)
            expect(after.items).toHaveLength(2)
            expect(money(after.total)).toBe('50.00')
            expect(after.finalTotal).toBeNull()
            expect(after.adjustments).toHaveLength(0)
            // O valor da cobrança continua o da tentativa criada sob a chave.
            expect(
              after.payments.map((payment) => money(payment.amount))
            ).toEqual(['50.00'])
            const attempts = await prisma.paymentAttempt.findMany({
              where: { tenantId, paymentId },
            })
            expect(attempts.map((attempt) => money(attempt.amount))).toEqual([
              '50.00',
            ])
            expect(await ensureEvents(row.id)).toHaveLength(0)
          }
        )
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
