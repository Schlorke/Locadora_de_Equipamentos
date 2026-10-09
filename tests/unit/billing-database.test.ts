import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true') throw new Error('Disposable opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({ connectionString: requireTestDatabase(process.env), max: 12 })
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), testPool: pool }
})
vi.mock('@/lib/application-session', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/security/tenant-webhook', () => ({
  resolveIntegrationCredential: async () => ({ apiKey: 'fixture-api-key', environment: 'sandbox' }),
}))
import { prisma } from '@/lib/prisma'
import { requestBoletoReissue, runBoletoReissue } from '@/lib/payment-reissue'
import { issueTenantPayment } from '@/lib/payment-issuance'
import { requestPayment } from '@/lib/payment-request'
import { requestQuoteBoletoPayment } from '@/lib/quote-boleto'
import { PaymentAccountNotReadyErrorSchema } from '@gb-locacoes/contracts/entitlements'
describe.skipIf(!process.env.TEST_DATABASE_URL)('Billing attempts in disposable PostgreSQL', () => {
  const tenantId = 'billing-' + randomUUID()
  const foreignId = 'billing-foreign-' + randomUUID()
  const context = { tenantId }
  const principal = { tenantId, userId: 'admin-fixture', membershipId: 'member-fixture', role: 'ADMIN' as const }
  let integrationId: string
  beforeAll(async () => {
    await prisma.organization.createMany({ data: [{ id: tenantId, slug: tenantId, name: 'Fixture' }, { id: foreignId, slug: foreignId, name: 'Foreign fixture' }] })
    const integration = await prisma.tenantIntegration.create({ data: {
      tenantId, provider: 'ASAAS', credentialsRef: 'env:LOCADORA_INTEGRATION_FIXTURE', status: 'ACTIVE',
    } })
    integrationId = integration.id
  })
  afterEach(() => vi.unstubAllGlobals())
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { tenantId } })
    await prisma.externalResourceTenant.deleteMany({ where: { tenantId } })
    await prisma.paymentAttempt.deleteMany({ where: { tenantId } })
    await prisma.payment.deleteMany({ where: { tenantId } })
    await prisma.quote.deleteMany({ where: { tenantId } })
    await prisma.tenantIntegration.deleteMany({ where: { tenantId } })
    await prisma.organization.deleteMany({ where: { id: { in: [tenantId, foreignId] } } })
    await prisma.$disconnect()
    const { testPool } = await import('@/lib/prisma') as unknown as { testPool: { end(): Promise<void> } }
    await testPool.end()
  })
  async function fixture() {
    const quote = await prisma.quote.create({ data: {
      tenantId, name: 'Fixture payer', email: 'payer@example.test', phone: '00000000000', cpf: '12345678909',
      total: 100, status: 'APPROVED', approvedAt: new Date(),
    } })
    const externalId = 'pay_old_' + quote.id
    const payment = await prisma.payment.create({ data: {
      tenantId, quoteId: quote.id, amount: 100, method: 'BOLETO', type: 'RENTAL',
      dueDate: new Date('2025-01-01'), transactionId: externalId, metadata: { barcode: 'old-code', boletoSentAt: '2025-01-01' },
    } })
    const attempt = await prisma.paymentAttempt.create({ data: {
      tenantId, paymentId: payment.id, integrationId, provider: 'ASAAS', externalId, status: 'ISSUED',
      idempotencyKey: tenantId + ':initial:' + payment.id, amount: 100, dueDate: payment.dueDate, response: { barcode: 'old-code' },
    } })
    await prisma.externalResourceTenant.create({ data: {
      tenantId, integrationId, provider: 'ASAAS', resourceType: 'PAYMENT', resourceId: payment.id, externalId,
    } })
    return { payment, attempt }
  }
  const body = (value: object) => Response.json(value)
  async function unlocked() {
    const { testPool } = await import('@/lib/prisma') as unknown as { testPool: { query(sql: string, args: string[]): Promise<{ rows: { free: boolean }[] }> } }
    const result = await testPool.query("SELECT pg_try_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext($1)) AS free", [tenantId])
    expect(result.rows[0]!.free).toBe(true)
  }
  it('deduplicates concurrent requests, preserves history and issues only after confirmed cancellation outside SQL', async () => {
    const { payment, attempt } = await fixture()
    const requests = await Promise.all(Array.from({ length: 8 }, () => requestBoletoReissue(principal, payment.id)))
    expect(new Set(requests.map(row => row.operationId)).size).toBe(1)
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: requests[0]!.operationId } })
    const remote = { id: attempt.externalId, externalReference: attempt.idempotencyKey, value: 100, billingType: 'BOLETO', status: 'PENDING' }
    const calls: string[] = []
    let issuedReference = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      await unlocked()
      const method = init.method ?? 'GET'; calls.push(method + ' ' + new URL(url).pathname)
      if (method === 'DELETE') return body({ id: attempt.externalId, deleted: true })
      if (url.endsWith(attempt.externalId!)) return body(remote)
      if (url.includes('/payments?')) return body({ data: [], hasMore: false })
      if (url.includes('/customers?')) return body({ data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }], hasMore: false })
      if (method === 'POST') {
        issuedReference = JSON.parse(String(init.body)).externalReference
        return body({ ...remote, id: 'new_' + payment.id, externalReference: issuedReference })
      }
      if (url.endsWith('/identificationField')) return body({ identificationField: 'new-digits', barCode: 'new-barcode' })
      throw new Error('Unexpected provider request')
    }))
    await runBoletoReissue(context, event.payload)
    await runBoletoReissue(context, event.payload)
    expect(calls.filter(call => call.startsWith('DELETE'))).toHaveLength(1)
    expect(calls.filter(call => call.startsWith('POST'))).toHaveLength(0)
    const waiting = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(waiting.transactionId).toBeNull()
    expect(waiting.amount.equals(payment.amount)).toBe(true)
    const previous = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })
    expect(previous).toMatchObject({ status: 'CANCELLED', cancellationStatus: 'CONFIRMED', externalId: attempt.externalId })
    expect(previous.response).toMatchObject({ barcode: 'old-code', previousPaymentMetadata: payment.metadata })
    await issueTenantPayment(context, payment.id)
    await issueTenantPayment(context, payment.id)
    expect(calls.filter(call => call === 'POST /v3/payments')).toHaveLength(1)
    expect(await prisma.paymentAttempt.count({ where: { tenantId, paymentId: payment.id } })).toBe(2)
    expect(await prisma.externalResourceTenant.count({ where: { tenantId, resourceId: payment.id } })).toBe(2)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).transactionId).toBe('new_' + payment.id)
    expect(issuedReference).toContain(':reissue:' + attempt.id)
  })
  it('an uncertain cancellation persists UNKNOWN and cannot create another charge', async () => {
    const { payment, attempt } = await fixture()
    const request = await requestBoletoReissue(principal, payment.id)
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: request.operationId } })
    const remote = { id: attempt.externalId, externalReference: attempt.idempotencyKey, value: 100, billingType: 'BOLETO', status: 'PENDING' }
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'DELETE') throw new Error('provider-timeout')
      return body(remote)
    })
    vi.stubGlobal('fetch', fetcher)
    await expect(runBoletoReissue(context, event.payload)).rejects.toThrow()
    await expect(runBoletoReissue(context, event.payload)).rejects.toThrow('PAYMENT_RECONCILIATION_REQUIRED')
    expect(fetcher.mock.calls.filter(([, init]) => init.method === 'DELETE')).toHaveLength(1)
    expect(await prisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(1)
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).cancellationStatus).toBe('UNKNOWN')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).transactionId).toBe(attempt.externalId)
  })
  it.each([
    ['429', () => Response.json({ errors: [] }, { status: 429 }), 'RATE_LIMITED'],
    ['401', () => Response.json({ errors: [] }, { status: 401 }), 'AUTHENTICATION'],
  ])('a DELETE refused with %s (nothing applied) goes back to REQUESTED and the next run cancels once and reissues', async (_status, refused, reason) => {
    const { payment, attempt } = await fixture()
    const request = await requestBoletoReissue(principal, payment.id)
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: request.operationId } })
    const remote = { id: attempt.externalId, externalReference: attempt.idempotencyKey, value: 100, billingType: 'BOLETO', status: 'PENDING' }
    let refusing = true
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const method = init.method ?? 'GET'; calls.push(method + ' ' + new URL(url).pathname)
      if (method === 'DELETE') return refusing ? refused() : body({ id: attempt.externalId, deleted: true })
      return body(remote)
    }))
    await expect(runBoletoReissue(context, event.payload)).rejects.toMatchObject({ reason, maybeApplied: false })
    // Nada foi aplicado no Asaas: o cancelamento volta à fila (nunca UNKNOWN para sempre).
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).cancellationStatus).toBe('REQUESTED')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).transactionId).toBe(attempt.externalId)
    refusing = false
    await runBoletoReissue(context, event.payload)
    expect(calls.filter(call => call.startsWith('DELETE'))).toHaveLength(2)
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: 'CANCELLED', cancellationStatus: 'CONFIRMED',
    })
    // A reemissão segue: nova tentativa enfileirada para o mesmo pagamento.
    expect(await prisma.paymentAttempt.count({ where: { paymentId: payment.id, status: 'QUEUED' } })).toBe(1)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).transactionId).toBeNull()
  })
  it('rejects a foreign tenant and a paid obligation before creating cancellation work', async () => {
    const { payment } = await fixture()
    await expect(requestBoletoReissue({ ...principal, tenantId: foreignId }, payment.id)).rejects.toMatchObject({ status: 404 })
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } })
    await expect(requestBoletoReissue(principal, payment.id)).rejects.toMatchObject({ status: 409 })
    expect(await prisma.outboxEvent.count({ where: { tenantId, aggregateId: payment.id } })).toBe(0)
  })
  it('a delayed issuance result cannot restore a cancelled attempt after replacement', async () => {
    const { payment, attempt } = await fixture()
    await prisma.payment.update({ where: { id: payment.id }, data: { transactionId: null } })
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'QUEUED', externalId: null } })
    const remote = { id: attempt.externalId, externalReference: attempt.idempotencyKey, value: 100, billingType: 'BOLETO', status: 'PENDING' }
    let release!: () => void, ready!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { ready = resolve })
    let created = false, detailCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/payments?')) return body({ data: created ? [remote] : [], hasMore: false })
      if (url.includes('/customers?')) return body({ data: [{ id: 'cus-fixture', cpfCnpj: '12345678909' }], hasMore: false })
      if (init.method === 'POST') { created = true; return body(remote) }
      if (init.method === 'DELETE') return body({ id: attempt.externalId, deleted: true })
      if (url.endsWith('/identificationField')) {
        detailCalls += 1
        if (detailCalls === 1) { ready(); await delayed }
        return body({ identificationField: 'old-digits', barCode: 'old-code' })
      }
      return body(remote)
    }))
    const delayedWorker = issueTenantPayment(context, payment.id).then(() => null, error => error)
    await started
    try {
      await issueTenantPayment(context, payment.id)
      const request = await requestBoletoReissue(principal, payment.id)
      const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: request.operationId } })
      await runBoletoReissue(context, event.payload)
    } finally { release() }
    expect(await delayedWorker).toMatchObject({ code: 'ATTEMPT_SUPERSEDED' })
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).transactionId).toBeNull()
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('CANCELLED')
    expect(await prisma.paymentAttempt.count({ where: { paymentId: payment.id, status: 'QUEUED' } })).toBe(1)
  })
  async function approvedQuote() {
    return prisma.quote.create({ data: {
      tenantId, name: 'Fixture payer', email: 'payer@example.test', phone: '00000000000', cpf: '12345678909',
      total: 100, status: 'APPROVED', approvedAt: new Date(),
    } })
  }
  it('a new charge after a cancelled or refunded one creates another obligation and keeps the history intact', async () => {
    for (const voided of ['CANCELLED', 'REFUNDED'] as const) {
      const quote = await approvedQuote()
      const previous = await prisma.payment.create({ data: {
        tenantId, quoteId: quote.id, amount: 100, method: 'PIX', type: 'DEPOSIT', status: voided,
        dueDate: new Date('2025-01-01'), transactionId: 'pay_voided_' + quote.id, metadata: { pixCode: 'old-pix' },
      } })
      const previousAttempt = await prisma.paymentAttempt.create({ data: {
        tenantId, paymentId: previous.id, integrationId, provider: 'ASAAS', externalId: previous.transactionId,
        status: voided, idempotencyKey: tenantId + ':voided:' + previous.id, amount: 100, dueDate: previous.dueDate,
        response: { pixCode: 'old-pix' },
      } })
      const input = { quoteId: quote.id, amount: 100, dueDate: new Date('2030-01-10') }
      const first = await requestPayment(principal, input, 'PIX')
      expect(first.pending).toBe(true)
      expect(first.payment.id).not.toBe(previous.id)
      expect(first.payment).toMatchObject({ tenantId, quoteId: quote.id, method: 'PIX', type: 'DEPOSIT', status: 'PENDING', transactionId: null })
      expect(first.payment.amount.equals(100)).toBe(true)
      const replay = await requestPayment(principal, input, 'PIX')
      expect(replay.payment.id).toBe(first.payment.id)
      const history = await prisma.payment.findUniqueOrThrow({ where: { id: previous.id } })
      expect(history).toMatchObject({ status: voided, transactionId: previous.transactionId, quoteId: quote.id, metadata: { pixCode: 'old-pix' } })
      expect(history.updatedAt).toEqual(previous.updatedAt)
      expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: previousAttempt.id } })).toMatchObject({
        paymentId: previous.id, status: voided, externalId: previous.transactionId, response: { pixCode: 'old-pix' },
      })
      expect(await prisma.paymentAttempt.findMany({ where: { paymentId: first.payment.id } })).toEqual([
        expect.objectContaining({ status: 'QUEUED', integrationId, idempotencyKey: tenantId + ':payment:' + first.payment.id + ':initial' }),
      ])
      expect(await prisma.outboxEvent.count({ where: { tenantId, topic: 'payment.issue', aggregateId: first.payment.id } })).toBe(1)
      expect(await prisma.payment.count({ where: { quoteId: quote.id, method: 'PIX', type: 'DEPOSIT' } })).toBe(2)
    }
  })
  it('the database still refuses a second current charge for the same quote, method and type', async () => {
    const quote = await approvedQuote()
    const charge = { tenantId, quoteId: quote.id, amount: 100, method: 'PIX' as const, type: 'DEPOSIT' as const, dueDate: new Date('2030-01-10') }
    await prisma.payment.create({ data: { ...charge, status: 'PENDING' } })
    for (const status of ['PENDING', 'OVERDUE', 'PAID'] as const)
      await expect(prisma.payment.create({ data: { ...charge, status } })).rejects.toMatchObject({ code: 'P2002' })
    await prisma.payment.create({ data: { ...charge, status: 'CANCELLED' } })
    await prisma.payment.create({ data: { ...charge, status: 'REFUNDED' } })
    expect(await prisma.payment.count({ where: { quoteId: quote.id } })).toBe(3)
  })

  describe('charge barrier of the receiving account (S33)', () => {
    const tenants: string[] = []
    // Disposable database: these companies keep their rows (payment accounts are never deleted, ADR SaaS B.3).
    /** A company whose current receiving account is in the given state (or none: legacy environment reference). */
    async function receiving(account: { mode?: 'ASAAS_SUBACCOUNT' | 'ASAAS_CONNECTED_ACCOUNT'; status: string; integration: string; expired?: boolean } | null) {
      const id = 'barrier-' + randomUUID()
      tenants.push(id)
      await prisma.organization.create({ data: { id, slug: id, name: 'Barrier fixture' } })
      const integration = await prisma.tenantIntegration.create({ data: account
        ? { tenantId: id, provider: 'ASAAS', environment: 'sandbox', credentialSource: 'VAULT', status: account.integration as 'ACTIVE' }
        : { tenantId: id, provider: 'ASAAS', credentialsRef: 'env:LOCADORA_INTEGRATION_FIXTURE', status: 'ACTIVE' } })
      if (account)
        await prisma.paymentAccount.create({ data: {
          tenantId: id, integrationId: integration.id, mode: account.mode ?? 'ASAAS_SUBACCOUNT',
          ...(account.mode === 'ASAAS_CONNECTED_ACCOUNT' ? {} : { subaccountModel: 'STANDARD' as const }),
          environment: 'sandbox', status: account.status as 'APPROVED', commercialInfoExpired: account.expired ?? false,
        } })
      const quote = await prisma.quote.create({ data: {
        tenantId: id, name: 'Fixture payer', email: 'payer@example.test', phone: '00000000000', cpf: '12345678909',
        total: 100, status: 'APPROVED', approvedAt: new Date(),
      } })
      return { principal: { ...principal, tenantId: id }, quote }
    }
    const charge = (quoteId: string) => ({ quoteId, amount: 100, dueDate: new Date('2030-01-10') })
    it.each([
      ['AWAITING_OWNER with its integration still PROVISIONING', { status: 'AWAITING_OWNER', integration: 'PROVISIONING' }],
      ['APPROVED by an event before the health confirmation', { status: 'APPROVED', integration: 'PROVISIONING' }],
      ['RESTRICTED after approval', { status: 'RESTRICTED', integration: 'ACTIVE' }],
      ['APPROVED with expired annual commercial data', { status: 'APPROVED', integration: 'ACTIVE', expired: true }],
    ])('a subaccount %s refuses PIX, boleto and the manual quote boleto with 409 before any write', async (_label, state) => {
      const f = await receiving(state)
      for (const attempt of [
        () => requestPayment(f.principal, charge(f.quote.id), 'PIX'),
        () => requestPayment(f.principal, charge(f.quote.id), 'BOLETO'),
        () => requestQuoteBoletoPayment(f.principal, f.quote.id),
      ]) {
        const error = await attempt().then(() => null, (reason) => reason)
        expect(error).toMatchObject({ status: 409 })
        expect(PaymentAccountNotReadyErrorSchema.parse(error.policy)).toEqual({
          code: 'PAYMENT_ACCOUNT_NOT_READY',
          error: 'A conta de recebimentos ainda não está pronta para emitir cobranças.',
        })
      }
      expect(await prisma.payment.count({ where: { tenantId: f.principal.tenantId } })).toBe(0)
      expect(await prisma.outboxEvent.count({ where: { tenantId: f.principal.tenantId } })).toBe(0)
    })
    it.each([
      ['an approved subaccount with an active integration', { status: 'APPROVED', integration: 'ACTIVE' }],
      ['a connected account (unchanged rule)', { mode: 'ASAAS_CONNECTED_ACCOUNT' as const, status: 'UNDER_REVIEW', integration: 'ACTIVE' }],
      ['no receiving account (legacy environment reference)', null],
    ])('%s still queues the issuance', async (_label, state) => {
      const f = await receiving(state)
      const pix = await requestPayment(f.principal, charge(f.quote.id), 'PIX')
      expect(pix.pending).toBe(true)
      expect(await prisma.outboxEvent.count({ where: { tenantId: f.principal.tenantId, topic: 'payment.issue', aggregateId: pix.payment.id } })).toBe(1)
      const other = await receiving(state)
      const boleto = await requestQuoteBoletoPayment(other.principal, other.quote.id)
      expect(boleto.processing).toBe('PENDING')
    })
  })
})
