import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createFinancialApi } from '../../packages/frontend/src/pages/financeiro/api/financial'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID(),
  permission = randomUUID(),
  integration = randomUUID()
const quotes = [randomUUID(), randomUUID()],
  payments = [randomUUID(), randomUUID()],
  attempt = randomUUID()
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[53]!,
}
let jar: string
const future = () =>
  new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10)
const actions = ['settings', 'status', 'due-date', 'delete'] as const
type Action = (typeof actions)[number]
const pathname = (action: Action, id: string = payments[0]!) =>
  action === 'settings'
    ? '/api/admin/financial/settings'
    : '/api/admin/financial/entries/' +
      id +
      (action === 'delete' ? '' : '/' + action)
const payload = (action: Action) =>
  action === 'settings'
    ? { cpfRate: 6, cnpjRate: 2.5, cniRate: 6 }
    : action === 'status'
      ? { billingStatus: 'SETTLED' }
      : { dueDate: future() }
async function request(
  host: string,
  action: Action,
  body: unknown = payload(action),
  options: {
    id?: string
    tenant?: string | null
    cookie?: string
    origin?: string
    raw?: boolean
  } = {}
) {
  const r = await fetch(host + pathname(action, options.id), {
    method: action === 'delete' ? 'DELETE' : 'PATCH',
    headers: {
      ...edge,
      Cookie: options.cookie ?? jar,
      ...(options.tenant === null
        ? {}
        : { 'x-tenant-id': options.tenant ?? context.alfa.id }),
      Origin: options.origin ?? 'https://app.platform.test',
      'Sec-Fetch-Site': options.origin ? 'same-site' : 'same-origin',
      'content-type': 'application/json',
    },
    ...(action === 'delete'
      ? {}
      : { body: options.raw ? String(body) : JSON.stringify(body) }),
  })
  const text = await r.text()
  return {
    status: r.status,
    body: r.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text)
      : text,
  }
}
async function snapshot() {
  return {
    payments: await prisma.payment.findMany({
      where: { id: { in: payments } },
      orderBy: { id: 'asc' },
    }),
    attempts: await prisma.paymentAttempt.findMany({
      where: { paymentId: { in: payments } },
      orderBy: { id: 'asc' },
    }),
    events: await prisma.outboxEvent.findMany({
      where: { aggregateId: { in: [...quotes, ...payments] } },
      orderBy: { id: 'asc' },
    }),
    settings: await prisma.financialSetting.findMany({
      where: { updatedBy: context.identity.users[1]!.id },
      orderBy: { id: 'asc' },
    }),
    quotes: await prisma.quote.findMany({
      where: { id: { in: quotes } },
      orderBy: { id: 'asc' },
    }),
  }
}
async function cleanup() {
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: [...quotes, ...payments] } },
  })
  await prisma.paymentAttempt.deleteMany({
    where: { paymentId: { in: payments } },
  })
  await prisma.payment.deleteMany({ where: { id: { in: payments } } })
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
  await prisma.financialSetting.deleteMany({
    where: { updatedBy: context.identity.users[1]!.id },
  })
}
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 1)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
    },
  })
  await prisma.tenantIntegration.create({
    data: {
      id: integration,
      tenantId: context.alfa.id,
      provider: 'ASAAS',
      credentialsRef: 'env:LOCADORA_INTEGRATION_TEST_NOT_RESOLVED',
    },
  })
})
beforeEach(async () => {
  await cleanup()
  await prisma.permission.deleteMany({ where: { id: permission } })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await prisma.tenantIntegration.update({
    where: { id: integration },
    data: { status: 'ACTIVE' },
  })
  for (let i = 0; i < 2; i++) {
    const tenantId = i === 0 ? context.alfa.id : context.bravo.id
    await prisma.quote.create({
      data: {
        id: quotes[i]!,
        tenantId,
        name: 'Snapshot ' + i,
        email: 'payer@example.test',
        phone: '',
        userId: context.identity.users[0]!.id,
        total: 100,
        approvedAt: new Date(),
        status: 'PENDING',
      },
    })
    await prisma.payment.create({
      data: {
        id: payments[i]!,
        tenantId,
        quoteId: quotes[i],
        amount: 100,
        method: 'BOLETO',
        type: 'DEPOSIT',
        dueDate: new Date('2026-01-01T12:00:00Z'),
        transactionId: 'old-' + payments[i],
        metadata: {
          barcode: 'original-barcode',
          invoiceNumber: 'original-invoice',
        },
      },
    })
  }
  await prisma.paymentAttempt.create({
    data: {
      id: attempt,
      tenantId: context.alfa.id,
      paymentId: payments[0]!,
      integrationId: integration,
      provider: 'ASAAS',
      externalId: 'old-' + payments[0],
      status: 'ISSUED',
      idempotencyKey: 'initial-' + payments[0],
      amount: 100,
      dueDate: new Date('2026-01-01T12:00:00Z'),
      response: { barcode: 'original-barcode' },
    },
  })
})
afterAll(async () => {
  try {
    await cleanup()
    await prisma.permission.deleteMany({ where: { id: permission } })
    await prisma.membership.deleteMany({ where: { id: member } })
    await prisma.tenantIntegration.deleteMany({ where: { id: integration } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

for (const host of hosts)
  describe(host, () => {
    it('consumidor financeiro conserva PATCH e negativa 409 sem apagar histórico', async () => {
      const api = createFinancialApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: jar,
            'x-tenant-id': context.alfa.id,
            Origin: 'https://app.platform.test',
            'Sec-Fetch-Site': 'same-origin',
          }),
        })
      )
      const rates = await api.saveSettings({
        body: JSON.stringify({ cpfRate: 7, cnpjRate: 2.5, cniRate: 6 }),
      })
      expect(rates.status).toBe(200)
      expect((await api.settings()).data.settings?.cpfRate).toBe(7)
      const before = await snapshot()
      const removed = await api.remove(payments[0]!)
      expect(removed.status).toBe(409)
      expect(removed.data.error).toBeTruthy()
      expect(await snapshot()).toEqual(before)
      expect(
        (
          await api.status(payments[0]!, {
            body: JSON.stringify({ billingStatus: 'UNPAID' }),
          })
        ).status
      ).toBe(200)
    })
    it.each(actions)(
      'requires real session before %s effects',
      async (action) => {
        const before = await snapshot()
        expect(
          (await request(host, action, payload(action), { cookie: '' })).status
        ).toBe(401)
        expect(await snapshot()).toEqual(before)
      }
    )
    it.each(actions)(
      'requires explicit tenant selection on %s',
      async (action) => {
        const before = await snapshot()
        expect(
          (await request(host, action, payload(action), { tenant: null }))
            .status
        ).toBe(409)
        expect(await snapshot()).toEqual(before)
      }
    )
    it.each(actions)('revalidates membership on %s', async (action) => {
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'REVOKED' },
      })
      const before = await snapshot()
      expect((await request(host, action)).status).toBe(403)
      expect(await snapshot()).toEqual(before)
    })
    it.each(actions)(
      'rejects sibling origin before even parsing %s',
      async (action) => {
        const before = await snapshot()
        expect(
          (
            await request(host, action, '{bad', {
              origin: 'https://bravo.platform.test',
              raw: true,
            })
          ).status
        ).toBe(403)
        expect(await snapshot()).toEqual(before)
      }
    )
    it.each(actions)(
      'requires FINANCIAL exact action on %s',
      async (action) => {
        await prisma.membership.update({
          where: { id: member },
          data: { role: 'OPERATOR' },
        })
        const before = await snapshot()
        await prisma.permission.create({
          data: {
            id: permission,
            tenantId: context.alfa.id,
            role: 'OPERATOR',
            module: 'FINANCIAL',
            action: 'READ',
          },
        })
        expect((await request(host, action)).status).toBe(403)
        await prisma.permission.update({
          where: { id: permission },
          data: { action: action === 'delete' ? 'DELETE' : 'WRITE' },
        })
        expect((await request(host, action)).status).toBe(
          action === 'delete' ? 409 : action === 'due-date' ? 202 : 200
        )
        if (action === 'delete') expect(await snapshot()).toEqual(before)
      }
    )
    it.each(['status', 'due-date', 'delete'] as const)(
      'hides foreign ids without effects on %s',
      async (action) => {
        const before = await snapshot()
        expect(
          (await request(host, action, payload(action), { id: payments[1] }))
            .status
        ).toBe(404)
        expect(await snapshot()).toEqual(before)
      }
    )
    it('preserves append-only rates, actor/tenant and nullable optional fields', async () => {
      const input = {
        cpfRate: 0,
        cnpjRate: 100,
        cniRate: 6,
        taxRegime: 'LUCRO_REAL',
        issExemptRental: false,
        ibsCbsActive: true,
        simplesAliquota: null,
        ibsCbsRate: 0,
        tenantId: context.bravo.id,
        updatedBy: 'intruder',
      }
      const a = await request(host, 'settings', input),
        b = await request(host, 'settings', {
          cpfRate: 7,
          cnpjRate: 8,
          cniRate: 9,
        })
      expect(a.status).toBe(200)
      expect(b.status).toBe(200)
      expect(a.body.settings).toMatchObject({
        cpfRate: 0,
        cnpjRate: 100,
        cniRate: 6,
        taxRegime: 'LUCRO_REAL',
        issExemptRental: false,
        simplesAliquota: null,
        ibsCbsActive: true,
        ibsCbsRate: 0,
        updatedBy: context.identity.users[1]!.id,
      })
      expect(a.body.settings.id).not.toBe(b.body.settings.id)
      const rows = await prisma.financialSetting.findMany({
        where: { updatedBy: context.identity.users[1]!.id },
      })
      expect(rows).toHaveLength(2)
      expect(rows.every((row) => row.tenantId === context.alfa.id)).toBe(true)
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: payments[0] } })
      ).toMatchObject({ status: 'PENDING' })
    })
    it.each([
      { cpfRate: -1, cnpjRate: 2, cniRate: 3 },
      { cpfRate: 1, cnpjRate: 101, cniRate: 3 },
      { cpfRate: 1, cnpjRate: 2 },
      { cpfRate: '1', cnpjRate: 2, cniRate: 3 },
    ])('validates legacy settings input %j', async (input) => {
      const before = await snapshot(),
        r = await request(host, 'settings', input)
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('Validation error')
      expect(r.body.details.length).toBeGreaterThan(0)
      expect(await snapshot()).toEqual(before)
    })
    it('SETTLED preserves gateway state and applies invoice metadata/nullish rules', async () => {
      const r = await request(host, 'status', {
        billingStatus: 'SETTLED',
        invoiceNumber: '  NF  ',
        invoiceIssuedAt: '2030-01-01',
        boletoIssuedAt: '2030-01-02',
        paidAt: '2030-01-03',
      })
      expect(r.status).toBe(200)
      expect(r.body.entry).toMatchObject({
        status: 'PENDING',
        billingStatus: 'SETTLED',
        invoiceNumber: 'NF',
        invoiceIssuedAt: '2030-01-01T00:00:00.000Z',
        boletoIssuedAt: '2030-01-02T00:00:00.000Z',
        paidAt: null,
      })
      expect(r.body.entry.settledAt).toBeTruthy()
      const second = await request(host, 'status', {
        billingStatus: 'SETTLED',
        invoiceNumber: null,
        invoiceIssuedAt: null,
        boletoIssuedAt: null,
      })
      expect(second.body.entry.invoiceNumber).toBe('NF')
      expect(second.body.entry.invoiceIssuedAt).toBe(
        r.body.entry.invoiceIssuedAt
      )
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: quotes[0] } })
      ).toBe(0)
    })
    it('UNPAID maps pending to OVERDUE and leaves the quote unapproved', async () => {
      const r = await request(host, 'status', { billingStatus: 'UNPAID' })
      expect(r.status).toBe(200)
      expect(r.body.entry).toMatchObject({
        status: 'OVERDUE',
        billingStatus: 'UNPAID',
        paidAt: null,
        settledAt: null,
      })
      expect(
        await prisma.quote.findUniqueOrThrow({ where: { id: quotes[0] } })
      ).toMatchObject({ status: 'PENDING' })
      const reopening = await request(host, 'status', {
        billingStatus: 'AWAITING_PAYMENT',
      })
      expect(reopening.status).toBe(409)
      expect(reopening.body.code).toBe('PAYMENT_REISSUE_REQUIRED')
    })
    it.each(['PAID', 'CANCELLED', 'REFUNDED'] as const)(
      'cannot reopen a %s payment',
      async (status) => {
        await prisma.payment.update({
          where: { id: payments[0] },
          data: { status },
        })
        const before = await snapshot()
        for (const billingStatus of ['UNPAID', 'AWAITING_PAYMENT']) {
          const r = await request(host, 'status', { billingStatus })
          expect(r.status).toBe(409)
          expect(r.body.code).toBe('PAYMENT_RECONCILIATION_REQUIRED')
        }
        if (status !== 'PAID')
          expect(
            (await request(host, 'status', { billingStatus: 'PAID' })).status
          ).toBe(409)
        expect(await snapshot()).toEqual(before)
      }
    )
    it('keeps status validation, unknown/missing id and malformed JSON contracts', async () => {
      expect(
        (await request(host, 'status', { billingStatus: 'INVALID' })).status
      ).toBe(400)
      expect(
        (
          await request(
            host,
            'status',
            { billingStatus: 'PAID' },
            { id: randomUUID() }
          )
        ).status
      ).toBe(404)
      const bad = await request(host, 'status', '{bad', { raw: true })
      expect(bad.status).toBe(500)
      expect(bad.body).toEqual({ error: 'Erro ao atualizar status financeiro' })
    })
    it('queues the normalized UTC day without changing issued payment/amount/history', async () => {
      const before = await snapshot(),
        date = future()
      const r = await request(host, 'due-date', {
        dueDate: date + 'T23:59:00-03:00',
      })
      expect(r.status).toBe(202)
      expect(r.body).toMatchObject({
        paymentId: payments[0],
        processing: 'PENDING',
        message:
          'Reemissão solicitada; o vencimento será atualizado após confirmação',
      })
      const after = await snapshot()
      expect(after.payments).toEqual(before.payments)
      expect(after.attempts).toHaveLength(1)
      expect(after.attempts[0]).toMatchObject({
        status: 'ISSUED',
        cancellationStatus: 'REQUESTED',
        externalId: 'old-' + payments[0],
      })
      expect(after.events).toHaveLength(1)
      const normalizedDay = new Date(date + 'T23:59:00-03:00')
        .toISOString()
        .slice(0, 10)
      expect(after.events[0]).toMatchObject({
        id: r.body.operationId,
        topic: 'payment.boleto.reissue',
        payload: {
          paymentId: payments[0],
          attemptId: attempt,
          dueDate: normalizedDay + 'T12:00:00.000Z',
          requestedBy: context.identity.users[1]!.id,
        },
        dedupeKey: context.alfa.id + ':payment.boleto.reissue:' + attempt,
      })
    })
    it.each(['invalid', '2000-01-01'])(
      'rejects date %s without queuing',
      async (dueDate) => {
        const before = await snapshot()
        expect((await request(host, 'due-date', { dueDate })).status).toBe(400)
        expect(await snapshot()).toEqual(before)
      }
    )
    it('rejects paid/missing/unissued and unavailable-integration reissues', async () => {
      await prisma.payment.update({
        where: { id: payments[0] },
        data: { transactionId: null },
      })
      expect((await request(host, 'due-date')).status).toBe(409)
      await prisma.payment.update({
        where: { id: payments[0] },
        data: { transactionId: 'old-' + payments[0], status: 'PAID' },
      })
      expect((await request(host, 'due-date')).status).toBe(409)
      await prisma.payment.update({
        where: { id: payments[0] },
        data: { status: 'PENDING' },
      })
      await prisma.tenantIntegration.update({
        where: { id: integration },
        data: { status: 'DISABLED' },
      })
      expect((await request(host, 'due-date')).status).toBe(409)
      expect(
        (
          await request(host, 'due-date', payload('due-date'), {
            id: randomUUID(),
          })
        ).status
      ).toBe(404)
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: payments[0] } })
      ).toBe(0)
    })
    it('returns history-preservation 409 and missing 404 without deleting anything', async () => {
      const before = await snapshot(),
        r = await request(host, 'delete')
      expect(r.status).toBe(409)
      expect(r.body).toEqual({
        error:
          'O histórico financeiro deve ser preservado. Utilize cancelamento e conciliação.',
        code: 'FINANCIAL_HISTORY_PRESERVED',
      })
      expect(
        (await request(host, 'delete', {}, { id: randomUUID() })).status
      ).toBe(404)
      expect(await snapshot()).toEqual(before)
    })
    it('reports installed methods through OPTIONS', async () => {
      for (const action of actions) {
        const r = await fetch(host + pathname(action), { method: 'OPTIONS' })
        expect(r.status).toBe(204)
        const allow = r.headers
          .get('allow')!
          .split(',')
          .map((x) => x.trim())
          .sort()
        expect(allow).toEqual(
          action === 'settings'
            ? ['GET', 'HEAD', 'OPTIONS', 'PATCH']
            : action === 'delete'
              ? ['DELETE', 'OPTIONS']
              : ['OPTIONS', 'PATCH']
        )
      }
    })
  })
describe('shared durable writes across both hosts', () => {
  it('rolls back confirmation/reissue on outbox failure and restores the grant', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    if (!/^api_parity_[a-f0-9]{12}$/.test(role))
      throw Error('Unexpected parity role')
    const before = await snapshot()
    await alterSharedAcl(pool, 'REVOKE INSERT ON outbox_events FROM ' + role)
    try {
      for (const host of hosts) {
        const confirmation = await request(host, 'status', {
          billingStatus: 'PAID',
        })
        expect(confirmation.status).toBe(500)
        expect(confirmation.body).toEqual({
          error: 'Erro ao atualizar status financeiro',
        })
        const reissue = await request(host, 'due-date')
        expect(reissue.status).toBe(500)
        expect(reissue.body).toEqual({ error: 'Erro ao solicitar reemissão' })
        expect(await snapshot()).toEqual(before)
      }
    } finally {
      await alterSharedAcl(pool, 'GRANT INSERT ON outbox_events TO ' + role)
    }
    expect((await request(context.api, 'due-date')).status).toBe(202)
  })
  it('keeps settings SQL failures generic and restores the insert grant', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    if (!/^api_parity_[a-f0-9]{12}$/.test(role))
      throw Error('Unexpected parity role')
    const before = await snapshot()
    await alterSharedAcl(
      pool,
      'REVOKE INSERT ON financial_settings FROM ' + role
    )
    try {
      for (const host of hosts) {
        const r = await request(host, 'settings')
        expect(r.status).toBe(500)
        expect(r.body).toEqual({
          error: 'Erro ao atualizar alíquotas financeiras',
        })
      }
      expect(await snapshot()).toEqual(before)
    } finally {
      await alterSharedAcl(
        pool,
        'GRANT INSERT ON financial_settings TO ' + role
      )
    }
    expect((await request(context.api, 'settings')).status).toBe(200)
  })
  it('confirms once under concurrent requests with one durable conversion and an approved quote', async () => {
    const beforeForeign = await prisma.payment.findUniqueOrThrow({
      where: { id: payments[1] },
    })
    const body = {
      billingStatus: 'PAID',
      paidAt: '2030-01-03',
      invoiceNumber: ' NF-1 ',
    }
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(rotatingTarget(context, i), 'status', body)
      )
    )
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200))
    for (const r of responses)
      expect(r.body.entry).toMatchObject({
        status: 'PAID',
        billingStatus: 'PAID',
        paidAt: '2030-01-03T00:00:00.000Z',
        invoiceNumber: 'NF-1',
      })
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt } })
    ).toMatchObject({ status: 'PAID' })
    expect(
      await prisma.quote.findUniqueOrThrow({ where: { id: quotes[0] } })
    ).toMatchObject({ status: 'APPROVED' })
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: quotes[0] },
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      topic: 'quote.payment.convert',
      dedupeKey: context.alfa.id + ':quote-payment-convert:' + payments[0],
      payload: { paymentId: payments[0] },
    })
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: payments[1] } })
    ).toEqual(beforeForeign)
    expect(await prisma.rentals.count({ where: { quoteId: quotes[0] } })).toBe(
      0
    )
  })
  it('deduplicates reissue across hosts and rejects a conflicting date or failed event', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(rotatingTarget(context, i), 'due-date')
      )
    )
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(202))
    // parity-scan: oito pedidos reais simultâneos (alternando os hosts no ar) resultam numa só operação.
    expect(new Set(responses.map((r) => r.body.operationId)).size).toBe(1)
    const date = new Date(Date.now() + 86400000 * 8).toISOString().slice(0, 10)
    const before = await snapshot()
    for (const host of hosts)
      expect((await request(host, 'due-date', { dueDate: date })).status).toBe(
        409
      )
    expect(await snapshot()).toEqual(before)
    await prisma.outboxEvent.update({
      where: { id: responses[0]!.body.operationId },
      data: { status: 'FAILED' },
    })
    for (const host of hosts)
      expect((await request(host, 'due-date')).status).toBe(409)
    expect(
      await prisma.paymentAttempt.count({ where: { paymentId: payments[0] } })
    ).toBe(1)
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: payments[0] } })
    ).toMatchObject({
      transactionId: 'old-' + payments[0],
      dueDate: new Date('2026-01-01T12:00:00Z'),
    })
  })
})
